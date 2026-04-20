package controller

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
)

func normalizeSubmittedTaskState(task *model.Task, platform constant.TaskPlatform) {
	if task == nil || platform != constant.TaskPlatformImage || task.Status != model.TaskStatusNotStart {
		return
	}

	task.Status = model.TaskStatusSubmitted
	if task.Progress == "" || task.Progress == "0%" {
		task.Progress = taskcommon.ProgressSubmitted
	}
}
