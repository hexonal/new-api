package service

import (
	"strconv"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// openaiImageTaskStatusMap 将 ai-router /v1/images/{id} 响应的字面 status
// 翻译为 new-api 内部 TaskStatus 枚举。
// new-api task_polling 对 IsSuccess()==true 的 envelope 会短路 adaptor.ParseTaskResult，
// 直接拿 envelope.data.status 字符串，因此需要在 normalize 阶段补 mapping。
var openaiImageTaskStatusMap = map[string]model.TaskStatus{
	"queued":      model.TaskStatusQueued,
	"processing":  model.TaskStatusInProgress,
	"in_progress": model.TaskStatusInProgress,
	"running":     model.TaskStatusInProgress,
	"succeeded":   model.TaskStatusSuccess,
	"completed":   model.TaskStatusSuccess,
	"failed":      model.TaskStatusFailure,
	"cancelled":   model.TaskStatusFailure,
}

func normalizePolledTaskStatus(task *model.Task, taskResult *relaycommon.TaskInfo) model.TaskStatus {
	if task != nil && task.Platform == constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeOpenAIImageTask)) {
		if mapped, ok := openaiImageTaskStatusMap[taskResult.Status]; ok {
			return mapped
		}
	}
	status := model.TaskStatus(taskResult.Status)
	if task == nil || task.Platform != constant.TaskPlatformImage || status != model.TaskStatusNotStart {
		return status
	}
	return model.TaskStatusSubmitted
}
