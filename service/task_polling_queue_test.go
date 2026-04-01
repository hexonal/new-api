package service

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func TestIsTaskTerminalForPollingQueue(t *testing.T) {
	t.Run("nil task", func(t *testing.T) {
		if !isTaskTerminalForPollingQueue(nil) {
			t.Fatal("expected nil task as terminal for queue cleanup")
		}
	})

	t.Run("progress complete", func(t *testing.T) {
		task := &model.Task{Progress: "100%", Status: model.TaskStatusInProgress}
		if !isTaskTerminalForPollingQueue(task) {
			t.Fatal("expected progress 100% task as terminal")
		}
	})

	t.Run("status success", func(t *testing.T) {
		task := &model.Task{Progress: "50%", Status: model.TaskStatusSuccess}
		if !isTaskTerminalForPollingQueue(task) {
			t.Fatal("expected success task as terminal")
		}
	})

	t.Run("status failure", func(t *testing.T) {
		task := &model.Task{Progress: "20%", Status: model.TaskStatusFailure}
		if !isTaskTerminalForPollingQueue(task) {
			t.Fatal("expected failure task as terminal")
		}
	})

	t.Run("active task", func(t *testing.T) {
		task := &model.Task{Progress: "45%", Status: model.TaskStatusInProgress}
		if isTaskTerminalForPollingQueue(task) {
			t.Fatal("expected in-progress task not terminal")
		}
	})
}

func TestPopDueTasksLuaScript(t *testing.T) {
	ctx, rdb := setupTaskPollingQueueRedis(t)

	t.Run("empty queue", func(t *testing.T) {
		queueKey := uniquePollingKey("queue:empty")
		members := evalPopDueTasksScript(t, ctx, rdb, queueKey, 100, 10, 60)
		require.Empty(t, members)
	})

	t.Run("tasks not yet due", func(t *testing.T) {
		queueKey := uniquePollingKey("queue:not-due")
		require.NoError(t, rdb.ZAdd(ctx, queueKey,
			&redis.Z{Score: 200, Member: "nd-1"},
			&redis.Z{Score: 201, Member: "nd-2"},
			&redis.Z{Score: 202, Member: "nd-3"},
		).Err())

		members := evalPopDueTasksScript(t, ctx, rdb, queueKey, 100, 10, 60)
		require.Empty(t, members)
	})

	t.Run("some tasks due", func(t *testing.T) {
		queueKey := uniquePollingKey("queue:some-due")
		require.NoError(t, rdb.ZAdd(ctx, queueKey,
			&redis.Z{Score: 50, Member: "due-1"},
			&redis.Z{Score: 60, Member: "due-2"},
			&redis.Z{Score: 100, Member: "due-3"},
			&redis.Z{Score: 101, Member: "future-1"},
			&redis.Z{Score: 102, Member: "future-2"},
		).Err())

		members := evalPopDueTasksScript(t, ctx, rdb, queueKey, 100, 10, 60)
		require.Len(t, members, 3)
		sort.Strings(members)
		require.Equal(t, []string{"due-1", "due-2", "due-3"}, members)
	})

	t.Run("limit respected", func(t *testing.T) {
		queueKey := uniquePollingKey("queue:limit")
		require.NoError(t, rdb.ZAdd(ctx, queueKey,
			&redis.Z{Score: 1, Member: "d-1"},
			&redis.Z{Score: 2, Member: "d-2"},
			&redis.Z{Score: 3, Member: "d-3"},
			&redis.Z{Score: 4, Member: "d-4"},
			&redis.Z{Score: 5, Member: "d-5"},
		).Err())

		members := evalPopDueTasksScript(t, ctx, rdb, queueKey, 100, 2, 60)
		require.Len(t, members, 2)
		require.Equal(t, []string{"d-1", "d-2"}, members)
	})

	t.Run("score bumped after pop", func(t *testing.T) {
		queueKey := uniquePollingKey("queue:bump")
		now := int64(1_000)
		leaseSeconds := int64(120)
		require.NoError(t, rdb.ZAdd(ctx, queueKey,
			&redis.Z{Score: 10, Member: "b-1"},
			&redis.Z{Score: 20, Member: "b-2"},
		).Err())

		members := evalPopDueTasksScript(t, ctx, rdb, queueKey, now, 10, leaseSeconds)
		require.ElementsMatch(t, []string{"b-1", "b-2"}, members)

		expected := float64(now + leaseSeconds)
		for _, id := range members {
			score, err := rdb.ZScore(ctx, queueKey, id).Result()
			require.NoError(t, err)
			require.Equal(t, expected, score)
		}
	})
}

