package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const (
	TaskTerminalChargeStatePending = "pending"
	TaskTerminalChargeStateApplied = "applied"
	TaskTerminalChargeStateSkipped = "skipped"
)

// LogTaskConsumption 记录任务消费日志和统计信息（仅记录，不涉及实际扣费）。
// 实际扣费已由 BillingSession（PreConsumeBilling + SettleBilling）完成。
func LogTaskConsumption(c *gin.Context, info *relaycommon.RelayInfo) {
	tokenName := c.GetString("token_name")
	logContent := fmt.Sprintf("操作 %s", info.Action)
	perCallBilling := common.StringsContains(constant.TaskPricePatches, info.OriginModelName)
	if info.TaskRelayInfo != nil {
		perCallBilling = info.TaskRelayInfo.PerCallBilling
	}
	// 按次计费任务记录模式与 OtherRatios（如 duration/quality 乘数）。
	if perCallBilling {
		logContent = fmt.Sprintf(
			"%s，按次计费：model_price=%.6f, group_ratio=%.2f",
			logContent,
			info.PriceData.ModelPrice,
			info.PriceData.GroupRatioInfo.GroupRatio,
		)
		if len(info.PriceData.OtherRatios) > 0 {
			var contents []string
			for key, ra := range info.PriceData.OtherRatios {
				if ra != 1.0 {
					contents = append(contents, fmt.Sprintf("%s: %.2f", key, ra))
				}
			}
			if len(contents) > 0 {
				logContent = fmt.Sprintf("%s, 计算参数：%s", logContent, strings.Join(contents, ", "))
			}
		}
	} else {
		logContent = fmt.Sprintf(
			"%s，按量计费：model_ratio=%.6f, completion_ratio=%.6f, group_ratio=%.2f",
			logContent,
			info.PriceData.ModelRatio,
			info.PriceData.CompletionRatio,
			info.PriceData.GroupRatioInfo.GroupRatio,
		)
		if len(info.PriceData.OtherRatios) > 0 {
			var contents []string
			for key, ra := range info.PriceData.OtherRatios {
				if 1.0 != ra {
					contents = append(contents, fmt.Sprintf("%s: %.2f", key, ra))
				}
			}
			if len(contents) > 0 {
				logContent = fmt.Sprintf("%s, 计算参数：%s", logContent, strings.Join(contents, ", "))
			}
		}
	}
	other := make(map[string]interface{})
	other["request_path"] = c.Request.URL.Path
	other["model_price"] = info.PriceData.ModelPrice
	other["model_ratio"] = info.PriceData.ModelRatio
	other["completion_ratio"] = info.PriceData.CompletionRatio
	other["group_ratio"] = info.PriceData.GroupRatioInfo.GroupRatio
	if info.PriceData.GroupRatioInfo.GroupRatioSource != "" {
		other["group_ratio_source"] = string(info.PriceData.GroupRatioInfo.GroupRatioSource)
	}
	if info.PriceData.GroupRatioInfo.HasSpecialRatio {
		other["user_group_ratio"] = info.PriceData.GroupRatioInfo.GroupSpecialRatio
	}
	if len(info.PriceData.OtherRatios) > 0 {
		for key, value := range info.PriceData.OtherRatios {
			other[key] = value
		}
	}
	if info.IsModelMapped {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = info.UpstreamModelName
	}
	model.RecordConsumeLog(c, info.UserId, model.RecordConsumeLogParams{
		ChannelId:    info.ChannelId,
		ModelName:    info.OriginModelName,
		TokenName:    tokenName,
		Quota:        info.PriceData.Quota,
		Content:      logContent,
		TokenId:      info.TokenId,
		Group:        info.UsingGroup,
		PricingGroup: info.EffectivePricingGroup(),
		Other:        other,
	})
	model.UpdateUserUsedQuotaAndRequestCount(info.UserId, info.PriceData.Quota)
	model.UpdateChannelUsedQuota(info.ChannelId, info.PriceData.Quota)
}

