package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

var ErrLeaseRevoked = errors.New("lease revoked: worker_id mismatch or status changed")

func ClaimLocalImageTask(ctx context.Context, workerID string, leaseSeconds int64) (*model.Task, error) {
	now := common.GetTimestamp()
	cutoff := now - leaseSeconds
	var claimed *model.Task

	err := model.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		candidate, err := firstClaimableLocalImageTask(tx, cutoff)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}

		result := tx.Model(&model.Task{}).
			Where(
				"id = ? AND reclaim_count < ? AND (status = ? OR (status = ? AND heartbeat_at < ?))",
				candidate.ID,
				constant.MaxLocalImageReclaimCount,
				model.TaskStatusSubmitted,
				model.TaskStatusInProgress,
				cutoff,
			).
			Updates(map[string]any{
				"status":       model.TaskStatusInProgress,
				"worker_id":    workerID,
				"heartbeat_at": now,
				"reclaim_count": gorm.Expr(
					"CASE WHEN status = ? AND heartbeat_at < ? THEN reclaim_count + 1 ELSE reclaim_count END",
					model.TaskStatusInProgress,
					cutoff,
				),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}

		var task model.Task
		if err = tx.Where("id = ?", candidate.ID).First(&task).Error; err != nil {
			return err
		}
		claimed = &task
		return nil
	})
	if err != nil {
		return nil, err
	}
	return claimed, nil
}

func RenewLocalImageLease(ctx context.Context, workerID string, taskID int64) error {
	result := model.DB.WithContext(ctx).Model(&model.Task{}).
		Where("id = ? AND worker_id = ? AND status = ?", taskID, workerID, model.TaskStatusInProgress).
		Updates(map[string]any{
			"heartbeat_at": common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrLeaseRevoked
	}
	return nil
}

func FinalizeLocalImageSuccess(
	ctx context.Context,
	workerID string,
	taskID int64,
	resultURL string,
	resultData map[string]any,
) error {
	now := common.GetTimestamp()
	return model.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var task model.Task
		if err := tx.Select("id", "private_data").Where("id = ?", taskID).First(&task).Error; err != nil {
			return err
		}

		task.PrivateData.ResultURL = resultURL
		task.PrivateData.OutputImageURL = resultURL
		updates := map[string]any{
			"status":       model.TaskStatusSuccess,
			"private_data": task.PrivateData,
			"finish_time":  now,
			"progress":     "100%",
		}
		if len(resultData) > 0 {
			payload, err := common.Marshal(resultData)
			if err != nil {
				return err
			}
			updates["data"] = json.RawMessage(payload)
		}

		result := tx.Model(&model.Task{}).
			Where("id = ? AND status = ? AND worker_id = ?", taskID, model.TaskStatusInProgress, workerID).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrLeaseRevoked
		}
		return nil
	})
}

func FinalizeLocalImageFailure(
	ctx context.Context,
	workerID string,
	taskID int64,
	reason string,
	retryable bool,
) error {
	if retryable {
		return nil
	}

	result := model.DB.WithContext(ctx).Model(&model.Task{}).
		Where("id = ? AND status = ? AND worker_id = ?", taskID, model.TaskStatusInProgress, workerID).
		Updates(map[string]any{
			"status":      model.TaskStatusFailure,
			"fail_reason": reason,
			"finish_time": common.GetTimestamp(),
			"progress":    "100%",
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrLeaseRevoked
	}
	return nil
}

func ReleaseAllLocalImageLeases(ctx context.Context, workerID string) (int64, error) {
	result := model.DB.WithContext(ctx).Model(&model.Task{}).
		Where("worker_id = ? AND status = ?", workerID, model.TaskStatusInProgress).
		Updates(map[string]any{
			"status":       model.TaskStatusSubmitted,
			"worker_id":    "",
			"heartbeat_at": 0,
		})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}

func ReleaseAllLocalImageLeasesByPrefix(ctx context.Context, workerIDPrefix string) (int64, error) {
	result := model.DB.WithContext(ctx).Model(&model.Task{}).
		Where("worker_id LIKE ? AND status = ?", workerIDPrefix+"-%", model.TaskStatusInProgress).
		Updates(map[string]any{
			"status":       model.TaskStatusSubmitted,
			"worker_id":    "",
			"heartbeat_at": 0,
		})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}

func firstClaimableLocalImageTask(tx *gorm.DB, cutoff int64) (*model.Task, error) {
	var tasks []model.Task
	err := tx.Where(
		"platform = ? AND reclaim_count < ? AND (status = ? OR (status = ? AND heartbeat_at < ?))",
		constant.TaskPlatformImage,
		constant.MaxLocalImageReclaimCount,
		model.TaskStatusSubmitted,
		model.TaskStatusInProgress,
		cutoff,
	).
		Order("id ASC").
		Limit(1).
		Find(&tasks).Error
	if err != nil {
		return nil, err
	}
	if len(tasks) == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &tasks[0], nil
}

type LocalImageWorkerPool struct {
	workerIDPrefix string
	concurrency    int
	leaseSecs      int64
	heartbeatSecs  int64
	ctx            context.Context
	cancel         context.CancelFunc
	shutdownCh     chan struct{}
	activeWG       sync.WaitGroup
	stopOnce       sync.Once
	started        bool
}

func NewLocalImageWorkerPool() *LocalImageWorkerPool {
	hostname, _ := os.Hostname()
	concurrency := 8
	if v, ok := common.OptionMap["LocalImageWorkerConcurrency"]; ok {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			concurrency = n
		}
	}
	leaseSecs := getLocalImageLeaseTimeoutSeconds()
	heartbeatSecs := int64(30)
	if v, ok := common.OptionMap["LocalImageHeartbeatIntervalSeconds"]; ok {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			heartbeatSecs = n
		}
	}
	return &LocalImageWorkerPool{
		workerIDPrefix: fmt.Sprintf("%s-%d", hostname, os.Getpid()),
		concurrency:    concurrency,
		leaseSecs:      leaseSecs,
		heartbeatSecs:  heartbeatSecs,
		shutdownCh:     make(chan struct{}),
	}
}

