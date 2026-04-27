package service

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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

type resolvedConsumeCallbackConfig struct {
	callbackURL string
	secret      string
}

type consumeCallbackPayload struct {
	RequestID        string  `json:"request_id"`
	UserID           int     `json:"user_id"`
	AppID            string  `json:"app_id"`
	Env              string  `json:"env"`
	BusinessUserID   string  `json:"business_user_id"`
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
	TaskID           string  `json:"task_id,omitempty"`
}

func SendConsumeSettleCallback(relayInfo *relaycommon.RelayInfo, quota int, usage ConsumeCallbackUsage) {
	if relayInfo == nil || (!isConsumeCallbackRelayFormatSupported(relayInfo.RelayFormat) &&
		!isConsumeCallbackRelayModeSupported(relayInfo.RelayMode)) {
		return
	}
	requestID := strings.TrimSpace(relayInfo.RequestId)
	presentedToken := extractConsumeCallbackPresentedToken(relayInfo)
	payload := newConsumeCallbackPayload(
		requestID,
		relayInfo.UserId,
		relayInfo.TokenId,
		relayInfo.TokenAuthPrefix,
		presentedToken,
		relayInfo.OriginModelName,
		relayInfo.ChannelId,
		relayInfo.BillingSource,
		usage,
		quota,
		ConsumeCallbackPhaseSettle,
	)
	applyJWTHeaderConsumeCallbackOverrides(relayInfo, &payload)
	consumeCallbackDispatcher(payload)
}

func SendConsumeFinalAdjustCallback(task *model.Task, quota int, usage ConsumeCallbackUsage) {
	if task == nil {
		return
	}
	payload := newConsumeCallbackPayloadForTask(task, usage, quota, ConsumeCallbackPhaseFinalAdjust)
	consumeCallbackDispatcher(payload)
}

