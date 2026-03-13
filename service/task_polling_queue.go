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
)

const (
	taskPollingPendingRedisKey = "task:poll:pending"
	taskPollingLockKeyPrefix   = "task:poll:lock:"
	taskPollingLockTTL         = 120 * time.Second
)

// AddTaskToPollingQueue tracks task_id in Redis to avoid full-table polling scans.
func AddTaskToPollingQueue(taskID string) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" || !common.RedisEnabled || common.RDB == nil {
		return
	}
	if err := common.RDB.SAdd(context.Background(), taskPollingPendingRedisKey, taskID).Err(); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("add task to polling queue failed, task_id=%s err=%v", taskID, err))
	}
}

// RemoveTaskFromPollingQueue removes terminal task_id from Redis polling queue.
func RemoveTaskFromPollingQueue(taskID string) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" || !common.RedisEnabled || common.RDB == nil {
		return
	}
	ctx := context.Background()
	if err := common.RDB.SRem(ctx, taskPollingPendingRedisKey, taskID).Err(); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("remove task from polling queue failed, task_id=%s err=%v", taskID, err))
	}
	if err := common.RDB.Del(ctx, taskPollingLockKey(taskID)).Err(); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("remove task polling lock failed, task_id=%s err=%v", taskID, err))
	}
}

func getPendingTaskIDsFromRedis(limit int) ([]string, error) {
	if limit <= 0 || !common.RedisEnabled || common.RDB == nil {
		return nil, nil
	}
	rawIDs, err := common.RDB.SRandMemberN(context.Background(), taskPollingPendingRedisKey, int64(limit)).Result()
	if err != nil {
		return nil, err
	}
	if len(rawIDs) == 0 {
		return nil, nil
	}
	ids := make([]string, 0, len(rawIDs))
	seen := make(map[string]struct{}, len(rawIDs))
	for _, id := range rawIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids, nil
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
		AddTaskToPollingQueue(task.TaskID)
	}
	return tasks
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
