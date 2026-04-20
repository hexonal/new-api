package service

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func normalizePolledTaskStatus(task *model.Task, taskResult *relaycommon.TaskInfo) model.TaskStatus {
	status := model.TaskStatus(taskResult.Status)
	if task == nil || task.Platform != constant.TaskPlatformImage || status != model.TaskStatusNotStart {
		return status
	}
	return model.TaskStatusSubmitted
}