// LogDeferredTaskSubmission writes a submit-phase consume log for deferred-settle tasks.
// It keeps request-level trace parity with non-deferred models while postponing real charging
// to terminal success settlement.
func LogDeferredTaskSubmission(c *gin.Context, info *relaycommon.RelayInfo, estimatedQuota int, taskID string) {
	tokenName := c.GetString("token_name")
	logContent := fmt.Sprintf(
		"操作 %s，延迟结算(提交阶段)：model_ratio=%.6f, completion_ratio=%.6f, group_ratio=%.2f",
		info.Action,
		info.PriceData.ModelRatio,
		info.PriceData.CompletionRatio,
		info.PriceData.GroupRatioInfo.GroupRatio,
	)
	if len(info.PriceData.OtherRatios) > 0 {
		var contents []string
		for key, ra := range info.PriceData.OtherRatios {
			if 1.0 != ra {
				contents = append(contents, fmt.Sprintf("%s: %.2f", key, ra))
			}
		}
		if len(contents) > 0 {
			logContent = fmt.Sprintf("%s, 计算参数：%s", logContent, strings.Join(contents, ", "))
		}
	}
	other := make(map[string]interface{})
	other["request_path"] = c.Request.URL.Path
	other["model_price"] = info.PriceData.ModelPrice
	other["model_ratio"] = info.PriceData.ModelRatio
	other["completion_ratio"] = info.PriceData.CompletionRatio
	other["group_ratio"] = info.PriceData.GroupRatioInfo.GroupRatio
	if info.PriceData.GroupRatioInfo.GroupRatioSource != "" {
		other["group_ratio_source"] = string(info.PriceData.GroupRatioInfo.GroupRatioSource)
	}
	if info.PriceData.GroupRatioInfo.HasSpecialRatio {
		other["user_group_ratio"] = info.PriceData.GroupRatioInfo.GroupSpecialRatio
	}
	if len(info.PriceData.OtherRatios) > 0 {
		for key, value := range info.PriceData.OtherRatios {
			other[key] = value
		}
	}
	if info.IsModelMapped {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = info.UpstreamModelName
	}
	other["deferred_settle"] = true
	other["terminal_charge_state"] = TaskTerminalChargeStatePending
	if estimatedQuota > 0 {
		other["estimated_quota"] = estimatedQuota
	}
	if strings.TrimSpace(taskID) != "" {
		other["task_id"] = taskID
	}
	model.RecordConsumeLog(c, info.UserId, model.RecordConsumeLogParams{
		ChannelId:    info.ChannelId,
		ModelName:    info.OriginModelName,
		TokenName:    tokenName,
		Quota:        0,
		Content:      logContent,
		TokenId:      info.TokenId,
		Group:        info.UsingGroup,
		PricingGroup: info.EffectivePricingGroup(),
		Other:        other,
	})
	// Keep request_count consistent with non-deferred task submit path.
	model.UpdateUserUsedQuotaAndRequestCount(info.UserId, 0)
	model.UpdateChannelUsedQuota(info.ChannelId, 0)
}

// ---------------------------------------------------------------------------
// 异步任务计费辅助函数
// ---------------------------------------------------------------------------

// resolveTokenKey 通过 TokenId 运行时获取令牌 Key（用于 Redis 缓存操作）。
// 如果令牌已被删除或查询失败，返回空字符串。
func resolveTokenKey(ctx context.Context, tokenId int, taskID string) string {
	token, err := model.GetTokenById(tokenId)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("获取令牌 key 失败 (tokenId=%d, task=%s): %s", tokenId, taskID, err.Error()))
		return ""
	}
	return token.Key
}

// taskIsSubscription 判断任务是否通过订阅计费。
func taskIsSubscription(task *model.Task) bool {
	return task.PrivateData.BillingSource == BillingSourceSubscription && task.PrivateData.SubscriptionId > 0
}

// taskAdjustFunding 调整任务的资金来源（钱包或订阅），delta > 0 表示扣费，delta < 0 表示退还。
func taskAdjustFunding(task *model.Task, delta int) error {
	if taskIsSubscription(task) {
		return model.PostConsumeUserSubscriptionDelta(task.PrivateData.SubscriptionId, int64(delta))
	}
	if delta > 0 {
		return model.DecreaseUserQuota(task.UserId, delta)
	}
	return model.IncreaseUserQuota(task.UserId, -delta, false)
}