func TestRescheduleTask(t *testing.T) {
	ctx, rdb := setupTaskPollingQueueRedis(t)

	t.Run("existing member", func(t *testing.T) {
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)
		id := uniqueTaskID("reschedule-existing")
		require.NoError(t, rdb.ZAdd(ctx, taskPollingPendingRedisKey, &redis.Z{Score: 100, Member: id}).Err())

		RescheduleTask(id, 500)

		score, err := rdb.ZScore(ctx, taskPollingPendingRedisKey, id).Result()
		require.NoError(t, err)
		require.Equal(t, float64(500), score)
	})

	t.Run("non-existing member", func(t *testing.T) {
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)
		id := uniqueTaskID("reschedule-missing")

		RescheduleTask(id, 700)

		_, err := rdb.ZScore(ctx, taskPollingPendingRedisKey, id).Result()
		require.ErrorIs(t, err, redis.Nil)
	})

	t.Run("empty taskID", func(t *testing.T) {
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)
		require.NotPanics(t, func() {
			RescheduleTask("", 999)
		})
	})
}

func TestAddTaskToPollingQueue(t *testing.T) {
	ctx, rdb := setupTaskPollingQueueRedis(t)

	t.Run("normal add", func(t *testing.T) {
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)
		id := uniqueTaskID("add-normal")
		submitTime := int64(123456)

		AddTaskToPollingQueue(id, submitTime)

		score, err := rdb.ZScore(ctx, taskPollingPendingRedisKey, id).Result()
		require.NoError(t, err)
		require.Equal(t, float64(submitTime), score)

		member, err := rdb.SIsMember(ctx, taskPollingPendingLegacyKey, id).Result()
		require.NoError(t, err)
		require.True(t, member)
	})

	t.Run("duplicate add does not overwrite score", func(t *testing.T) {
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)
		id := uniqueTaskID("add-dup")

		AddTaskToPollingQueue(id, 100)
		AddTaskToPollingQueue(id, 999)

		score, err := rdb.ZScore(ctx, taskPollingPendingRedisKey, id).Result()
		require.NoError(t, err)
		require.Equal(t, float64(100), score)
	})

	t.Run("also writes to legacy set", func(t *testing.T) {
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)
		id := uniqueTaskID("add-legacy")

		AddTaskToPollingQueue(id, 111)

		member, err := rdb.SIsMember(ctx, taskPollingPendingLegacyKey, id).Result()
		require.NoError(t, err)
		require.True(t, member)
	})
}

func TestRemoveTaskFromPollingQueue(t *testing.T) {
	ctx, rdb := setupTaskPollingQueueRedis(t)

	t.Run("removes from both zset and legacy set", func(t *testing.T) {
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)
		id := uniqueTaskID("remove-both")
		require.NoError(t, rdb.ZAdd(ctx, taskPollingPendingRedisKey, &redis.Z{Score: 88, Member: id}).Err())
		require.NoError(t, rdb.SAdd(ctx, taskPollingPendingLegacyKey, id).Err())

		RemoveTaskFromPollingQueue(id)

		_, err := rdb.ZScore(ctx, taskPollingPendingRedisKey, id).Result()
		require.ErrorIs(t, err, redis.Nil)
		member, err := rdb.SIsMember(ctx, taskPollingPendingLegacyKey, id).Result()
		require.NoError(t, err)
		require.False(t, member)
	})

	t.Run("removes lock key", func(t *testing.T) {
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)
		id := uniqueTaskID("remove-lock")
		lockKey := taskPollingLockKey(id)
		require.NoError(t, rdb.Set(ctx, lockKey, "token", time.Minute).Err())

		RemoveTaskFromPollingQueue(id)

		exists, err := rdb.Exists(ctx, lockKey).Result()
		require.NoError(t, err)
		require.Equal(t, int64(0), exists)
	})
}

