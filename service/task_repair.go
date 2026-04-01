package service

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const (
	repairLockKey     = "task:repair:startup_lock"
	repairLockTTL     = 5 * time.Minute
	repairStaleCutoff = 10 * time.Minute
	repairPageSize    = 100
)

// repairStuckBillingTasks runs once at startup (guarded by Redis distributed lock)
// to fix tasks stuck in "charging" intermediate billing state due to process crash.
// Only repairs tasks where terminal_charge_state = "charging" for > 10 minutes.
func repairStuckBillingTasks() {
	ctx := context.Background()

	if !acquireRepairLock(ctx) {
		common.SysLog("repairStuckBillingTasks: another instance holds the repair lock, skipping")
		return
	}

	common.SysLog("repairStuckBillingTasks: starting repair scan")
	repaired := repairStuckChargingTasks(ctx)
	common.SysLog(fmt.Sprintf("repairStuckBillingTasks: completed, repaired %d stuck charging tasks", repaired))
}

// acquireRepairLock tries to acquire a Redis NX lock for the repair job.
// Returns true if this instance won the lock. Falls back to true (allow repair)
// when Redis is unavailable (single-node deployment like zcheap.ai).
func acquireRepairLock(ctx context.Context) bool {
	if !common.RedisEnabled || common.RDB == nil {
		return true
	}
	ok, err := common.RDB.SetNX(ctx, repairLockKey, getTaskPollingWorkerID(), repairLockTTL).Result()
	if err != nil {
		common.SysLog(fmt.Sprintf("repairStuckBillingTasks: Redis SetNX failed: %v, proceeding anyway", err))
		return true
	}
	return ok
}

// repairStuckChargingTasks finds deferred-settle tasks where terminal_charge_state
// is "charging" for longer than repairStaleCutoff, and resets them to "pending".
func repairStuckChargingTasks(ctx context.Context) int {
	cutoffUnix := time.Now().Add(-repairStaleCutoff).Unix()
	repaired := 0
	var lastID int64

	for {
		var tasks []*model.Task
		var cond string
		switch {
		case common.UsingPostgreSQL:
			cond = "id > ? AND private_data::json->'billing_context'->>'terminal_charge_state' = 'charging' AND (private_data::json->'billing_context'->>'terminal_charge_at')::bigint < ?"
		case common.UsingMySQL:
			cond = "id > ? AND JSON_UNQUOTE(JSON_EXTRACT(private_data, '$.billing_context.terminal_charge_state')) = 'charging' AND CAST(JSON_UNQUOTE(JSON_EXTRACT(private_data, '$.billing_context.terminal_charge_at')) AS SIGNED) < ?"
		default:
			cond = "id > ? AND json_extract(private_data, '$.billing_context.terminal_charge_state') = 'charging' AND CAST(json_extract(private_data, '$.billing_context.terminal_charge_at') AS INTEGER) < ?"
		}

		err := model.DB.Where(cond, lastID, cutoffUnix).
			Order("id").
			Limit(repairPageSize).
			Find(&tasks).Error
		if err != nil {
			common.SysError(fmt.Sprintf("repairStuckChargingTasks: query failed: %v", err))
			break
		}
		if len(tasks) == 0 {
			break
		}

		for _, task := range tasks {
			if task == nil {
				continue
			}
			// Always advance cursor
			if task.ID > lastID {
				lastID = task.ID
			}
			if task.PrivateData.BillingContext == nil {
				continue
			}
			bc := task.PrivateData.BillingContext
			oldState := bc.TerminalChargeState
			oldChargeAt := bc.TerminalChargeAt

			if oldState != "charging" || oldChargeAt >= cutoffUnix {
				continue
			}

			bc.TerminalChargeState = TaskTerminalChargeStatePending

			if common.RedisEnabled && common.RDB != nil {
				common.RDB.Del(ctx, fmt.Sprintf("task:billing:charge:%s", task.TaskID))
			}

			if err := task.Update(); err != nil {
				common.SysError(fmt.Sprintf(
					"repairStuckChargingTasks: failed to reset task %s (id=%d): %v",
					task.TaskID, task.ID, err,
				))
				continue
			}

			if task.Status == model.TaskStatusSuccess {
				AddTaskToPollingQueueNow(task.TaskID)
			}

			repaired++
			common.SysLog(fmt.Sprintf(
				"repairStuckChargingTasks: repaired task_id=%s id=%d old_state=%s charge_at=%d",
				task.TaskID, task.ID, oldState, oldChargeAt,
			))
		}

		if len(tasks) < repairPageSize {
			break
		}
	}

	return repaired
}
