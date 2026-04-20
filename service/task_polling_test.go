package service

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func ensureGenerationRecordTable(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.GenerationRecord{}))
}

func TestSweepTimedOutTasks_LocalImage_ReclaimIfUnderLimit(t *testing.T) {
	truncate(t)
	ensureGenerationRecordTable(t)
	oldTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	t.Cleanup(func() {
		constant.TaskTimeoutMinutes = oldTimeout
	})

	seedUser(t, 1, 1000)
	task := &model.Task{
		UserId:       1,
		TaskID:       "img_reclaim_1",
		Platform:     constant.TaskPlatformImage,
		Status:       model.TaskStatusInProgress,
		WorkerID:     "dead-worker",
		HeartbeatAt:  time.Now().Unix() - 600,
		ReclaimCount: 1,
		Quota:        100,
		SubmitTime:   time.Now().Unix() - 600,
	}
	require.NoError(t, model.DB.Create(task).Error)

	sweepTimedOutTasks(context.Background())

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusSubmitted, updated.Status)
	assert.Equal(t, 2, updated.ReclaimCount)
}

func TestSweepTimedOutTasks_LocalImage_HealthyInProgressNotReclaimed(t *testing.T) {
	truncate(t)
	ensureGenerationRecordTable(t)
	oldTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	t.Cleanup(func() {
		constant.TaskTimeoutMinutes = oldTimeout
	})

	seedUser(t, 1, 1000)
	task := &model.Task{
		UserId:       1,
		TaskID:       "img_healthy_ip",
		Platform:     constant.TaskPlatformImage,
		Status:       model.TaskStatusInProgress,
		WorkerID:     "alive-worker",
		HeartbeatAt:  time.Now().Unix() - 10,
		ReclaimCount: 0,
		Quota:        100,
		SubmitTime:   time.Now().Unix() - 600,
	}
	require.NoError(t, model.DB.Create(task).Error)

	sweepTimedOutTasks(context.Background())

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusInProgress, updated.Status)
	assert.Equal(t, "alive-worker", updated.WorkerID)
	assert.Equal(t, 0, updated.ReclaimCount)
}

func TestSweepTimedOutTasks_LocalImage_PermanentFailAfterMaxReclaim(t *testing.T) {
	truncate(t)
	ensureGenerationRecordTable(t)
	oldTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	t.Cleanup(func() {
		constant.TaskTimeoutMinutes = oldTimeout
	})

	seedUser(t, 1, 1000)
	task := &model.Task{
		UserId:       1,
		TaskID:       "img_max_reclaim",
		Platform:     constant.TaskPlatformImage,
		Status:       model.TaskStatusInProgress,
		WorkerID:     "dead-worker",
		HeartbeatAt:  time.Now().Unix() - 600,
		ReclaimCount: 3,
		Quota:        100,
		SubmitTime:   time.Now().Unix() - 600,
	}
	require.NoError(t, model.DB.Create(task).Error)

	sweepTimedOutTasks(context.Background())

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, updated.Status)
}

func TestSweepTimedOutTasks_LocalImage_StuckSubmittedGetsFailedRefunded(t *testing.T) {
	truncate(t)
	ensureGenerationRecordTable(t)
	oldTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	t.Cleanup(func() {
		constant.TaskTimeoutMinutes = oldTimeout
	})

	seedUser(t, 1, 1000)
	seedToken(t, 1, 1, "sk", 5000)

	task := &model.Task{
		UserId:     1,
		TaskID:     "img_stuck_submitted",
		Platform:   constant.TaskPlatformImage,
		Status:     model.TaskStatusSubmitted,
		Quota:      100,
		SubmitTime: time.Now().Unix() - 600,
		PrivateData: model.TaskPrivateData{
			TokenId: 1,
		},
	}
	require.NoError(t, model.DB.Create(task).Error)

	sweepTimedOutTasks(context.Background())

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, updated.Status)
	assert.Contains(t, updated.FailReason, "超时")
	assert.Equal(t, 1100, getUserQuota(t, 1))
	assert.Equal(t, 5100, getTokenRemainQuota(t, 1))
}

func TestNormalizePolledTaskStatus_ImageNotStartBecomesSubmitted(t *testing.T) {
	task := &model.Task{
		Platform: constant.TaskPlatformImage,
		Status:   model.TaskStatusNotStart,
	}

	status := normalizePolledTaskStatus(task, &relaycommon.TaskInfo{
		Status: string(model.TaskStatusNotStart),
	})

	assert.EqualValues(t, model.TaskStatusSubmitted, status)
}

func TestNormalizePolledTaskStatus_NonImageNotStartStaysNotStart(t *testing.T) {
	task := &model.Task{
		Platform: constant.TaskPlatformSuno,
		Status:   model.TaskStatusNotStart,
	}

	status := normalizePolledTaskStatus(task, &relaycommon.TaskInfo{
		Status: string(model.TaskStatusNotStart),
	})

	assert.EqualValues(t, model.TaskStatusNotStart, status)
}