// taskAdjustTokenQuota 调整任务的令牌额度，delta > 0 表示扣费，delta < 0 表示退还。
// 需要通过 resolveTokenKey 运行时获取 key（不从 PrivateData 中读取）。
func taskAdjustTokenQuota(ctx context.Context, task *model.Task, delta int) {
	if task.PrivateData.TokenId <= 0 || delta == 0 {
		return
	}
	tokenKey := resolveTokenKey(ctx, task.PrivateData.TokenId, task.TaskID)
	if tokenKey == "" {
		return
	}
	var err error
	if delta > 0 {
		err = model.DecreaseTokenQuota(task.PrivateData.TokenId, tokenKey, delta)
	} else {
		err = model.IncreaseTokenQuota(task.PrivateData.TokenId, tokenKey, -delta)
	}
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("调整令牌额度失败 (delta=%d, task=%s): %s", delta, task.TaskID, err.Error()))
	}
}

// taskBillingOther 从 task 的 BillingContext 构建日志 Other 字段。
func taskBillingOther(task *model.Task) map[string]interface{} {
	other := make(map[string]interface{})
	if bc := task.PrivateData.BillingContext; bc != nil {
		other["model_price"] = bc.ModelPrice
		other["group_ratio"] = bc.GroupRatio
		other["model_ratio"] = bc.ModelRatio
		if bc.CompletionRatio > 0 {
			other["completion_ratio"] = bc.CompletionRatio
		} else {
			other["completion_ratio"] = ratio_setting.GetCompletionRatio(taskModelName(task))
		}
		if strings.TrimSpace(bc.GroupRatioSource) != "" {
			other["group_ratio_source"] = bc.GroupRatioSource
		}
		if len(bc.OtherRatios) > 0 {
			for k, v := range bc.OtherRatios {
				other[k] = v
			}
		}
	}
	props := task.Properties
	if props.UpstreamModelName != "" && props.UpstreamModelName != props.OriginModelName {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = props.UpstreamModelName
	}
	return other
}

// taskModelName 从 BillingContext 或 Properties 中获取模型名称。
func taskModelName(task *model.Task) string {
	if bc := task.PrivateData.BillingContext; bc != nil && bc.OriginModelName != "" {
		return bc.OriginModelName
	}
	return task.Properties.OriginModelName
}

func readPositiveIntFromTaskData(data []byte, paths ...string) int {
	if len(data) == 0 {
		return 0
	}
	for _, path := range paths {
		v := gjson.GetBytes(data, path)
		if !v.Exists() {
			continue
		}
		switch v.Type {
		case gjson.Number:
			if n := int(v.Int()); n > 0 {
				return n
			}
		case gjson.String:
			raw := strings.TrimSpace(v.String())
			if raw == "" {
				continue
			}
			n, err := strconv.Atoi(raw)
			if err == nil && n > 0 {
				return n
			}
		}
	}
	return 0
}

func extractTaskThoughtTokens(task *model.Task) int {
	if task == nil {
		return 0
	}
	return readPositiveIntFromTaskData(task.Data,
		"usage.thought_tokens",
		"usage.thinking_tokens",
		"usage.reasoning_tokens",
		"usage.thoughts_tokens",
		"usage.thought_tokens_count",
		"data.usage.thought_tokens",
		"data.usage.thinking_tokens",
		"data.usage.reasoning_tokens",
		"response.usage.thought_tokens",
		"response.usage.thinking_tokens",
		"response.usage.reasoning_tokens",
		"metadata.usage.thought_tokens",
		"metadata.usage.thinking_tokens",
		"metadata.usage.reasoning_tokens",
	)
}

