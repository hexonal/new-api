package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// ApplyExternalTaskStateUpdate applies task state from provider callback/push payload.
// It keeps terminal transition semantics consistent with polling flow:
// CAS update -> settle/refund -> enqueue callback_event.
// This function is intentionally generic for future provider callback reuse.
func ApplyExternalTaskStateUpdate(
	ctx context.Context,
	task *model.Task,
	taskInfo *relaycommon.TaskInfo,
	rawPayload []byte,
	source string,
	explicitFinishAt int64,
) (terminalTransitionWon bool, err error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if task == nil {
		return false, errors.New("task is nil")
	}
	if taskInfo == nil {
		return false, errors.New("taskInfo is nil")
	}

	snap := task.Snapshot()
	now := time.Now().Unix()
	status := model.TaskStatus(strings.TrimSpace(taskInfo.Status))
	fromStatus := snap.Status
	fromTerminal := isTaskTerminalStatus(fromStatus)

	switch status {
	case model.TaskStatusSubmitted:
		task.Progress = taskcommon.ProgressSubmitted
	case model.TaskStatusQueued:
		task.Progress = taskcommon.ProgressQueued
	case model.TaskStatusInProgress:
		task.Progress = taskcommon.ProgressInProgress
		if task.StartTime == 0 {
			task.StartTime = now
		}
	case model.TaskStatusSuccess:
		task.Progress = taskcommon.ProgressComplete
		finishAt := explicitFinishAt
		if finishAt <= 0 {
			finishAt = now
		}
		if task.FinishTime == 0 {
			task.FinishTime = finishAt
		}
		if strings.HasPrefix(taskInfo.Url, "data:") {
			task.PrivateData.ResultURL = taskcommon.BuildProxyURL(task.TaskID)
		} else if strings.TrimSpace(taskInfo.Url) != "" {
			task.PrivateData.ResultURL = strings.TrimSpace(taskInfo.Url)
		} else {
			task.PrivateData.ResultURL = taskcommon.BuildProxyURL(task.TaskID)
		}
	case model.TaskStatusFailure:
		task.Progress = taskcommon.ProgressComplete
		finishAt := explicitFinishAt
		if finishAt <= 0 {
			finishAt = now
		}
		if task.FinishTime == 0 {
			task.FinishTime = finishAt
		}
	default:
		return false, fmt.Errorf("unsupported task status from callback: %q", taskInfo.Status)
	}

	// Do not allow terminal state rollback/flip from callback payload.
	// This protects against duplicate billing/callback and polling conflicts.
	if fromTerminal && status != fromStatus {
		logger.LogWarn(ctx, fmt.Sprintf(
			"ignore callback state regression: source=%s task_id=%s from=%s to=%s",
			source, task.TaskID, fromStatus, status,
		))
		return false, nil
	}

	task.Status = status
	if strings.TrimSpace(taskInfo.Progress) != "" {
		task.Progress = strings.TrimSpace(taskInfo.Progress)
	}
	if strings.TrimSpace(taskInfo.Reason) != "" {
		task.FailReason = strings.TrimSpace(taskInfo.Reason)
	}
	if len(rawPayload) > 0 {
		task.Data = redactVideoResponseBody(rawPayload)
	}

	shouldRefund := false
	shouldSettle := false
	terminalTransitionCandidate := !fromTerminal && isTaskTerminalStatus(task.Status)
	if terminalTransitionCandidate && task.Status == model.TaskStatusSuccess {
		shouldSettle = true
	}
	if terminalTransitionCandidate && task.Status == model.TaskStatusFailure && task.Quota != 0 && !IsDeferredSettleTask(task) {
		shouldRefund = true
	}
	if task.Status == model.TaskStatusFailure && IsDeferredSettleTask(task) && task.PrivateData.BillingContext != nil {
		task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStateSkipped
	}

	if terminalTransitionCandidate && fromStatus != task.Status {
		won, updateErr := task.UpdateWithStatus(fromStatus)
		if updateErr != nil {
			return false, fmt.Errorf("task update with status failed: %w", updateErr)
		}
		if !won {
			logger.LogWarn(ctx, fmt.Sprintf("task callback skipped due to CAS miss: source=%s task_id=%s", source, task.TaskID))
			return false, nil
		}
		terminalTransitionWon = true
	} else if !snap.Equal(task.Snapshot()) {
		won, updateErr := task.UpdateWithStatus(fromStatus)
		if updateErr != nil {
			return false, fmt.Errorf("task state patch update failed: %w", updateErr)
		}
		if !won {
			logger.LogWarn(ctx, fmt.Sprintf("task state patch CAS miss: source=%s task_id=%s", source, task.TaskID))
			return false, nil
		}
	}

	if terminalTransitionWon {
		settleAdaptor := getTaskPollingAdaptorOrNoop(task.Platform)
		if shouldSettle {
			settleTaskBillingOnComplete(ctx, settleAdaptor, task, taskInfo)
		}
		if shouldRefund {
			RefundTaskQuota(ctx, task, task.FailReason)
		}
		if callbackErr := EnqueueVideoTaskTerminalCallback(ctx, task); callbackErr != nil {
			return true, fmt.Errorf("enqueue video task callback failed: %w", callbackErr)
		}
	}

	return terminalTransitionWon, nil
}

func isTaskTerminalStatus(status model.TaskStatus) bool {
	return status == model.TaskStatusSuccess || status == model.TaskStatusFailure
}

func getTaskPollingAdaptorOrNoop(platform constant.TaskPlatform) TaskPollingAdaptor {
	if GetTaskAdaptorFunc != nil {
		if adaptor := GetTaskAdaptorFunc(platform); adaptor != nil {
			return adaptor
		}
	}
	return noopTaskPollingAdaptor{}
}

type noopTaskPollingAdaptor struct{}

func (noopTaskPollingAdaptor) Init(_ *relaycommon.RelayInfo) {}

func (noopTaskPollingAdaptor) FetchTask(_ string, _ string, _ map[string]any, _ string) (*http.Response, error) {
	return nil, errors.New("noop adaptor does not support fetch")
}

func (noopTaskPollingAdaptor) ParseTaskResult(_ []byte) (*relaycommon.TaskInfo, error) {
	return nil, errors.New("noop adaptor does not support parse")
}

func (noopTaskPollingAdaptor) AdjustBillingOnComplete(_ *model.Task, _ *relaycommon.TaskInfo) int {
	return 0
}
