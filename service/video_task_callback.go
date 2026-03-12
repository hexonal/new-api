package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	videoTaskCallbackEventType = "video.task.terminal"
	videoTaskCallbackHeaderKey = "X-NewAPI-Event"
)

// ValidateVideoTaskCallbackURL validates a task callback URL using system fetch/SSRF policy.
// Empty URL is treated as disabled and therefore valid.
func ValidateVideoTaskCallbackURL(rawURL string) error {
	callbackURL := strings.TrimSpace(rawURL)
	if callbackURL == "" {
		return nil
	}
	fetchSetting := system_setting.GetFetchSetting()
	return common.ValidateURLWithFetchSetting(
		callbackURL,
		fetchSetting.EnableSSRFProtection,
		fetchSetting.AllowPrivateIp,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		fetchSetting.ApplyIPFilterForDomain,
	)
}

// EnqueueVideoTaskTerminalCallback writes a durable callback event for terminal video task state.
// The event is dispatched asynchronously by callback dispatcher.
func EnqueueVideoTaskTerminalCallback(ctx context.Context, task *model.Task) error {
	if task == nil {
		return nil
	}
	callbackURL := strings.TrimSpace(task.PrivateData.CallbackURL)
	if callbackURL == "" {
		return nil
	}

	if err := ValidateVideoTaskCallbackURL(callbackURL); err != nil {
		return err
	}

	openAIVideo := task.ToOpenAIVideo()
	if task.FailReason != "" {
		openAIVideo.SetMetadata("reason", task.FailReason)
	}

	payload := map[string]any{
		"event":            videoTaskCallbackEventType,
		"task_id":          task.TaskID,
		"upstream_task_id": task.GetUpstreamTaskID(),
		"status":           string(task.Status),
		"progress":         task.Progress,
		"model":            task.Properties.OriginModelName,
		"url":              task.GetResultURL(),
		"reason":           task.FailReason,
		"user_id":          task.UserId,
		"channel_id":       task.ChannelId,
		"submit_time":      task.SubmitTime,
		"finish_time":      task.FinishTime,
		"openai_video":     openAIVideo,
	}

	body, err := common.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal video task callback payload failed: %w", err)
	}

	idempotencyKey := fmt.Sprintf(
		"video_task_callback:%s:%s:%d",
		task.TaskID,
		task.Status,
		task.FinishTime,
	)

	if err := enqueuePersistentCallbackEvent(callbackEventEnqueueRequest{
		Source:      model.CallbackEventSourceVideoTask,
		EventType:   videoTaskCallbackEventType,
		SinkType:    model.CallbackEventSinkVideoTaskWebhook,
		UserID:      task.UserId,
		TokenID:     task.PrivateData.TokenId,
		CallbackURL: callbackURL,
		HTTPMethod:  "POST",
		Headers: map[string]string{
			videoTaskCallbackHeaderKey: videoTaskCallbackEventType,
		},
		ContentType:    "application/json",
		Payload:        body,
		IdempotencyKey: idempotencyKey,
	}); err != nil {
		return fmt.Errorf("enqueue video task callback failed: %w", err)
	}

	loggerMessage := fmt.Sprintf("video task callback enqueued: task_id=%s status=%s", task.TaskID, task.Status)
	if ctx == nil {
		common.SysLog(loggerMessage)
	} else {
		logger.LogInfo(ctx, loggerMessage)
	}
	return nil
}
