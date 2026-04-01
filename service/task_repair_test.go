package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var repairTaskSeq int64

func ensureRepairTestDB(t *testing.T) {
	t.Helper()
	if model.DB == nil {
		t.Skip("skip: test DB is not initialized")
	}
}

func setupRepairTestRedis(t *testing.T) context.Context {
	t.Helper()

	redisURL := os.Getenv("REDIS_CONN_STRING")
	if redisURL == "" {
		t.Skip("skip: REDIS_CONN_STRING is not set")
	}

	opt, err := redis.ParseURL(redisURL)
	require.NoError(t, err, "failed to parse REDIS_CONN_STRING")

	rdb := redis.NewClient(opt)
	ctx := context.Background()
	require.NoError(t, rdb.Ping(ctx).Err(), "redis is unavailable")

	prevEnabled := common.RedisEnabled
	prevRDB := common.RDB
	common.RedisEnabled = true
	common.RDB = rdb

	t.Cleanup(func() {
		common.RedisEnabled = prevEnabled
		common.RDB = prevRDB
		_ = rdb.Close()
	})

	return ctx
}

func resetRepairTasks(t *testing.T) {
	t.Helper()
	ensureRepairTestDB(t)
	require.NoError(t, model.DB.Exec("DELETE FROM tasks").Error)
	t.Cleanup(func() {
		_ = model.DB.Exec("DELETE FROM tasks").Error
	})
}

func clearRepairRedisKeys(t *testing.T, ctx context.Context, taskIDs ...string) {
	t.Helper()
	if !common.RedisEnabled || common.RDB == nil {
		return
	}

	keys := []string{
		repairLockKey,
		taskPollingPendingRedisKey,
		taskPollingPendingLegacyKey,
	}
	for _, taskID := range taskIDs {
		keys = append(keys, fmt.Sprintf("task:billing:charge:%s", taskID))
	}
	require.NoError(t, common.RDB.Del(ctx, keys...).Err())
}

func seedRepairTask(t *testing.T, status model.TaskStatus, terminalState string, terminalChargeAt int64) *model.Task {
	t.Helper()

	now := time.Now().Unix()
	task := &model.Task{
		TaskID:     fmt.Sprintf("repair-task-%d", atomic.AddInt64(&repairTaskSeq, 1)),
		UserId:     1,
		Group:      "default",
		Status:     status,
		Progress:   "40%",
		SubmitTime: now,
		CreatedAt:  now,
		UpdatedAt:  now,
		Data:       json.RawMessage(`{}`),
		PrivateData: model.TaskPrivateData{
			BillingContext: &model.TaskBillingContext{
				TerminalChargeState: terminalState,
				TerminalChargeAt:    terminalChargeAt,
			},
		},
	}
	require.NoError(t, model.DB.Create(task).Error)
	return task
}

func loadTaskByID(t *testing.T, id int64) *model.Task {
	t.Helper()
	var task model.Task
	require.NoError(t, model.DB.First(&task, id).Error)
	return &task
}

func TestAcquireRepairLock(t *testing.T) {
	ensureRepairTestDB(t)

	t.Run("Redis available, first caller wins", func(t *testing.T) {
		ctx := setupRepairTestRedis(t)
		clearRepairRedisKeys(t, ctx)

		ok := acquireRepairLock(ctx)
		assert.True(t, ok)
	})

	t.Run("Redis available, second caller loses", func(t *testing.T) {
		ctx := setupRepairTestRedis(t)
		clearRepairRedisKeys(t, ctx)

		assert.True(t, acquireRepairLock(ctx))
		assert.False(t, acquireRepairLock(ctx))
	})

	t.Run("Redis unavailable falls back to true", func(t *testing.T) {
		prevEnabled := common.RedisEnabled
		prevRDB := common.RDB
		t.Cleanup(func() {
			common.RedisEnabled = prevEnabled
			common.RDB = prevRDB
		})

		common.RedisEnabled = true
		common.RDB = redis.NewClient(&redis.Options{
			Addr:         "127.0.0.1:0",
			DialTimeout:  50 * time.Millisecond,
			ReadTimeout:  50 * time.Millisecond,
			WriteTimeout: 50 * time.Millisecond,
			PoolTimeout:  50 * time.Millisecond,
		})
		t.Cleanup(func() {
			_ = common.RDB.Close()
		})

		ok := acquireRepairLock(context.Background())
		assert.True(t, ok)
	})
}

