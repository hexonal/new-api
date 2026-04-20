package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedLocalImageTask(
	t *testing.T,
	status model.TaskStatus,
	workerID string,
	heartbeatAt int64,
) *model.Task {
	t.Helper()

	task := &model.Task{
		TaskID:       fmt.Sprintf("local_image_%d", time.Now().UnixNano()),
		UserId:       1,
		Platform:     constant.TaskPlatformImage,
		Status:       status,
		WorkerID:     workerID,
		HeartbeatAt:  heartbeatAt,
		SubmitTime:   time.Now().Unix(),
		CreatedAt:    time.Now().Unix(),
		UpdatedAt:    time.Now().Unix(),
		Progress:     "0%",
		Data:         json.RawMessage(`{}`),
		PrivateData:  model.TaskPrivateData{},
		ReclaimCount: 0,
	}
	require.NoError(t, model.DB.Create(task).Error)
	return task
}

func seedLocalImageTaskWithReclaimCount(
	t *testing.T,
	status model.TaskStatus,
	workerID string,
	heartbeatAt int64,
	reclaimCount int,
) *model.Task {
	t.Helper()
	task := seedLocalImageTask(t, status, workerID, heartbeatAt)
	require.NoError(t, model.DB.Model(&model.Task{}).
		Where("id = ?", task.ID).
		Update("reclaim_count", reclaimCount).Error)
	require.NoError(t, model.DB.First(task, task.ID).Error)
	return task
}

func TestLocalImageWorker_ClaimCAS_OnlyOneWinsConcurrent(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 1000)

	task := seedLocalImageTask(t, model.TaskStatusSubmitted, "", 0)
	const workers = 3

	start := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(workers)

	resultCh := make(chan *model.Task, workers)
	errCh := make(chan error, workers)

	for i := 0; i < workers; i++ {
		go func(idx int) {
			defer wg.Done()
			<-start
			claimed, err := ClaimLocalImageTask(context.Background(), fmt.Sprintf("worker-%d", idx), 30)
			if err != nil {
				errCh <- err
				return
			}
			if claimed != nil {
				resultCh <- claimed
			}
		}(i)
	}

	close(start)
	wg.Wait()
	close(errCh)
	close(resultCh)

	for err := range errCh {
		require.NoError(t, err)
	}

	var wins []*model.Task
	for claimed := range resultCh {
		wins = append(wins, claimed)
	}

	require.Len(t, wins, 1)
	assert.Equal(t, task.ID, wins[0].ID)
	assert.EqualValues(t, model.TaskStatusInProgress, wins[0].Status)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusInProgress, updated.Status)
	assert.NotEmpty(t, updated.WorkerID)
	assert.Positive(t, updated.HeartbeatAt)
}

func TestLocalImageWorker_Heartbeat_RenewsLease(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 1000)

	oldHeartbeat := time.Now().Unix() - 120
	task := seedLocalImageTask(t, model.TaskStatusInProgress, "worker-a", oldHeartbeat)

	require.NoError(t, RenewLocalImageLease(context.Background(), "worker-a", task.ID))

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.Greater(t, updated.HeartbeatAt, oldHeartbeat)
}

func TestLocalImageWorker_Heartbeat_FailsIfWorkerIDMismatch(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 1000)

	oldHeartbeat := time.Now().Unix() - 120
	task := seedLocalImageTask(t, model.TaskStatusInProgress, "worker-a", oldHeartbeat)

	err := RenewLocalImageLease(context.Background(), "worker-b", task.ID)
	require.ErrorIs(t, err, ErrLeaseRevoked)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.Equal(t, oldHeartbeat, updated.HeartbeatAt)
}

func TestLocalImageWorker_FinalizeSuccess_CAS(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 1000)

	task := seedLocalImageTask(t, model.TaskStatusInProgress, "worker-a", time.Now().Unix())
	resultURL := "https://example.com/output.png"

	require.NoError(t, FinalizeLocalImageSuccess(
		context.Background(),
		"worker-a",
		task.ID,
		resultURL,
		map[string]any{"url": resultURL},
	))

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusSuccess, updated.Status)
	assert.Equal(t, "100%", updated.Progress)
	assert.Positive(t, updated.FinishTime)
	assert.Equal(t, resultURL, updated.PrivateData.ResultURL)
}