func TestDrainLegacyKeyIfNeeded(t *testing.T) {
	ctx, rdb := setupTaskPollingQueueRedis(t)

	t.Run("legacy set empty", func(t *testing.T) {
		truncate(t)
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)

		drainLegacyKeyIfNeeded(ctx)

		count, err := rdb.ZCard(ctx, taskPollingPendingRedisKey).Result()
		require.NoError(t, err)
		require.Equal(t, int64(0), count)
	})

	t.Run("legacy set has members", func(t *testing.T) {
		truncate(t)
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)

		id1 := uniqueTaskID("legacy-1")
		id2 := uniqueTaskID("legacy-2")
		seedPollingTaskRow(t, id1, 111)
		seedPollingTaskRow(t, id2, 222)
		require.NoError(t, rdb.SAdd(ctx, taskPollingPendingLegacyKey, id1, id2).Err())

		drainLegacyKeyIfNeeded(ctx)

		score1, err := rdb.ZScore(ctx, taskPollingPendingRedisKey, id1).Result()
		require.NoError(t, err)
		require.Equal(t, float64(111), score1)

		score2, err := rdb.ZScore(ctx, taskPollingPendingRedisKey, id2).Result()
		require.NoError(t, err)
		require.Equal(t, float64(222), score2)

		legacyCount, err := rdb.SCard(ctx, taskPollingPendingLegacyKey).Result()
		require.NoError(t, err)
		require.Equal(t, int64(0), legacyCount)
	})
}

func TestRebuildPollingQueueFromDB(t *testing.T) {
	ctx, rdb := setupTaskPollingQueueRedis(t)

	t.Run("pagination", func(t *testing.T) {
		truncate(t)
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)

		total := rebuildPollingQueuePageSize + 250
		for i := 0; i < total; i++ {
			seedPollingTaskRow(t, uniqueTaskID(fmt.Sprintf("rebuild-page-%d", i)), int64(10_000+i))
		}

		RebuildPollingQueueFromDB()

		count, err := rdb.ZCard(ctx, taskPollingPendingRedisKey).Result()
		require.NoError(t, err)
		require.Equal(t, int64(total), count)
	})

	t.Run("empty taskID rows", func(t *testing.T) {
		truncate(t)
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)

		for i := 0; i < rebuildPollingQueuePageSize; i++ {
			seedPollingTaskRow(t, "", int64(20_000+i))
		}
		validID := uniqueTaskID("rebuild-valid")
		seedPollingTaskRow(t, validID, 30_000)

		done := make(chan struct{})
		go func() {
			RebuildPollingQueueFromDB()
			close(done)
		}()

		select {
		case <-done:
		case <-time.After(2 * time.Second):
			t.Fatal("RebuildPollingQueueFromDB timed out, possible infinite loop on empty taskID rows")
		}

		count, err := rdb.ZCard(ctx, taskPollingPendingRedisKey).Result()
		require.NoError(t, err)
		require.Equal(t, int64(1), count)
		score, err := rdb.ZScore(ctx, taskPollingPendingRedisKey, validID).Result()
		require.NoError(t, err)
		require.Equal(t, float64(30_000), score)
	})
}

