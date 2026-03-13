package model

import "testing"

func TestToOpenAIVideo_CompletedAtUsesFinishTimeForTerminalStatus(t *testing.T) {
	task := &Task{
		TaskID:      "task_terminal",
		Status:      TaskStatusFailure,
		Progress:    "100%",
		CreatedAt:   1000,
		UpdatedAt:   3000,
		FinishTime:  2000,
		Properties:  Properties{OriginModelName: "ima-pro"},
		FailReason:  "failed reason",
		PrivateData: TaskPrivateData{},
	}

	video := task.ToOpenAIVideo()
	if video.CompletedAt != 2000 {
		t.Fatalf("video.CompletedAt = %d, want 2000", video.CompletedAt)
	}
}

func TestToOpenAIVideo_InProgressShouldNotExposeCompletedAt(t *testing.T) {
	task := &Task{
		TaskID:      "task_running",
		Status:      TaskStatusInProgress,
		Progress:    "30%",
		CreatedAt:   1000,
		UpdatedAt:   3000,
		FinishTime:  0,
		Properties:  Properties{OriginModelName: "ima-pro"},
		PrivateData: TaskPrivateData{},
	}

	video := task.ToOpenAIVideo()
	if video.CompletedAt != 0 {
		t.Fatalf("video.CompletedAt = %d, want 0", video.CompletedAt)
	}
}
