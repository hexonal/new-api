package service

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

const (
	reconcileInterval  = 5 * time.Minute
	reconcileStaleAge  = 10 * time.Minute
	reconcileBatchSize = 100
)

var reconcilerOnce sync.Once

// StartGenerationRecordReconciler 启动定时对账协程
func StartGenerationRecordReconciler() {
	reconcilerOnce.Do(func() {
		go reconcileLoop()
	})
}

func reconcileLoop() {
	ticker := time.NewTicker(reconcileInterval)
	defer ticker.Stop()
	for range ticker.C {
		if !common.GenerationRecordEnabled.Load() {
			continue
		}
		reconcileStaleRecords()
	}
}

// reconcileStaleRecords 修复长时间未结束的记录
func reconcileStaleRecords() {
	cutoff := time.Now().Unix() - int64(reconcileStaleAge.Seconds())
	records, err := model.GetStaleRecords(cutoff, reconcileBatchSize)
	if err != nil {
		logger.LogError(context.Background(), "reconciler: query stale records failed: "+err.Error())
		return
	}
	for _, rec := range records {
		reconcileSingleRecord(rec)
	}
}

// reconcileSingleRecord 根据 recordKey 前缀分发对账逻辑
func reconcileSingleRecord(rec *model.GenerationRecord) {
	parts := strings.SplitN(rec.RecordKey, ":", 3)
	if len(parts) < 3 {
		markReconcileFailed(rec, "invalid record_key format")
		return
	}
	prefix := parts[0]
	switch prefix {
	case "task":
		reconcileTaskRecord(rec, parts[2])
	case "mj":
		reconcileMjRecord(rec, parts[2])
	default:
		// sync 记录不应该出现在待对账集合中
		markReconcileFailed(rec, "unexpected prefix: "+prefix)
	}
}

// reconcileTaskRecord 用 task 表核对异步任务记录
func reconcileTaskRecord(rec *model.GenerationRecord, taskID string) {
	task := model.GetTaskByTaskID(taskID)
	if task == nil {
		markReconcileFailed(rec, "source task not found")
		return
	}
	advanceFromSourceTask(rec, task)
}

// reconcileMjRecord 用 midjourney 表核对 MJ 记录
func reconcileMjRecord(rec *model.GenerationRecord, mjID string) {
	mj := model.GetByOnlyMJId(mjID)
	if mj == nil {
		markReconcileFailed(rec, "source mj task not found")
		return
	}
	advanceFromSourceMj(rec, mj)
}

// advanceFromSourceTask 根据 task 终态推进 generation_record
func advanceFromSourceTask(rec *model.GenerationRecord, task *model.Task) {
	switch task.Status {
	case model.TaskStatusSuccess:
		update := model.GenerationStatusUpdate{
			Status:     model.GenerationStatusSuccess,
			OutputURLs: BuildTaskOutputJSON(task),
			FinishTime: task.FinishTime,
			StartTime:  task.StartTime,
		}
		applyReconcileAdvance(rec, update)
	case model.TaskStatusFailure:
		update := model.GenerationStatusUpdate{
			Status:       model.GenerationStatusFailed,
			ErrorMessage: task.FailReason,
			FinishTime:   task.FinishTime,
		}
		applyReconcileAdvance(rec, update)
	default:
		// 任务仍在进行中，不处理
		return
	}
}

// advanceFromSourceMj 根据 mj 终态推进 generation_record
func advanceFromSourceMj(rec *model.GenerationRecord, mj *model.Midjourney) {
	switch mj.Status {
	case "SUCCESS":
		update := model.GenerationStatusUpdate{
			Status:     model.GenerationStatusSuccess,
			FinishTime: convertMsToSec(mj.FinishTime),
			StartTime:  convertMsToSec(mj.StartTime),
		}
		applyReconcileAdvance(rec, update)
	case "FAILURE":
		update := model.GenerationStatusUpdate{
			Status:       model.GenerationStatusFailed,
			ErrorMessage: mj.FailReason,
			FinishTime:   convertMsToSec(mj.FinishTime),
		}
		applyReconcileAdvance(rec, update)
	default:
		return
	}
}

func applyReconcileAdvance(rec *model.GenerationRecord, update model.GenerationStatusUpdate) {
	err := model.AdvanceStatus(rec.RecordKey, update, nil)
	if err != nil {
		logger.LogError(context.Background(), "reconciler: advance failed for "+rec.RecordKey+": "+err.Error())
		return
	}
	logger.LogInfo(context.Background(), "reconciler: advanced "+rec.RecordKey+" to "+update.Status)
}

func markReconcileFailed(rec *model.GenerationRecord, reason string) {
	update := model.GenerationStatusUpdate{
		Status:       model.GenerationStatusFailed,
		ErrorMessage: "reconciler: " + reason,
		FinishTime:   time.Now().Unix(),
	}
	_ = model.AdvanceStatus(rec.RecordKey, update, nil)
	logger.LogError(context.Background(), "reconciler: marked failed "+rec.RecordKey+": "+reason)
}