func TestMigratePollingQueueLegacyKey_ZAddFailure(t *testing.T) {
	ctx, rdb := setupTaskPollingQueueRedis(t)
	cleanupTaskPollingQueueRedisState(t, ctx, rdb)

	id1 := uniqueTaskID("legacy-migrate-fail-1")
	id2 := uniqueTaskID("legacy-migrate-fail-2")
	id3 := uniqueTaskID("legacy-migrate-fail-3")
	ids := []string{id1, id2, id3}
	require.NoError(t, rdb.SAdd(ctx, taskPollingPendingLegacyKey, id1, id2, id3).Err())

	// Corrupt target zset key type to force WRONGTYPE on ZAddNX.
	require.NoError(t, rdb.Set(ctx, taskPollingPendingRedisKey, "corrupted", 0).Err())

	migratePollingQueueLegacyKey(ctx)

	for _, id := range ids {
		member, err := rdb.SIsMember(ctx, taskPollingPendingLegacyKey, id).Result()
		require.NoError(t, err)
		require.True(t, member)
	}
}

func TestDrainLegacyKeyIfNeeded_RedisError(t *testing.T) {
	oldRDB := common.RDB
	oldEnabled := common.RedisEnabled
	t.Cleanup(func() {
		common.RDB = oldRDB
		common.RedisEnabled = oldEnabled
	})

	common.RDB = nil
	common.RedisEnabled = true

	require.NotPanics(t, func() {
		drainLegacyKeyIfNeeded(context.Background())
	})
}

func setupTaskPollingQueueRedis(t *testing.T) (context.Context, *redis.Client) {
	t.Helper()

	redisURL := strings.TrimSpace(os.Getenv("REDIS_CONN_STRING"))
	if redisURL == "" {
		t.Skip("Redis not available: REDIS_CONN_STRING not set")
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Skipf("Redis not available: parse REDIS_CONN_STRING failed: %v", err)
	}

	rdb := redis.NewClient(opt)
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		_ = rdb.Close()
		t.Skipf("Redis not available: %v", err)
	}

	oldRDB := common.RDB
	oldEnabled := common.RedisEnabled
	common.RDB = rdb
	common.RedisEnabled = true

	cleanupTaskPollingQueueRedisState(t, ctx, rdb)
	truncate(t)
	t.Cleanup(func() {
		cleanupTaskPollingQueueRedisState(t, ctx, rdb)
		_ = rdb.Close()
		common.RDB = oldRDB
		common.RedisEnabled = oldEnabled
	})

	return ctx, rdb
}

func cleanupTaskPollingQueueRedisState(t *testing.T, ctx context.Context, rdb *redis.Client) {
	t.Helper()

	require.NoError(t, rdb.Del(ctx, taskPollingPendingRedisKey, taskPollingPendingLegacyKey).Err())
	lockKeys, err := rdb.Keys(ctx, taskPollingLockKeyPrefix+"*").Result()
	require.NoError(t, err)
	if len(lockKeys) > 0 {
		require.NoError(t, rdb.Del(ctx, lockKeys...).Err())
	}
}

func seedPollingTaskRow(t *testing.T, taskID string, submitTime int64) *model.Task {
	t.Helper()
	now := time.Now().Unix()
	task := &model.Task{
		TaskID:     taskID,
		SubmitTime: submitTime,
		Progress:   "0%",
		Status:     model.TaskStatusInProgress,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, model.DB.Create(task).Error)
	return task
}

func evalPopDueTasksScript(t *testing.T, ctx context.Context, rdb *redis.Client, queueKey string, now int64, limit int, leaseSeconds int64) []string {
	t.Helper()
	result, err := rdb.Eval(ctx, popDueTasksScript, []string{queueKey}, now, limit, leaseSeconds).Result()
	require.NoError(t, err)

	raw, ok := result.([]interface{})
	require.True(t, ok)
	members := make([]string, 0, len(raw))
	for _, item := range raw {
		member, ok := item.(string)
		require.True(t, ok)
		members = append(members, member)
	}
	return members
}

func uniqueTaskID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func uniquePollingKey(prefix string) string {
	return fmt.Sprintf("task:poll:test:%s:%d", prefix, time.Now().UnixNano())
}
