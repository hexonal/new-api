package service

import (
	"context"
	"fmt"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// reconcileTaskTerminalTransition unifies terminal transition handling for async tasks.
// It keeps existing semantics in one place:
// 1) CAS status update
// 2) success settle / failure refund
// 3) enqueue terminal callback when CAS transition wins
func reconcileTaskTerminalTransition(
	ctx context.Context,
	adaptor TaskPollingAdaptor,
	task *model.Task,
	taskResult *relaycommon.TaskInfo,
	fromStatus model.TaskStatus,
	snapshotUnchanged bool,
	shouldSettle bool,
	shouldRefund bool,
) {
	isDone := task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure
	terminalTransitionWon := false
	if isDone && fromStatus != task.Status {
		won, err := task.UpdateWithStatus(fromStatus)
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("UpdateWithStatus failed for task %s: %s", task.TaskID, err.Error()))
			shouldRefund = false
			shouldSettle = false
		} else if !won {
			logger.LogWarn(ctx, fmt.Sprintf("Task %s already transitioned by another process, skip billing", task.TaskID))
			shouldRefund = false
			shouldSettle = false
		} else {
			terminalTransitionWon = true
		}
	} else if !snapshotUnchanged {
		if _, err := task.UpdateWithStatus(fromStatus); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Failed to update task %s: %s", task.TaskID, err.Error()))
		}
	} else {
		// No changes, skip update
		logger.LogDebug(ctx, fmt.Sprintf("No update needed for task %s", task.TaskID))
	}

	if shouldSettle {
		settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)
	}
	if shouldRefund {
		RefundTaskQuota(ctx, task, task.FailReason)
	}
	if terminalTransitionWon {
		if callbackErr := EnqueueVideoTaskTerminalCallback(ctx, task); callbackErr != nil {
			logger.LogError(ctx, fmt.Sprintf("enqueue video task callback failed for task %s: %s", task.TaskID, callbackErr.Error()))
		}
	}
	if isDone {
		RemoveTaskFromPollingQueue(task.TaskID)
	}
}
