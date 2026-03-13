package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
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