func extractTaskTokenUsage(task *model.Task) (promptTokens int, completionTokens int, totalTokens int) {
	if task == nil {
		return 0, 0, 0
	}

	promptTokens = readPositiveIntFromTaskData(task.Data,
		"usage.prompt_tokens",
		"usage.input_tokens",
		"data.usage.prompt_tokens",
		"data.usage.input_tokens",
		"response.usage.prompt_tokens",
		"response.usage.input_tokens",
		"metadata.usage.prompt_tokens",
		"metadata.usage.input_tokens",
	)
	completionTokens = readPositiveIntFromTaskData(task.Data,
		"usage.completion_tokens",
		"usage.output_tokens",
		"data.usage.completion_tokens",
		"data.usage.output_tokens",
		"response.usage.completion_tokens",
		"response.usage.output_tokens",
		"metadata.usage.completion_tokens",
		"metadata.usage.output_tokens",
	)
	totalTokens = readPositiveIntFromTaskData(task.Data,
		"usage.total_tokens",
		"data.usage.total_tokens",
		"response.usage.total_tokens",
		"metadata.usage.total_tokens",
	)

	if totalTokens <= 0 {
		totalTokens = promptTokens + completionTokens
	}

	// Some async video providers report only total usage.
	if promptTokens == 0 && completionTokens == 0 && totalTokens > 0 {
		completionTokens = totalTokens
	}
	return promptTokens, completionTokens, totalTokens
}

// ExtractTaskTokenUsage exposes normalized task usage for non-billing consumers
// (e.g. task query response rendering), while keeping billing parser logic centralized.
func ExtractTaskTokenUsage(task *model.Task) (promptTokens int, completionTokens int, totalTokens int) {
	return extractTaskTokenUsage(task)
}

func IsDeferredSettleTask(task *model.Task) bool {
	if task == nil || task.PrivateData.BillingContext == nil {
		return false
	}
	return task.PrivateData.BillingContext.DeferredSettle
}

// ResolveDeferredTaskActualQuota resolves final quota for deferred-settle tasks.
// Priority:
// 1. adaptor-adjusted final quota
// 2. token-based calculation from total_tokens
// 3. submit-time estimated quota fallback
func ResolveDeferredTaskActualQuota(adaptor TaskPollingAdaptor, task *model.Task, taskResult *relaycommon.TaskInfo) (int, string) {
	if adaptor != nil {
		if q := adaptor.AdjustBillingOnComplete(task, taskResult); q > 0 {
			return q, "adaptor_adjust"
		}
	}
	if taskResult != nil && taskResult.TotalTokens > 0 {
		if q, ok := calculateTaskQuotaByTokens(task, taskResult.TotalTokens); ok && q > 0 {
			return q, fmt.Sprintf("token_recalculate:%d", taskResult.TotalTokens)
		}
	}
	if task != nil && task.PrivateData.BillingContext != nil && task.PrivateData.BillingContext.EstimatedQuota > 0 {
		return task.PrivateData.BillingContext.EstimatedQuota, "estimated_quota_fallback"
	}
	return 0, "unresolved"
}