func getLocalImageLeaseTimeoutSeconds() int64 {
	leaseSecs := constant.LocalImageLeaseTimeoutSeconds
	if v, ok := common.OptionMap["LocalImageLeaseTimeoutSeconds"]; ok {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			leaseSecs = n
		}
	}
	return leaseSecs
}

func (p *LocalImageWorkerPool) Start(ctx context.Context) {
	if p.started {
		return
	}
	if ctx == nil {
		ctx = context.Background()
	}
	p.started = true
	p.ctx, p.cancel = context.WithCancel(ctx)
	for i := 0; i < p.concurrency; i++ {
		p.activeWG.Add(1)
		go p.loop(p.ctx, i)
	}
	common.SysLog(fmt.Sprintf("[local_image_worker] started %d workers (prefix=%s)", p.concurrency, p.workerIDPrefix))
}

func (p *LocalImageWorkerPool) Shutdown(ctx context.Context) error {
	if !p.started {
		return nil
	}
	p.stopOnce.Do(func() {
		close(p.shutdownCh)
		if p.cancel != nil {
			p.cancel()
		}
	})
	done := make(chan struct{})
	go func() {
		p.activeWG.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-ctx.Done():
		common.SysError("[local_image_worker] shutdown timeout, keeping in-flight leases until worker exit")
		return nil
	}

	released, err := ReleaseAllLocalImageLeasesByPrefix(context.Background(), p.workerIDPrefix)
	if err != nil {
		return err
	}
	common.SysLog(fmt.Sprintf("[local_image_worker] shutdown, released %d orphan leases", released))
	return nil
}

func (p *LocalImageWorkerPool) loop(ctx context.Context, workerIdx int) {
	defer p.activeWG.Done()
	workerID := fmt.Sprintf("%s-%d", p.workerIDPrefix, workerIdx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-p.shutdownCh:
			return
		default:
		}
		task, err := ClaimLocalImageTask(ctx, workerID, p.leaseSecs)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return
			}
			common.SysError(fmt.Sprintf("[local_image_worker %s] claim failed: %s", workerID, err.Error()))
			if sleepErr := sleepWithContext(ctx, 5*time.Second); sleepErr != nil {
				return
			}
			continue
		}
		if task == nil {
			if sleepErr := sleepWithContext(ctx, 2*time.Second); sleepErr != nil {
				return
			}
			continue
		}
		hbCtx, hbCancel := context.WithCancel(ctx)
		var hbWG sync.WaitGroup
		hbWG.Add(1)
		go func(taskID int64) {
			defer hbWG.Done()
			ticker := time.NewTicker(time.Duration(p.heartbeatSecs) * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-hbCtx.Done():
					return
				case <-ticker.C:
					if err := RenewLocalImageLease(hbCtx, workerID, taskID); err != nil {
						return
					}
				}
			}
		}(task.ID)

		_ = ExecuteLocalImageTask(ctx, workerID, task)

		hbCancel()
		hbWG.Wait()
	}
}
