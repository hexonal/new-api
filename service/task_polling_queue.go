package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-redis/redis/v8"
)

const (
	taskPollingPendingRedisKey  = "task:poll:pending:zset"
	taskPollingPendingLegacyKey = "task:poll:pending"
	taskPollingLockKeyPrefix    = "task:poll:lock:"
	taskPollingLockTTL          = 120 * time.Second
	rebuildPollingQueuePageSize = 1000
)

const popDueTasksScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local lease = tonumber(ARGV[3])
local members = redis.call('ZRANGEBYSCORE', key, '-inf', tostring(now), 'LIMIT', 0, limit)
if #members == 0 then return {} end
for i, m in ipairs(members) do
    redis.call('ZADD', key, 'XX', tostring(now + lease), m)
end
return members
`

// AddTaskToPollingQueue tracks task_id in Redis to avoid full-table polling scans.
func AddTaskToPollingQueue(taskID string, submitTime int64) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" || !common.RedisEnabled || common.RDB == nil {
		return
	}
	ctx := context.Background()
	if err := common.RDB.ZAddNX(ctx, taskPollingPendingRedisKey, &redis.Z{
		Score:  float64(submitTime),
		Member: taskID,
	}).Err(); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("add task to polling queue failed, task_id=%s err=%v", taskID, err))
	}
	// Compat: also write to legacy Set for old-version nodes during rolling deploy
	if err := common.RDB.SAdd(ctx, taskPollingPendingLegacyKey, taskID).Err(); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("add task to legacy polling queue failed, task_id=%s err=%v", taskID, err))
	}
}

func AddTaskToPollingQueueNow(taskID string) {
	AddTaskToPollingQueue(taskID, time.Now().Unix())
}

// RemoveTaskFromPollingQueue removes terminal task_id from Redis polling queue.
func RemoveTaskFromPollingQueue(taskID string) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" || !common.RedisEnabled || common.RDB == nil {
		return
	}
	ctx := context.Background()
	if err := common.RDB.ZRem(ctx, taskPollingPendingRedisKey, taskID).Err(); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("remove task from polling queue failed, task_id=%s err=%v", taskID, err))
	}
	// Compat: also remove from legacy Set
	if err := common.RDB.SRem(ctx, taskPollingPendingLegacyKey, taskID).Err(); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("remove task from legacy polling queue failed, task_id=%s err=%v", taskID, err))
	}
	if err := common.RDB.Del(ctx, taskPollingLockKey(taskID)).Err(); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("remove task polling lock failed, task_id=%s err=%v", taskID, err))
	}
}

func getPendingTaskIDsFromRedis(limit int) ([]string, error) {
	if limit <= 0 || !common.RedisEnabled || common.RDB == nil {
		return nil, nil
	}
	drainLegacyKeyIfNeeded(context.Background())
	ctx := context.Background()
	now := float64(time.Now().Unix())

	result, err := common.RDB.Eval(ctx, popDueTasksScript, []string{taskPollingPendingRedisKey},
		now,
		limit,
		int(taskPollingLockTTL.Seconds()),
	).Result()
	if err != nil && err != redis.Nil {
		return nil, err
	}

	rawMembers, ok := result.([]interface{})
	if !ok || len(rawMembers) == 0 {
		return nil, nil
	}

	ids := make([]string, 0, len(rawMembers))
	for _, m := range rawMembers {
		id, ok := m.(string)
		if !ok {
			continue
		}
		id = strings.TrimSpace(id)
		if id != "" {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func RescheduleTask(taskID string, nextPollAt int64) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" || !common.RedisEnabled || common.RDB == nil {
		return
	}
	err := common.RDB.ZAddXX(context.Background(), taskPollingPendingRedisKey, &redis.Z{
		Score:  float64(nextPollAt),
		Member: taskID,
	}).Err()
	if err != nil {
		logger.LogWarn(context.Background(),
			fmt.Sprintf("reschedule task in polling queue failed, task_id=%s err=%v", taskID, err))
	}
}

func getPendingTasksForPolling(limit int) []*model.Task {
	if limit <= 0 {
		return nil
	}

	if taskIDs, err := getPendingTaskIDsFromRedis(limit); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("load pending task ids from redis failed: %v", err))
	} else if len(taskIDs) > 0 {
		tasks := model.GetTasksByTaskIDs(taskIDs)
		taskByID := make(map[string]*model.Task, len(tasks))
		for _, task := range tasks {
			if task == nil {
				continue
			}
			taskByID[task.TaskID] = task
		}

		active := make([]*model.Task, 0, len(taskIDs))
		for _, taskID := range taskIDs {
			task, ok := taskByID[taskID]
			if !ok || isTaskTerminalForPollingQueue(task) {
				RemoveTaskFromPollingQueue(taskID)
				continue
			}
			active = append(active, task)
		}
		if len(active) > 0 {
			return active
		}
	}

	// Fallback for cold start / redis miss / legacy tasks: scan DB then refill Redis.
	tasks := model.GetAllUnFinishSyncTasks(limit)
	for _, task := range tasks {
		if task == nil {
			continue
		}
		AddTaskToPollingQueue(task.TaskID, task.SubmitTime)
	}
	return tasks
}

func RebuildPollingQueueFromDB() {
	if !common.RedisEnabled || common.RDB == nil {
		return
	}
	ctx := context.Background()
	var lastID int64 = 0
	totalAdded := 0

	for {
		tasks := model.GetUnFinishSyncTasksPaginated(lastID, rebuildPollingQueuePageSize)
		if len(tasks) == 0 {
			break
		}
		for _, task := range tasks {
			if task == nil {
				continue
			}
			// Always advance lastID regardless of taskID validity to avoid livelock
			if task.ID > lastID {
				lastID = task.ID
			}
			taskID := strings.TrimSpace(task.TaskID)
			if taskID == "" {
				continue
			}
			if err := common.RDB.ZAddNX(ctx, taskPollingPendingRedisKey, &redis.Z{
				Score:  float64(task.SubmitTime),
				Member: taskID,
			}).Err(); err != nil {
				logger.LogWarn(ctx, fmt.Sprintf("rebuild: ZAddNX failed for task_id=%s: %v", taskID, err))
			} else {
				totalAdded++
			}
		}
		if len(tasks) < rebuildPollingQueuePageSize {
			break
		}
	}

	if totalAdded > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("rebuild polling queue from db done, added %d tasks", totalAdded))
	}

	// Keep existing legacy key migration logic unchanged.
	migratePollingQueueLegacyKey(ctx)
}

func drainLegacyKeyIfNeeded(ctx context.Context) {
	if !common.RedisEnabled || common.RDB == nil {
		return
	}
	n, err := common.RDB.SCard(ctx, taskPollingPendingLegacyKey).Result()
	if err != nil || n == 0 {
		return
	}
	migratePollingQueueLegacyKey(ctx)
}

func migratePollingQueueLegacyKey(ctx context.Context) {
	// Use SPOP to atomically drain legacy Set, safe under concurrent SAdd from old nodes.
	// Each SPOP removes and returns one member atomically — no window for lost writes.
	nowScore := float64(time.Now().Unix())
	batchSize := int64(100)

	for {
		// SPOP N: atomically pop up to batchSize members
		popped, err := common.RDB.SPopN(ctx, taskPollingPendingLegacyKey, batchSize).Result()
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("spop legacy polling queue failed: %v", err))
			return
		}
		if len(popped) == 0 {
			break // Set is empty
		}

		// Look up submit times from DB for correct score ordering
		cleanIDs := make([]string, 0, len(popped))
		for _, id := range popped {
			id = strings.TrimSpace(id)
			if id != "" {
				cleanIDs = append(cleanIDs, id)
			}
		}
		if len(cleanIDs) == 0 {
			continue
		}

		taskByID := make(map[string]*model.Task, len(cleanIDs))
		for _, task := range model.GetTasksByTaskIDs(cleanIDs) {
			if task != nil {
				taskByID[task.TaskID] = task
			}
		}

		members := make([]*redis.Z, 0, len(cleanIDs))
		for _, taskID := range cleanIDs {
			score := nowScore
			if task := taskByID[taskID]; task != nil {
				score = float64(task.SubmitTime)
			}
			members = append(members, &redis.Z{Score: score, Member: taskID})
		}

		if err := common.RDB.ZAddNX(ctx, taskPollingPendingRedisKey, members...).Err(); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("migrate legacy polling queue failed: %v", err))
			// SPOP already removed these members — reinsert to legacy Set to avoid data loss
			reinsert := make([]interface{}, len(cleanIDs))
			for i, id := range cleanIDs {
				reinsert[i] = id
			}
			if saErr := common.RDB.SAdd(ctx, taskPollingPendingLegacyKey, reinsert...).Err(); saErr != nil {
				logger.LogError(ctx, fmt.Sprintf("rollback legacy polling queue SADD failed: %v", saErr))
			}
			return
		}
	}
	// No DEL needed — SPOP already atomically removed all members
}

func isTaskTerminalForPollingQueue(task *model.Task) bool {
	if task == nil {
		return true
	}
	if task.Progress == "100%" {
		return true
	}
	return task.Status == model.TaskStatusFailure || task.Status == model.TaskStatusSuccess
}

func taskPollingLockKey(taskID string) string {
	return taskPollingLockKeyPrefix + strings.TrimSpace(taskID)
}

func getTaskPollingWorkerID() string {
	host, err := os.Hostname()
	if err != nil || strings.TrimSpace(host) == "" {
		host = "unknown-host"
	}
	return fmt.Sprintf("%s-%d", host, os.Getpid())
}

// tryAcquireTaskPollingLease returns (token, true) when the caller holds a lease.
// When Redis is unavailable, it falls back to no-op lease and allows processing.
func tryAcquireTaskPollingLease(taskID string) (string, bool) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return "", false
	}
	if !common.RedisEnabled || common.RDB == nil {
		return "", true
	}

	token := fmt.Sprintf("%s-%d", getTaskPollingWorkerID(), time.Now().UnixNano())
	ok, err := common.RDB.SetNX(context.Background(), taskPollingLockKey(taskID), token, taskPollingLockTTL).Result()
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("acquire task polling lease failed, task_id=%s err=%v", taskID, err))
		// degrade gracefully: keep polling available instead of stopping processing
		return "", true
	}
	if !ok {
		return "", false
	}
	return token, true
}

// releaseTaskPollingLease releases lease only when token matches.
func releaseTaskPollingLease(taskID string, token string) {
	taskID = strings.TrimSpace(taskID)
	token = strings.TrimSpace(token)
	if taskID == "" || token == "" || !common.RedisEnabled || common.RDB == nil {
		return
	}
	const compareAndDeleteScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`
	if err := common.RDB.Eval(context.Background(), compareAndDeleteScript, []string{taskPollingLockKey(taskID)}, token).Err(); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("release task polling lease failed, task_id=%s err=%v", taskID, err))
	}
}

func claimTaskPollingLeases(taskIDs []string) ([]string, map[string]string) {
	claimed := make([]string, 0, len(taskIDs))
	leaseTokens := make(map[string]string, len(taskIDs))
	for _, taskID := range taskIDs {
		token, ok := tryAcquireTaskPollingLease(taskID)
		if !ok {
			continue
		}
		claimed = append(claimed, taskID)
		leaseTokens[taskID] = token
	}
	return claimed, leaseTokens
}

func releaseClaimedTaskPollingLeases(leaseTokens map[string]string) {
	for taskID, token := range leaseTokens {
		releaseTaskPollingLease(taskID, token)
	}
}