// ApplyDeferredTaskTerminalCharge performs first-time charge for deferred-settle tasks.
// It is idempotent by persisted terminal charge state in billing context.
func ApplyDeferredTaskTerminalCharge(ctx context.Context, task *model.Task, actualQuota int, reason string) error {
	if task == nil || task.PrivateData.BillingContext == nil || !task.PrivateData.BillingContext.DeferredSettle {
		return nil
	}

	// Layer 1: Redis NX fast dedup (best-effort, skipped if Redis unavailable)
	if common.RedisEnabled && common.RDB != nil {
		lockKey := fmt.Sprintf("task:billing:charge:%s", task.TaskID)
		ok, err := common.RDB.SetNX(context.Background(), lockKey, "1", 24*time.Hour).Result()
		if err == nil && !ok {
			return nil
		}
	}

	// Layer 2: In-memory check (existing logic, catches most cases)
	bc := task.PrivateData.BillingContext
	state := strings.TrimSpace(bc.TerminalChargeState)
	if state == "" {
		state = TaskTerminalChargeStatePending
	}
	if state == TaskTerminalChargeStateApplied || state == TaskTerminalChargeStateSkipped {
		return nil
	}

	// Layer 3: DB CAS — use UpdateWithStatus to atomically claim the right to charge.
	// Only the Pod that successfully transitions status owns the charge.
	// This is already guaranteed by the caller (reconcileTaskTerminalTransition),
	// but we add a fresh DB read as defense-in-depth for any future direct callers.
	var freshTask model.Task
	if err := model.DB.Select("private_data").Where("id = ?", task.ID).First(&freshTask).Error; err == nil {
		if freshBC := freshTask.PrivateData.BillingContext; freshBC != nil {
			freshState := strings.TrimSpace(freshBC.TerminalChargeState)
			if freshState == TaskTerminalChargeStateApplied || freshState == TaskTerminalChargeStateSkipped {
				return nil
			}
			if freshState == "charging" {
				// Allow takeover if charging stuck > 10 min (crash recovery)
				if freshBC.TerminalChargeAt > 0 && time.Now().Unix()-freshBC.TerminalChargeAt < 600 {
					return nil // Within grace period, another pod is processing
				}
				// Stale charging — fall through to retry
			}
		}
	}

	if actualQuota <= 0 {
		bc.TerminalChargeState = TaskTerminalChargeStateSkipped
		bc.TerminalChargeAt = time.Now().Unix()
		return task.Update()
	}

	// Phase 1: CAS claim ownership with "charging" state — blocks other Pods
	bc.TerminalChargeState = "charging"
	bc.TerminalChargeAt = time.Now().Unix()
	if err := task.Update(); err != nil {
		return fmt.Errorf("claim charge ownership failed: %w", err)
	}

	// Phase 2: Execute side effects
	if err := taskAdjustFunding(task, actualQuota); err != nil {
		// Rollback: reset to pending so retry is possible
		bc.TerminalChargeState = TaskTerminalChargeStatePending
		_ = task.Update()
		// Release Redis NX lock so retry is not blocked for 24h
		if common.RedisEnabled && common.RDB != nil {
			common.RDB.Del(context.Background(), fmt.Sprintf("task:billing:charge:%s", task.TaskID))
		}
		return err
	}
	taskAdjustTokenQuota(ctx, task, actualQuota)

	task.Quota = actualQuota
	bc.TerminalChargeState = TaskTerminalChargeStateApplied
	bc.TerminalChargedQuota = actualQuota
	bc.TerminalChargeAt = time.Now().Unix()

	other := taskBillingOther(task)
	other["task_id"] = task.TaskID
	other["deferred_settle"] = true
	other["actual_quota"] = actualQuota
	other["estimated_quota"] = bc.EstimatedQuota
	other["terminal_charge_state"] = bc.TerminalChargeState
	other["terminal_charge_reason"] = reason
	// When terminal charge is token-based recalculation, override the submit-time
	// per-call model_price with token-based ratios so the frontend renders correctly.
	if strings.Contains(reason, "token_recalculate") || strings.HasPrefix(reason, "token重算") {
		modelName := taskModelName(task)
		modelRatio, _, _ := ratio_setting.GetModelRatio(modelName)
		completionRatio := ratio_setting.GetCompletionRatio(modelName)
		other["model_price"] = float64(-1) // clear per-call pricing flag
		other["model_ratio"] = modelRatio
		other["completion_ratio"] = completionRatio
	}
	promptTokens, completionTokens, totalTokens := extractTaskTokenUsage(task)
	if totalTokens > 0 {
		other["task_total_tokens"] = totalTokens
	}
	if promptTokens > 0 {
		other["task_prompt_tokens"] = promptTokens
	}
	if completionTokens > 0 {
		other["task_completion_tokens"] = completionTokens
	}
	logContent := reason
	if totalTokens > 0 {
		logContent = fmt.Sprintf("%s, tokens=%d", reason, totalTokens)
	}
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:           task.UserId,
		LogType:          model.LogTypeConsume,
		Content:          logContent,
		ChannelId:        task.ChannelId,
		ModelName:        taskModelName(task),
		Quota:            actualQuota,
		TokenId:          task.PrivateData.TokenId,
		Group:            task.Group,
		PricingGroup:     task.GetPricingGroup(),
		RequestId:        task.TaskID,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		Other:            other,
	})
	// deferred-settle requests already counted at submit phase; terminal stage only updates used quota.
	model.UpdateUserUsedQuota(task.UserId, actualQuota)
	model.UpdateChannelUsedQuota(task.ChannelId, actualQuota)
	return task.Update()
}