func TestLocalImageWorker_FinalizeSuccess_FailsIfLeaseRevoked(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 1000)

	task := seedLocalImageTask(t, model.TaskStatusInProgress, "worker-a", time.Now().Unix())

	err := FinalizeLocalImageSuccess(
		context.Background(),
		"worker-b",
		task.ID,
		"https://example.com/output.png",
		map[string]any{"url": "https://example.com/output.png"},
	)
	require.ErrorIs(t, err, ErrLeaseRevoked)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusInProgress, updated.Status)
	assert.Empty(t, updated.PrivateData.ResultURL)
}

func TestLocalImageWorker_ReleaseAll_BatchesIfWorkerMatch(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 1000)

	task1 := seedLocalImageTask(t, model.TaskStatusInProgress, "worker-a", time.Now().Unix())
	task2 := seedLocalImageTask(t, model.TaskStatusInProgress, "worker-a", time.Now().Unix())
	task3 := seedLocalImageTask(t, model.TaskStatusInProgress, "worker-a", time.Now().Unix())
	other := seedLocalImageTask(t, model.TaskStatusInProgress, "worker-b", time.Now().Unix())

	affected, err := ReleaseAllLocalImageLeases(context.Background(), "worker-a")
	require.NoError(t, err)
	assert.EqualValues(t, 3, affected)

	for _, taskID := range []int64{task1.ID, task2.ID, task3.ID} {
		var updated model.Task
		require.NoError(t, model.DB.First(&updated, taskID).Error)
		assert.EqualValues(t, model.TaskStatusSubmitted, updated.Status)
		assert.Empty(t, updated.WorkerID)
		assert.Zero(t, updated.HeartbeatAt)
	}

	var untouched model.Task
	require.NoError(t, model.DB.First(&untouched, other.ID).Error)
	assert.EqualValues(t, model.TaskStatusInProgress, untouched.Status)
	assert.Equal(t, "worker-b", untouched.WorkerID)
}

func TestLocalImageWorker_ClaimCAS_SkipsOverReclaimLimitTasks(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 1000)

	expiredAt := time.Now().Unix() - 120
	seedLocalImageTaskWithReclaimCount(
		t,
		model.TaskStatusInProgress,
		"worker-expired",
		expiredAt,
		constant.MaxLocalImageReclaimCount,
	)

	claimed, err := ClaimLocalImageTask(context.Background(), "worker-new", 30)
	require.NoError(t, err)
	assert.Nil(t, claimed)
}

func TestLocalImageWorker_ReleaseByPrefix_ReleasesAllWorkerIDs(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 1000)

	task1 := seedLocalImageTask(t, model.TaskStatusInProgress, "prefix-0", time.Now().Unix())
	task2 := seedLocalImageTask(t, model.TaskStatusInProgress, "prefix-1", time.Now().Unix())
	task3 := seedLocalImageTask(t, model.TaskStatusInProgress, "prefix-2", time.Now().Unix())
	other := seedLocalImageTask(t, model.TaskStatusInProgress, "other-0", time.Now().Unix())

	affected, err := ReleaseAllLocalImageLeasesByPrefix(context.Background(), "prefix")
	require.NoError(t, err)
	assert.EqualValues(t, 3, affected)

	for _, taskID := range []int64{task1.ID, task2.ID, task3.ID} {
		var updated model.Task
		require.NoError(t, model.DB.First(&updated, taskID).Error)
		assert.EqualValues(t, model.TaskStatusSubmitted, updated.Status)
		assert.Empty(t, updated.WorkerID)
		assert.Zero(t, updated.HeartbeatAt)
	}

	var untouched model.Task
	require.NoError(t, model.DB.First(&untouched, other.ID).Error)
	assert.EqualValues(t, model.TaskStatusInProgress, untouched.Status)
	assert.Equal(t, "other-0", untouched.WorkerID)
}
