package service

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

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
	Username         string  `json:"username"`
	TokenID          int     `json:"token_id"`
	TokenName        string  `json:"token_name"`
	SK               string  `json:"sk"`
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
	normalizedUserID := maxInt(userID, 0)
	normalizedTokenID := maxInt(tokenID, 0)
	username, tokenName, sk := resolveConsumeCallbackIdentity(normalizedUserID, normalizedTokenID)
	return consumeCallbackPayload{
		RequestID:        requestID,
		UserID:           normalizedUserID,
		Username:         username,
		TokenID:          normalizedTokenID,
		TokenName:        tokenName,
		SK:               sk,
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

type consumeCallbackTokenIdentity struct {
	Name string `json:"name"`
	SK   string `json:"sk"`
}

func resolveConsumeCallbackIdentity(userID int, tokenID int) (username string, tokenName string, sk string) {
	// Allow pure unit tests to run without requiring DB bootstrap.
	if model.DB == nil {
		return "", "", ""
	}
	if userID > 0 {
		if u, err := model.GetUsernameById(userID, false); err == nil {
			username = strings.TrimSpace(u)
		} else {
			common.SysError(fmt.Sprintf("consume callback: resolve username failed: user_id=%d err=%s", userID, err.Error()))
		}
	}

	if tokenID > 0 {
		cacheKey := fmt.Sprintf("consume:callback:token_identity:%d", tokenID)
		if common.RedisEnabled {
			if raw, err := common.RedisGet(cacheKey); err == nil && strings.TrimSpace(raw) != "" {
				var cached consumeCallbackTokenIdentity
				if unmarshalErr := json.Unmarshal([]byte(raw), &cached); unmarshalErr == nil {
					return username, strings.TrimSpace(cached.Name), strings.TrimSpace(cached.SK)
				}
			}
		}

		token, err := model.GetTokenById(tokenID)
		if err != nil {
			common.SysError(fmt.Sprintf("consume callback: resolve token failed: token_id=%d err=%s", tokenID, err.Error()))
			return username, "", ""
		}
		tokenName = strings.TrimSpace(token.Name)
		rawKey := strings.TrimSpace(strings.TrimPrefix(token.Key, "sk-"))
		if rawKey != "" {
			sk = "sk-" + rawKey
		}

		if common.RedisEnabled {
			payload, marshalErr := json.Marshal(consumeCallbackTokenIdentity{
				Name: tokenName,
				SK:   sk,
			})
			if marshalErr == nil {
				_ = common.RedisSet(cacheKey, string(payload), time.Duration(common.RedisKeyCacheSeconds())*time.Second)
			}
		}
	}

	return username, tokenName, sk
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
	enabled, callbackURL, secret, usernamePrefixFilter := getConsumeCallbackOptions()
	if !enabled || callbackURL == "" {
		return
	}
	if !shouldDispatchConsumeCallbackForUserID(payload.UserID, usernamePrefixFilter) {
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
		Username:       payload.Username,
		TokenName:      payload.TokenName,
		TokenSK:        payload.SK,
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

func getConsumeCallbackOptions() (bool, string, string, string) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	enabled := common.OptionMap["ConsumeCallbackEnabled"] == "true"
	callbackURL := strings.TrimSpace(common.OptionMap["ConsumeCallbackUrl"])
	secret := common.OptionMap["ConsumeCallbackSecret"]
	usernamePrefixFilter := common.OptionMap["ConsumeCallbackUserPrefixFilter"]
	return enabled, callbackURL, secret, usernamePrefixFilter
}

func shouldDispatchConsumeCallbackForUserID(userID int, rawPrefixFilter string) bool {
	prefixes := parseConsumeCallbackUserPrefixFilter(rawPrefixFilter)
	if len(prefixes) == 0 {
		return true
	}
	if userID <= 0 {
		return false
	}

	username, err := model.GetUsernameById(userID, false)
	if err != nil {
		common.SysError(fmt.Sprintf("consume callback prefix filter: failed to query username for user %d: %s", userID, err.Error()))
		return false
	}
	return matchConsumeCallbackUsernamePrefixes(username, prefixes)
}

func shouldDispatchConsumeCallbackForUsername(username string, rawPrefixFilter string) bool {
	prefixes := parseConsumeCallbackUserPrefixFilter(rawPrefixFilter)
	if len(prefixes) == 0 {
		return true
	}
	return matchConsumeCallbackUsernamePrefixes(username, prefixes)
}

func parseConsumeCallbackUserPrefixFilter(rawPrefixFilter string) []string {
	normalized := strings.ReplaceAll(rawPrefixFilter, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")
	normalized = strings.ReplaceAll(normalized, ",", "\n")

	parts := strings.Split(normalized, "\n")
	prefixes := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		prefix := strings.TrimSpace(part)
		if prefix == "" {
			continue
		}
		if _, exists := seen[prefix]; exists {
			continue
		}
		seen[prefix] = struct{}{}
		prefixes = append(prefixes, prefix)
	}
	return prefixes
}

func matchConsumeCallbackUsernamePrefixes(username string, prefixes []string) bool {
	if len(prefixes) == 0 {
		return true
	}
	normalizedUsername := strings.TrimSpace(username)
	if normalizedUsername == "" {
		return false
	}
	// Case-sensitive by design: prefix and username must match exactly by case.
	for _, prefix := range prefixes {
		if strings.HasPrefix(normalizedUsername, prefix) {
			return true
		}
	}
	return false
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