// RefundTaskQuota 统一的任务失败退款逻辑。
// 当异步任务失败时，将预扣的 quota 退还给用户（支持钱包和订阅），并退还令牌额度。
func RefundTaskQuota(ctx context.Context, task *model.Task, reason string) {
	quota := task.Quota
	if quota == 0 {
		return
	}

	refundLockKey := ""
	if common.RedisEnabled && common.RDB != nil {
		refundLockKey = fmt.Sprintf("task:billing:refund:%s", task.TaskID)
		ok, err := common.RDB.SetNX(ctx, refundLockKey, "1", 24*time.Hour).Result()
		if err == nil && !ok {
			return
		}
	}

	// 1. DB CAS 获取退款所有权（quota→0），阻止其他 Pod 并发退款
	result := model.DB.Model(&model.Task{}).Where("id = ? AND quota > 0", task.ID).Update("quota", 0)
	if result.Error != nil {
		logger.LogError(ctx, fmt.Sprintf("refund task quota DB CAS failed, task_id=%s err=%v", task.TaskID, result.Error))
		if refundLockKey != "" {
			common.RDB.Del(ctx, refundLockKey)
		}
		return
	}
	if result.RowsAffected == 0 {
		// 另一个 Pod 已退款
		return
	}

	// 2. CAS 成功，独占退款权 — 退还资金
	if err := taskAdjustFunding(task, -quota); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("退还资金来源失败 task %s: %s", task.TaskID, err.Error()))
		// 回滚 quota，允许下次重试
		model.DB.Model(&model.Task{}).Where("id = ?", task.ID).Update("quota", quota)
		if refundLockKey != "" {
			common.RDB.Del(ctx, refundLockKey)
		}
		return
	}

	// 3. 退还令牌额度
	taskAdjustTokenQuota(ctx, task, -quota)

	// 3. 记录日志
	other := taskBillingOther(task)
	other["task_id"] = task.TaskID
	other["reason"] = reason
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:       task.UserId,
		LogType:      model.LogTypeRefund,
		Content:      "",
		ChannelId:    task.ChannelId,
		ModelName:    taskModelName(task),
		Quota:        quota,
		TokenId:      task.PrivateData.TokenId,
		Group:        task.Group,
		PricingGroup: task.GetPricingGroup(),
		RequestId:    task.TaskID,
		Other:        other,
	})
}

