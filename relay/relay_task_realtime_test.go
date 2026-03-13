package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestApplyRealtimeTaskInfoToTask_FailureSetsReasonAndCompleteProgress(t *testing.T) {
	task := &model.Task{
		TaskID:   "task_demo_1",
		Status:   model.TaskStatusInProgress,
		Progress: "30%",
	}
	ti := &relaycommon.TaskInfo{
		Status:   model.TaskStatusFailure,
		Progress: "30%",
		Reason:   "video generation failed: internal error: 601300",
	}

	applyRealtimeTaskInfoToTask(task, ti)

	if task.Status != model.TaskStatusFailure {
		t.Fatalf("task.Status = %q, want %q", task.Status, model.TaskStatusFailure)
	}
	if task.Progress != "100%" {
		t.Fatalf("task.Progress = %q, want 100%%", task.Progress)
	}
	if task.FailReason != "video generation failed: internal error: 601300" {
		t.Fatalf("task.FailReason = %q, want upstream reason", task.FailReason)
	}
}

func TestApplyRealtimeTaskInfoToTask_FailureWithoutReasonKeepsExisting(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_demo_2",
		Status:     model.TaskStatusInProgress,
		Progress:   "80%",
		FailReason: "existing reason",
	}
	ti := &relaycommon.TaskInfo{
		Status:   model.TaskStatusFailure,
		Progress: "10%",
		Reason:   "",
	}

	applyRealtimeTaskInfoToTask(task, ti)

	if task.FailReason != "existing reason" {
		t.Fatalf("task.FailReason = %q, want existing reason", task.FailReason)
	}
	if task.Progress != "100%" {
		t.Fatalf("task.Progress = %q, want 100%%", task.Progress)
	}
}
