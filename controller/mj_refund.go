package controller

import (
	"context"
	"fmt"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

func resolveMJRefundToken(task *model.Midjourney) (int, string, string) {
	if task == nil || task.MjId == "" {
		return 0, "", ""
	}
	modelName := service.CovertMjpActionToModelName(task.Action)
	var consume model.Log

	// Prefer structured task_id in other; keep content fallback for historical logs.
	err := model.LOG_DB.
		Where(
			"type = ? AND user_id = ? AND channel_id = ? AND model_name = ? AND (other LIKE ? OR content LIKE ?)",
			model.LogTypeConsume,
			task.UserId,
			task.ChannelId,
			modelName,
			fmt.Sprintf("%%\"task_id\":\"%s\"%%", task.MjId),
			fmt.Sprintf("%%ID %s%%", task.MjId),
		).
		Order("id DESC").
		First(&consume).Error
	if err != nil {
		return 0, "", ""
	}
	return consume.TokenId, consume.TokenName, consume.Group
}

func refundMJTaskCharge(ctx context.Context, task *model.Midjourney, reason string) {
	if task == nil || task.Quota == 0 {
		return
	}
	if err := model.IncreaseUserQuota(task.UserId, task.Quota, false); err != nil {
		logger.LogError(ctx, fmt.Sprintf("mj refund user quota failed for %s: %v", task.MjId, err))
		return
	}

	tokenID, tokenName, refundGroup := resolveMJRefundToken(task)
	if tokenID > 0 {
		if token, err := model.GetTokenById(tokenID); err == nil && token != nil {
			if err := model.IncreaseTokenQuota(tokenID, token.Key, task.Quota); err != nil {
				logger.LogError(ctx, fmt.Sprintf("mj refund token quota failed for %s token=%d: %v", task.MjId, tokenID, err))
			}
		}
	}

	other := map[string]any{
		"task_id": task.MjId,
		"reason":  reason,
	}
	if tokenID > 0 {
		other["token_id"] = tokenID
	}
	if tokenName != "" {
		other["token_name"] = tokenName
	}

	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   model.LogTypeRefund,
		Content:   "",
		ChannelId: task.ChannelId,
		ModelName: service.CovertMjpActionToModelName(task.Action),
		Quota:     task.Quota,
		TokenId:   tokenID,
		Group:     refundGroup,
		Other:     other,
	})
}