// RecalculateTaskQuota 通用的异步差额结算。
// actualQuota 是任务完成后的实际应扣额度，与预扣额度 (task.Quota) 做差额结算。
// reason 用于日志记录（例如 "token重算" 或 "adaptor调整"）。
func RecalculateTaskQuota(ctx context.Context, task *model.Task, actualQuota int, reason string) {
	if actualQuota <= 0 {
		return
	}
	preConsumedQuota := task.Quota
	quotaDelta := actualQuota - preConsumedQuota

	if quotaDelta == 0 {
		logger.LogInfo(ctx, fmt.Sprintf("任务 %s 预扣费准确（%s，%s）",
			task.TaskID, logger.LogQuota(actualQuota), reason))
		return
	}

	// Idempotency guard: prevent duplicate settlement across pods/retries.
	recalcLockKey := fmt.Sprintf("task:billing:recalc:%s", task.TaskID)
	if common.RedisEnabled && common.RDB != nil {
		ok, err := common.RDB.SetNX(ctx, recalcLockKey, "1", 24*time.Hour).Result()
		if err != nil {
			// Fail closed: Redis error means we cannot guarantee uniqueness, defer to next retry.
			logger.LogError(ctx, fmt.Sprintf("任务 %s 差额结算 Redis 锁获取失败: %s, 延迟重试", task.TaskID, err.Error()))
			return
		}
		if !ok {
			logger.LogInfo(ctx, fmt.Sprintf("任务 %s 差额结算已被其他节点处理，跳过", task.TaskID))
			return
		}
	}

	logger.LogInfo(ctx, fmt.Sprintf("任务 %s 差额结算：delta=%s（实际：%s，预扣：%s，%s）",
		task.TaskID,
		logger.LogQuota(quotaDelta),
		logger.LogQuota(actualQuota),
		logger.LogQuota(preConsumedQuota),
		reason,
	))

	// Phase 1: Persist task.Quota BEFORE any fund mutations to prevent
	// duplicate settlement on retry (stale quota would produce wrong delta).
	task.Quota = actualQuota
	if err := task.Update(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("差额结算持久化 task.Quota 失败 task %s: %s, 中止结算", task.TaskID, err.Error()))
		// Release Redis lock so retry is possible.
		if common.RedisEnabled && common.RDB != nil {
			common.RDB.Del(ctx, recalcLockKey)
		}
		return
	}

	// Phase 2: Execute fund and token quota adjustments.
	if err := taskAdjustFunding(task, quotaDelta); err != nil {
		logger.LogError(ctx, fmt.Sprintf("差额结算资金调整失败 task %s: %s, 回滚 quota 并释放锁", task.TaskID, err.Error()))
		// Rollback task.Quota so retry can recompute the correct delta.
		task.Quota = preConsumedQuota
		if rollbackErr := task.Update(); rollbackErr != nil {
			logger.LogError(ctx, fmt.Sprintf("差额结算回滚 task.Quota 失败 task %s: %s", task.TaskID, rollbackErr.Error()))
		}
		// Release Redis lock so retry is possible.
		if common.RedisEnabled && common.RDB != nil {
			common.RDB.Del(ctx, recalcLockKey)
		}
		return
	}
	taskAdjustTokenQuota(ctx, task, quotaDelta)

	var logType int
	var logQuota int
	if quotaDelta > 0 {
		logType = model.LogTypeConsume
		logQuota = quotaDelta
		model.UpdateUserUsedQuotaAndRequestCount(task.UserId, quotaDelta)
		model.UpdateChannelUsedQuota(task.ChannelId, quotaDelta)
	} else {
		logType = model.LogTypeRefund
		logQuota = -quotaDelta
	}
	other := taskBillingOther(task)
	other["task_id"] = task.TaskID
	other["pre_consumed_quota"] = preConsumedQuota
	other["actual_quota"] = actualQuota
	// Mark as token recalculation so the frontend renders token-based billing details.
	if strings.Contains(reason, "token_recalculate") || strings.HasPrefix(reason, "token重算") {
		other["deferred_settle"] = true
		other["terminal_charge_reason"] = reason
		modelName := taskModelName(task)
		modelRatio, _, _ := ratio_setting.GetModelRatio(modelName)
		completionRatio := ratio_setting.GetCompletionRatio(modelName)
		other["model_price"] = float64(-1)
		other["model_ratio"] = modelRatio
		other["completion_ratio"] = completionRatio
	}
	promptTokens, completionTokens, totalTokens := extractTaskTokenUsage(task)
	if totalTokens > 0 {
		other["task_total_tokens"] = totalTokens
	}
	if promptTokens > 0 {
		other["task_prompt_tokens"] = promptTokens
	}
	if completionTokens > 0 {
		other["task_completion_tokens"] = completionTokens
	}
	logContent := reason
	if totalTokens > 0 {
		logContent = fmt.Sprintf("%s, tokens=%d", reason, totalTokens)
	}
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:           task.UserId,
		LogType:          logType,
		Content:          logContent,
		ChannelId:        task.ChannelId,
		ModelName:        taskModelName(task),
		Quota:            logQuota,
		TokenId:          task.PrivateData.TokenId,
		Group:            task.Group,
		PricingGroup:     task.GetPricingGroup(),
		RequestId:        task.TaskID,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		Other:            other,
	})
}

// RecalculateTaskQuotaByTokens 根据实际 token 消耗重新计费（异步差额结算）。
// 当任务成功且返回了 totalTokens 时，根据模型倍率和分组倍率重新计算实际扣费额度，
// 与预扣费的差额进行补扣或退还。支持钱包和订阅计费来源。
func RecalculateTaskQuotaByTokens(ctx context.Context, task *model.Task, totalTokens int) {
	actualQuota, ok := calculateTaskQuotaByTokens(task, totalTokens)
	if !ok || actualQuota <= 0 {
		return
	}

	modelName := taskModelName(task)
	modelRatio, _, _ := ratio_setting.GetModelRatio(modelName)
	groupRatio := resolveTaskFinalGroupRatio(task, modelName)
	reason := fmt.Sprintf("token重算：tokens=%d, modelRatio=%.2f, groupRatio=%.2f", totalTokens, modelRatio, groupRatio)
	RecalculateTaskQuota(ctx, task, actualQuota, reason)
}