func TestRepairStuckChargingTasks(t *testing.T) {
	ensureRepairTestDB(t)
	ctx := setupRepairTestRedis(t)

	t.Run("no stuck tasks", func(t *testing.T) {
		resetRepairTasks(t)
		clearRepairRedisKeys(t, ctx)

		repaired := repairStuckChargingTasks(ctx)
		assert.Equal(t, 0, repaired)
	})

	t.Run("single stuck task gets repaired to pending", func(t *testing.T) {
		resetRepairTasks(t)
		oldAt := time.Now().Add(-11 * time.Minute).Unix()
		task := seedRepairTask(t, model.TaskStatusInProgress, "charging", oldAt)
		clearRepairRedisKeys(t, ctx, task.TaskID)

		repaired := repairStuckChargingTasks(ctx)
		require.Equal(t, 1, repaired)

		reloaded := loadTaskByID(t, task.ID)
		require.NotNil(t, reloaded.PrivateData.BillingContext)
		assert.Equal(t, TaskTerminalChargeStatePending, reloaded.PrivateData.BillingContext.TerminalChargeState)
	})

	t.Run("task within grace period is not repaired", func(t *testing.T) {
		resetRepairTasks(t)
		recentAt := time.Now().Add(-5 * time.Minute).Unix()
		task := seedRepairTask(t, model.TaskStatusInProgress, "charging", recentAt)
		clearRepairRedisKeys(t, ctx, task.TaskID)

		repaired := repairStuckChargingTasks(ctx)
		assert.Equal(t, 0, repaired)

		reloaded := loadTaskByID(t, task.ID)
		require.NotNil(t, reloaded.PrivateData.BillingContext)
		assert.Equal(t, "charging", reloaded.PrivateData.BillingContext.TerminalChargeState)
	})

	t.Run("pagination repairs all pages", func(t *testing.T) {
		resetRepairTasks(t)
		oldAt := time.Now().Add(-11 * time.Minute).Unix()
		ids := make([]int64, 0, 150)
		for i := 0; i < 150; i++ {
			task := seedRepairTask(t, model.TaskStatusInProgress, "charging", oldAt)
			ids = append(ids, task.ID)
		}
		clearRepairRedisKeys(t, ctx)

		repaired := repairStuckChargingTasks(ctx)
		require.Equal(t, 150, repaired)

		for _, id := range ids {
			reloaded := loadTaskByID(t, id)
			require.NotNil(t, reloaded.PrivateData.BillingContext)
			assert.Equal(t, TaskTerminalChargeStatePending, reloaded.PrivateData.BillingContext.TerminalChargeState)
		}
	})

	t.Run("repaired SUCCESS task is re-enqueued", func(t *testing.T) {
		resetRepairTasks(t)
		oldAt := time.Now().Add(-11 * time.Minute).Unix()
		task := seedRepairTask(t, model.TaskStatusSuccess, "charging", oldAt)
		clearRepairRedisKeys(t, ctx, task.TaskID)

		repaired := repairStuckChargingTasks(ctx)
		require.Equal(t, 1, repaired)

		zScore, err := common.RDB.ZScore(ctx, taskPollingPendingRedisKey, task.TaskID).Result()
		require.NoError(t, err)
		assert.NotZero(t, zScore)

		inLegacy, err := common.RDB.SIsMember(ctx, taskPollingPendingLegacyKey, task.TaskID).Result()
		require.NoError(t, err)
		assert.True(t, inLegacy)
	})

	t.Run("repaired FAILURE task is not re-enqueued", func(t *testing.T) {
		resetRepairTasks(t)
		oldAt := time.Now().Add(-11 * time.Minute).Unix()
		task := seedRepairTask(t, model.TaskStatusFailure, "charging", oldAt)
		clearRepairRedisKeys(t, ctx, task.TaskID)

		repaired := repairStuckChargingTasks(ctx)
		require.Equal(t, 1, repaired)

		_, err := common.RDB.ZScore(ctx, taskPollingPendingRedisKey, task.TaskID).Result()
		assert.Error(t, err)
		assert.Equal(t, redis.Nil, err)

		inLegacy, err := common.RDB.SIsMember(ctx, taskPollingPendingLegacyKey, task.TaskID).Result()
		require.NoError(t, err)
		assert.False(t, inLegacy)
	})
}