func newConsumeCallbackPayload(
	requestID string,
	userID int,
	tokenID int,
	tokenAuthPrefix string,
	presentedToken string,
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
	username, tokenName, sk := resolveConsumeCallbackIdentity(normalizedUserID, normalizedTokenID, tokenAuthPrefix, presentedToken)
	appID, businessUserID, env := parseTokenName(tokenName)
	return consumeCallbackPayload{
		RequestID:        requestID,
		UserID:           normalizedUserID,
		AppID:            appID,
		Env:              env,
		BusinessUserID:   businessUserID,
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

func newConsumeCallbackPayloadForTask(task *model.Task, usage ConsumeCallbackUsage, quota int, phase string) consumeCallbackPayload {
	userID := maxInt(task.UserId, 0)
	tokenID := 0
	billingSource := ""
	if task.PrivateData.TokenId > 0 {
		tokenID = task.PrivateData.TokenId
	}
	if task.PrivateData.BillingSource != "" {
		billingSource = task.PrivateData.BillingSource
	}
	modelName := ""
	if bc := task.PrivateData.BillingContext; bc != nil && bc.OriginModelName != "" {
		modelName = bc.OriginModelName
	} else {
		modelName = task.Properties.OriginModelName
	}
	payload := newConsumeCallbackPayload(
		strings.TrimSpace(task.TaskID),
		userID,
		tokenID,
		"",
		"",
		modelName,
		task.ChannelId,
		billingSource,
		usage,
		quota,
		phase,
	)
	applyTaskConsumeCallbackOverrides(task, &payload)
	payload.TaskID = strings.TrimSpace(task.TaskID)
	return payload
}

type consumeCallbackTokenIdentity struct {
	Name     string `json:"name"`
	TokenKey string `json:"token_key,omitempty"`
	SK       string `json:"sk,omitempty"` // legacy cache compatibility
}

func extractConsumeCallbackRawTokenKey(raw string) string {
	key := strings.TrimSpace(raw)
	if key == "" {
		return ""
	}
	key = strings.TrimPrefix(key, constant.TokenPrefixCustomer)
	key = strings.TrimPrefix(key, constant.TokenPrefixStandard)
	return strings.TrimSpace(key)
}

func hasConsumeCallbackSKPrefix(raw string) bool {
	value := strings.TrimSpace(raw)
	return strings.HasPrefix(value, constant.TokenPrefixStandard) || strings.HasPrefix(value, constant.TokenPrefixCustomer)
}

func buildConsumeCallbackSK(tokenKey string, fallbackSK string, tokenAuthPrefix string) string {
	_ = tokenAuthPrefix
	tokenKey = strings.TrimSpace(tokenKey)
	if hasConsumeCallbackSKPrefix(tokenKey) {
		// Keep explicitly prefixed token keys unchanged.
		return tokenKey
	}
	rawKey := extractConsumeCallbackRawTokenKey(tokenKey)
	if rawKey == "" {
		rawKey = extractConsumeCallbackRawTokenKey(fallbackSK)
	}
	if rawKey == "" {
		return ""
	}
	// Base-key-first strategy: do not append synthetic "sk-" prefixes.
	return rawKey
}

// parseTokenName extracts appID, userID, env from token name format: {env}_{appID}_{userID}
func parseTokenName(name string) (appID string, userID string, env string) {
	value := strings.TrimSpace(name)
	firstUnderscore := strings.IndexByte(value, '_')
	lastUnderscore := strings.LastIndexByte(value, '_')
	if firstUnderscore <= 0 || lastUnderscore <= firstUnderscore || lastUnderscore >= len(value)-1 {
		return "", "", ""
	}
	env = strings.TrimSpace(value[:firstUnderscore])
	appID = strings.TrimSpace(value[firstUnderscore+1 : lastUnderscore])
	userID = strings.TrimSpace(value[lastUnderscore+1:])
	if env == "" || appID == "" || userID == "" {
		return "", "", ""
	}
	return appID, userID, env
}

func baseConsumeCallbackTokenKey(raw string) string {
	key := strings.TrimSpace(raw)
	key = strings.TrimPrefix(key, constant.TokenPrefixCustomer)
	key = strings.TrimPrefix(key, constant.TokenPrefixStandard)
	return strings.TrimSpace(key)
}

func resolveConsumeCallbackPresentedSK(presentedToken string, tokenKey string) string {
	presented := common.StripBearerPrefix(presentedToken)
	if presented == "" {
		return ""
	}
	basePresented := baseConsumeCallbackTokenKey(presented)
	if basePresented == "" {
		return ""
	}
	baseToken := baseConsumeCallbackTokenKey(tokenKey)
	if baseToken == "" {
		return presented
	}
	if baseToken == basePresented {
		return presented
	}
	return ""
}

func consumeCallbackHeaderValue(headers map[string]string, headerName string) string {
	if len(headers) == 0 {
		return ""
	}
	for key, value := range headers {
		if strings.EqualFold(strings.TrimSpace(key), headerName) {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func applyJWTHeaderConsumeCallbackOverrides(relayInfo *relaycommon.RelayInfo, payload *consumeCallbackPayload) {
	if relayInfo == nil || payload == nil || !relayInfo.JWTHeaderAuth {
		return
	}
	if headerAppID := consumeCallbackHeaderValue(relayInfo.RequestHeaders, "x-app-id"); headerAppID != "" {
		payload.AppID = headerAppID
	}
	if headerEnv := consumeCallbackHeaderValue(relayInfo.RequestHeaders, "x-env"); headerEnv != "" {
		payload.Env = headerEnv
	}
	if headerUserID := consumeCallbackHeaderValue(relayInfo.RequestHeaders, "x-user-id"); headerUserID != "" {
		payload.BusinessUserID = headerUserID
	}
}

func applyTaskConsumeCallbackOverrides(task *model.Task, payload *consumeCallbackPayload) {
	if task == nil || payload == nil {
		return
	}
	if appID := strings.TrimSpace(task.PrivateData.AppID); appID != "" {
		payload.AppID = appID
	}
	if env := strings.TrimSpace(task.PrivateData.Env); env != "" {
		payload.Env = env
	}
	if businessUserID := strings.TrimSpace(task.PrivateData.BusinessUserID); businessUserID != "" {
		payload.BusinessUserID = businessUserID
	}
}

func extractConsumeCallbackPresentedToken(relayInfo *relaycommon.RelayInfo) string {
	if relayInfo == nil {
		return ""
	}
	token := common.StripBearerPrefix(consumeCallbackHeaderValue(relayInfo.RequestHeaders, "Authorization"))
	if token == "" || token == "midjourney-proxy" {
		token = common.StripBearerPrefix(consumeCallbackHeaderValue(relayInfo.RequestHeaders, "mj-api-secret"))
	}
	return strings.TrimSpace(token)
}

func resolveConsumeCallbackIdentity(userID int, tokenID int, tokenAuthPrefix string, presentedToken string) (username string, tokenName string, sk string) {
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
				if unmarshalErr := common.Unmarshal([]byte(raw), &cached); unmarshalErr == nil {
					tokenName = strings.TrimSpace(cached.Name)
					sk = resolveConsumeCallbackPresentedSK(presentedToken, strings.TrimSpace(cached.TokenKey))
					if sk != "" {
						return username, tokenName, sk
					}
					sk = buildConsumeCallbackSK(strings.TrimSpace(cached.TokenKey), strings.TrimSpace(cached.SK), tokenAuthPrefix)
					if sk == "" {
						sk = strings.TrimSpace(cached.SK)
					}
					return username, tokenName, sk
				}
			}
		}

		token, err := model.GetTokenById(tokenID)
		if err != nil {
			common.SysError(fmt.Sprintf("consume callback: resolve token failed: token_id=%d err=%s", tokenID, err.Error()))
			return username, "", ""
		}
		tokenName = strings.TrimSpace(token.Name)
		sk = resolveConsumeCallbackPresentedSK(presentedToken, token.Key)
		if sk != "" {
			return username, tokenName, sk
		}
		sk = buildConsumeCallbackSK(token.Key, "", tokenAuthPrefix)

		if common.RedisEnabled {
			payload, marshalErr := common.Marshal(consumeCallbackTokenIdentity{
				Name:     tokenName,
				TokenKey: strings.TrimSpace(token.Key),
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

// consumeCallbackDispatcher 是实际发送消费回调的函数入口；测试可替换为 spy
var consumeCallbackDispatcher = dispatchConsumeCallback

func dispatchConsumeCallback(payload consumeCallbackPayload) {
	enabled, callbackURL, secret, usernamePrefixFilter := getConsumeCallbackOptions()
	if !enabled {
		return
	}

	cfg := operation_setting.GetPaymentSetting()
	var routingRules []operation_setting.ConsumeCallbackRoutingRule
	if cfg != nil {
		routingRules = cfg.ConsumeCallbackRoutingRules
	}
	username := strings.TrimSpace(payload.Username)
	tokenPrefixCandidates := normalizeConsumeCallbackTokenPrefixCandidates(payload.SK)
	hasGlobalPrefixFilter := len(parseConsumeCallbackUserPrefixFilter(usernamePrefixFilter)) > 0
	hasRuleFilter := hasEnabledConsumeCallbackRoutingRules(routingRules)
	globalMatched := shouldDispatchConsumeCallbackForUsernameOrUserID(username, payload.UserID, usernamePrefixFilter)
	ruleMatched := hasMatchedConsumeCallbackRoutingRule(username, tokenPrefixCandidates, routingRules)
	if (hasGlobalPrefixFilter || hasRuleFilter) && !globalMatched && !ruleMatched {
		return
	}
	resolved := resolveConsumeCallbackRouting(username, tokenPrefixCandidates, callbackURL, secret)
	if resolved.callbackURL == "" {
		return
	}

	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		common.SysError(fmt.Sprintf("consume callback payload marshal failed for user %d: %s", payload.UserID, err.Error()))
		return
	}

	timestamp := strconv.FormatInt(payload.Timestamp, 10)
	signature := ""
	if resolved.secret != "" {
		signature = signOperatorCallback(resolved.secret, timestamp, payloadBytes)
	}
	requestID := strings.TrimSpace(payload.RequestID)

	headers := map[string]string{
		"X-New-Api-Timestamp": timestamp,
	}
	if requestID != "" {
		headers[common.TraceIdKey] = requestID
	}
	if signature != "" {
		headers["X-New-Api-Signature"] = signature
	}

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
		CallbackURL:    resolved.callbackURL,
		HTTPMethod:     "POST",
		Headers:        headers,
		ContentType:    "application/json",
		Payload:        payloadBytes,
		IdempotencyKey: idempotencyKey,
	}); err != nil {
		common.SysError(fmt.Sprintf("enqueue consume callback failed for user %d: %s", payload.UserID, err.Error()))
	}
}

func matchConsumeCallbackRoutingRule(rule operation_setting.ConsumeCallbackRoutingRule, username string, tokenPrefixCandidates []string) bool {
	switch operation_setting.NormalizeRoutingMatchBy(rule.MatchBy) {
	case operation_setting.RoutingMatchByTokenPrefix:
		for _, candidate := range tokenPrefixCandidates {
			if matchConsumeCallbackUsernamePrefixes(candidate, []string{rule.PrefixPattern}) {
				return true
			}
		}
		return false
	default:
		return matchConsumeCallbackUsernamePrefixes(username, []string{rule.PrefixPattern})
	}
}

func selectConsumeCallbackRoutingRule(username string, tokenPrefixCandidates []string, rules []operation_setting.ConsumeCallbackRoutingRule) (operation_setting.ConsumeCallbackRoutingRule, bool) {
	sortedRules := append([]operation_setting.ConsumeCallbackRoutingRule(nil), rules...)
	sort.SliceStable(sortedRules, func(i, j int) bool {
		return sortedRules[i].Priority > sortedRules[j].Priority
	})

	// Conflict policy: token-prefix rules always have higher precedence than username rules.
	for _, matchBy := range []string{
		operation_setting.RoutingMatchByTokenPrefix,
		operation_setting.RoutingMatchByUsername,
	} {
		for _, rule := range sortedRules {
			if !rule.Enabled {
				continue
			}
			if operation_setting.NormalizeRoutingMatchBy(rule.MatchBy) != matchBy {
				continue
			}
			if !matchConsumeCallbackRoutingRule(rule, username, tokenPrefixCandidates) {
				continue
			}
			return rule, true
		}
	}
	return operation_setting.ConsumeCallbackRoutingRule{}, false
}

func hasEnabledConsumeCallbackRoutingRules(rules []operation_setting.ConsumeCallbackRoutingRule) bool {
	for _, rule := range rules {
		if rule.Enabled {
			return true
		}
	}
	return false
}

func hasMatchedConsumeCallbackRoutingRule(username string, tokenPrefixCandidates []string, rules []operation_setting.ConsumeCallbackRoutingRule) bool {
	_, matched := selectConsumeCallbackRoutingRule(username, tokenPrefixCandidates, rules)
	return matched
}

func resolveConsumeCallbackRouting(username string, tokenPrefixCandidates []string, globalURL, globalSecret string) resolvedConsumeCallbackConfig {
	resolved := resolvedConsumeCallbackConfig{
		callbackURL: strings.TrimSpace(globalURL),
		secret:      strings.TrimSpace(globalSecret),
	}

	cfg := operation_setting.GetPaymentSetting()
	if cfg == nil || len(cfg.ConsumeCallbackRoutingRules) == 0 {
		return resolved
	}
	rule, matched := selectConsumeCallbackRoutingRule(username, tokenPrefixCandidates, cfg.ConsumeCallbackRoutingRules)
	if !matched {
		return resolved
	}
	if v := strings.TrimSpace(rule.CallbackURL); v != "" {
		resolved.callbackURL = v
	}
	if v := strings.TrimSpace(rule.Secret); v != "" {
		resolved.secret = v
	}
	return resolved
}

func shouldDispatchConsumeCallbackForUsernameOrUserID(username string, userID int, rawPrefixFilter string) bool {
	if strings.TrimSpace(username) != "" {
		return shouldDispatchConsumeCallbackForUsername(username, rawPrefixFilter)
	}
	return shouldDispatchConsumeCallbackForUserID(userID, rawPrefixFilter)
}

func normalizeConsumeCallbackTokenPrefixCandidates(rawSK string) []string {
	normalized := strings.TrimSpace(rawSK)
	base := strings.TrimPrefix(strings.TrimPrefix(normalized, "sk-"), "customer-sk-")
	candidates := make([]string, 0, 2)
	seen := make(map[string]struct{}, 2)
	for _, candidate := range []string{normalized, strings.TrimSpace(base)} {
		if candidate == "" {
			continue
		}
		if _, exists := seen[candidate]; exists {
			continue
		}
		seen[candidate] = struct{}{}
		candidates = append(candidates, candidate)
	}
	return candidates
}

func buildEffectiveConsumeCallbackPrefixFilter(globalFilter string, rules []operation_setting.ConsumeCallbackRoutingRule) string {
	prefixes := model.ParseDailyUserUsagePrefixes(globalFilter)
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		prefixes = append(prefixes, model.ParseDailyUserUsagePrefixes(rule.PrefixPattern)...)
	}
	return strings.Join(prefixes, ",")
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
		// Keep first-layer prefix semantics consistent with routing rules:
		// "ima_*" should match usernames starting with "ima_".
		prefix = strings.TrimSpace(strings.TrimSuffix(prefix, "*"))
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
		normalizedPrefix := strings.TrimSpace(strings.TrimSuffix(prefix, "*"))
		if normalizedPrefix == "" {
			continue
		}
		if strings.HasPrefix(normalizedUsername, normalizedPrefix) {
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
		types.RelayFormatGemini,
		types.RelayFormatOpenAIResponses,
		types.RelayFormatOpenAIResponsesCompaction,
		types.RelayFormatOpenAIAudio,
		types.RelayFormatOpenAIImage,
		types.RelayFormatOpenAIRealtime,
		types.RelayFormatRerank,
		types.RelayFormatEmbedding,
		types.RelayFormatTask,
		types.RelayFormatMjProxy,
		types.RelayFormatImageTask:
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
		relayconstant.RelayModeResponsesCompact,
		relayconstant.RelayModeEmbeddings,
		relayconstant.RelayModeModerations,
		relayconstant.RelayModeImagesGenerations,
		relayconstant.RelayModeImagesEdits,
		relayconstant.RelayModeImageSubmit,
		relayconstant.RelayModeImageFetchByID,
		relayconstant.RelayModeAudioSpeech,
		relayconstant.RelayModeAudioTranscription,
		relayconstant.RelayModeAudioTranslation,
		relayconstant.RelayModeSunoSubmit,
		relayconstant.RelayModeSunoFetch,
		relayconstant.RelayModeSunoFetchByID,
		relayconstant.RelayModeVideoSubmit,
		relayconstant.RelayModeVideoFetchByID,
		relayconstant.RelayModeMidjourneyImagine,
		relayconstant.RelayModeMidjourneyDescribe,
		relayconstant.RelayModeMidjourneyBlend,
		relayconstant.RelayModeMidjourneyChange,
		relayconstant.RelayModeMidjourneySimpleChange,
		relayconstant.RelayModeMidjourneyAction,
		relayconstant.RelayModeMidjourneyModal,
		relayconstant.RelayModeMidjourneyShorten,
		relayconstant.RelayModeSwapFace,
		relayconstant.RelayModeMidjourneyUpload,
		relayconstant.RelayModeMidjourneyVideo,
		relayconstant.RelayModeMidjourneyEdits,
		relayconstant.RelayModeRerank,
		relayconstant.RelayModeRealtime,
		relayconstant.RelayModeGemini:
		return true
	default:
		return false
	}
}