func resolveTaskFinalGroupRatio(task *model.Task, modelName string) float64 {
	if task == nil {
		return 1
	}

	// Keep settlement consistent with submit-time pricing snapshot when available.
	if bc := task.PrivateData.BillingContext; bc != nil && bc.GroupRatio > 0 {
		return bc.GroupRatio
	}

	pricingGroup := task.GetPricingGroup()
	if pricingGroup == "" {
		return 1
	}

	// Keep same priority as submit pricing path for compatibility.
	if r, ok := ratio_setting.GetGroupModelRatio(pricingGroup, modelName); ok && r > 0 {
		return r
	}

	userGroup := task.Group
	user, err := model.GetUserById(task.UserId, false)
	if err == nil && user.Group != "" {
		userGroup = user.Group
	}
	if r, ok := ratio_setting.GetGroupGroupRatio(userGroup, pricingGroup); ok && r > 0 {
		return r
	}

	return ratio_setting.GetGroupRatio(pricingGroup)
}

func calculateTaskQuotaByTokens(task *model.Task, totalTokens int) (int, bool) {
	if task == nil || totalTokens <= 0 {
		return 0, false
	}

	modelName := taskModelName(task)
	modelRatio, hasRatioSetting, _ := ratio_setting.GetModelRatio(modelName)
	if !hasRatioSetting || modelRatio <= 0 {
		return 0, false
	}

	pricingGroup := task.GetPricingGroup()
	userGroup := task.Group // fallback to routing group
	// Always load user to get the real user.Group for GroupGroupRatio lookup
	user, err := model.GetUserById(task.UserId, false)
	if err == nil {
		userGroup = user.Group
		if pricingGroup == "" {
			if user.PricingGroup != "" {
				pricingGroup = user.PricingGroup
			} else {
				pricingGroup = user.Group
			}
		}
	}
	if pricingGroup == "" {
		return 0, false
	}

	finalGroupRatio := resolveTaskFinalGroupRatio(task, modelName)
	if finalGroupRatio <= 0 {
		finalGroupRatio = ratio_setting.GetGroupRatio(pricingGroup)
		if userGroupRatio, hasUserGroupRatio := ratio_setting.GetGroupGroupRatio(userGroup, pricingGroup); hasUserGroupRatio && userGroupRatio > 0 {
			finalGroupRatio = userGroupRatio
		}
	}

	// Prefer structured usage charging when task payload carries prompt/output/thought details.
	// This avoids under-billing for models where completion/output has a different unit price.
	promptTokens, completionTokens, extractedTotal := extractTaskTokenUsage(task)
	thoughtTokens := extractTaskThoughtTokens(task)
	if promptTokens > 0 || completionTokens > 0 || thoughtTokens > 0 {
		completionRatio := ratio_setting.GetCompletionRatio(modelName)
		thoughtRatio := getTaskThoughtRatio(modelName, completionRatio)
		weightedTokens := float64(promptTokens) +
			float64(completionTokens)*completionRatio +
			float64(thoughtTokens)*thoughtRatio
		if weightedTokens > 0 {
			return int(weightedTokens * modelRatio * finalGroupRatio), true
		}
	}

	if extractedTotal > 0 {
		return int(float64(extractedTotal) * modelRatio * finalGroupRatio), true
	}
	return int(float64(totalTokens) * modelRatio * finalGroupRatio), true
}

// getTaskThoughtRatio returns the per-model thought-token multiplier relative to input price.
// For Gemini image preview models, thought tokens should be billed by text-output tier
// instead of image-output tier.
func getTaskThoughtRatio(modelName string, completionRatio float64) float64 {
	switch modelName {
	case "gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview":
		return 6.0
	default:
		return completionRatio
	}
}
