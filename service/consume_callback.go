package service

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

const (
	ConsumeCallbackPhaseSettle      = "settle"
	ConsumeCallbackPhaseFinalAdjust = "final_adjust"
)

type ConsumeCallbackUsage struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

type consumeCallbackPayload struct {
	RequestID        string  `json:"request_id"`
	UserID           int     `json:"user_id"`
	TokenID          int     `json:"token_id"`
	ModelName        string  `json:"model_name"`
	ChannelID        int     `json:"channel_id"`
	BillingSource    string  `json:"billing_source"`
	PromptTokens     int     `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
	TotalTokens      int     `json:"total_tokens"`
	Quota            int     `json:"quota"`
	AmountUSD        float64 `json:"amount_usd"`
	Timestamp        int64   `json:"timestamp"`
	EventPhase       string  `json:"event_phase"`
}

func SendConsumeSettleCallback(relayInfo *relaycommon.RelayInfo, quota int, usage ConsumeCallbackUsage) {
	if relayInfo == nil || (!isConsumeCallbackRelayFormatSupported(relayInfo.RelayFormat) &&
		!isConsumeCallbackRelayModeSupported(relayInfo.RelayMode)) {
		return
	}
	requestID := strings.TrimSpace(relayInfo.RequestId)
	payload := newConsumeCallbackPayload(
		requestID,
		relayInfo.UserId,
		relayInfo.TokenId,
		relayInfo.OriginModelName,
		relayInfo.ChannelId,
		relayInfo.BillingSource,
		usage,
		quota,
		ConsumeCallbackPhaseSettle,
	)
	dispatchConsumeCallback(payload)
}

func SendConsumeFinalAdjustCallback(task *model.Task, quota int, usage ConsumeCallbackUsage) {
	// 回退 task/mj 接入：异步任务差额结算不再触发消费回调。
	// 保留函数以兼容现有调用方，避免影响计费链路。
	_ = task
	_ = quota
	_ = usage
	return
}

func newConsumeCallbackPayload(
	requestID string,
	userID int,
	tokenID int,
	modelName string,
	channelID int,
	billingSource string,
	usage ConsumeCallbackUsage,
	quota int,
	eventPhase string,
) consumeCallbackPayload {
	normalizedUsage := normalizeConsumeUsage(usage)
	return consumeCallbackPayload{
		RequestID:        requestID,
		UserID:           maxInt(userID, 0),
		TokenID:          maxInt(tokenID, 0),
		ModelName:        strings.TrimSpace(modelName),
		ChannelID:        maxInt(channelID, 0),
		BillingSource:    normalizeBillingSource(billingSource),
		PromptTokens:     normalizedUsage.PromptTokens,
		CompletionTokens: normalizedUsage.CompletionTokens,
		TotalTokens:      normalizedUsage.TotalTokens,
		Quota:            maxInt(quota, 0),
		AmountUSD:        quotaToAmountUSD(quota),
		Timestamp:        common.GetTimestamp(),
		EventPhase:       strings.TrimSpace(eventPhase),
	}
}

func normalizeConsumeUsage(usage ConsumeCallbackUsage) ConsumeCallbackUsage {
	u := ConsumeCallbackUsage{
		PromptTokens:     maxInt(usage.PromptTokens, 0),
		CompletionTokens: maxInt(usage.CompletionTokens, 0),
		TotalTokens:      maxInt(usage.TotalTokens, 0),
	}

	if u.TotalTokens == 0 {
		u.TotalTokens = u.PromptTokens + u.CompletionTokens
	}
	if u.PromptTokens == 0 && u.TotalTokens >= u.CompletionTokens {
		u.PromptTokens = u.TotalTokens - u.CompletionTokens
	}
	if u.TotalTokens < u.PromptTokens+u.CompletionTokens {
		u.TotalTokens = u.PromptTokens + u.CompletionTokens
	}
	return u
}

func normalizeBillingSource(source string) string {
	switch strings.TrimSpace(source) {
	case BillingSourceSubscription:
		return BillingSourceSubscription
	case BillingSourceWallet:
		return BillingSourceWallet
	default:
		return BillingSourceWallet
	}
}

func quotaToAmountUSD(quota int) float64 {
	if quota <= 0 || common.QuotaPerUnit <= 0 {
		return 0
	}
	amount := float64(quota) / common.QuotaPerUnit
	return math.Round(amount*1e6) / 1e6
}

func dispatchConsumeCallback(payload consumeCallbackPayload) {
	enabled, callbackURL, secret := getConsumeCallbackOptions()
	if !enabled || callbackURL == "" {
		return
	}

	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		common.SysError(fmt.Sprintf("consume callback payload marshal failed for user %d: %s", payload.UserID, err.Error()))
		return
	}

	timestamp := strconv.FormatInt(payload.Timestamp, 10)
	signature := ""
	if secret != "" {
		signature = signOperatorCallback(secret, timestamp, payloadBytes)
	}

	headers := map[string]string{
		"X-New-Api-Timestamp": timestamp,
	}
	if signature != "" {
		headers["X-New-Api-Signature"] = signature
	}

	requestID := strings.TrimSpace(payload.RequestID)
	idempotencyKey := ""
	if requestID != "" {
		idempotencyKey = fmt.Sprintf("consume:%s:%s", payload.EventPhase, requestID)
	}

	if err := enqueuePersistentCallbackEvent(callbackEventEnqueueRequest{
		Source:         "consume",
		EventType:      fmt.Sprintf("consume.%s", payload.EventPhase),
		SinkType:       "consume_webhook",
		RequestID:      requestID,
		UserID:         payload.UserID,
		TokenID:        payload.TokenID,
		CallbackURL:    callbackURL,
		HTTPMethod:     "POST",
		Headers:        headers,
		ContentType:    "application/json",
		Payload:        payloadBytes,
		IdempotencyKey: idempotencyKey,
	}); err != nil {
		common.SysError(fmt.Sprintf("enqueue consume callback failed for user %d: %s", payload.UserID, err.Error()))
	}
}

func getConsumeCallbackOptions() (bool, string, string) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	enabled := common.OptionMap["ConsumeCallbackEnabled"] == "true"
	callbackURL := strings.TrimSpace(common.OptionMap["ConsumeCallbackUrl"])
	secret := common.OptionMap["ConsumeCallbackSecret"]
	return enabled, callbackURL, secret
}

func maxInt(a int, b int) int {
	if a >= b {
		return a
	}
	return b
}

func isConsumeCallbackRelayFormatSupported(format types.RelayFormat) bool {
	switch format {
	case types.RelayFormatOpenAI,
		types.RelayFormatClaude,
		types.RelayFormatOpenAIResponses,
		types.RelayFormatOpenAIResponsesCompaction:
		return true
	default:
		return false
	}
}

func isConsumeCallbackRelayModeSupported(relayMode int) bool {
	switch relayMode {
	case relayconstant.RelayModeChatCompletions,
		relayconstant.RelayModeCompletions,
		relayconstant.RelayModeResponses,
		relayconstant.RelayModeResponsesCompact:
		return true
	default:
		return false
	}
}
