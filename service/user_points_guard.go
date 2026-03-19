package service

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const (
	defaultUserPointsCanPreDeductJSONPath = "data.can_pre_deduct"
	userPointsPrefixCacheTTL              = 10 * time.Minute
	userPointsRequestTimeout              = 3 * time.Second
	userPointsGuardFailureEventType       = "user_points.pre_deduct.check_failed"
	userPointsOnErrorAllow                = "allow"
	userPointsOnErrorDeny                 = "deny"
	userPointsRechargeURLPlaceholder      = "{recharge_url}"
	userPointsQuotaInsufficientMessageEN  = "Insufficient quota"
	skPrefixStandard                      = "sk-"
	skPrefixCustomer                      = "customer-sk-"
	userPointsSKPrefixHeader              = "X-User-Points-SK-Prefix"
)

type userPointsPrefixCacheEntry struct {
	username    string
	shouldCheck bool
	expiresAt   int64
}

// Cache key: "<token_key>|<raw_prefix_filter>".
// Value keeps last username and match result to avoid repeated prefix parsing/matching.
var userPointsPrefixCache sync.Map

type resolvedUserPointsConfig struct {
	queryURL            string
	rechargeURL         string
	insufficientMessage string
}

func resolveUserPointsRouting(
	username string,
	defaultQueryURL string,
	defaultRechargeURL string,
	defaultInsufficientMessage string,
	rules []operation_setting.UserPointsRoutingRule,
) resolvedUserPointsConfig {
	resolved := resolvedUserPointsConfig{
		queryURL:            strings.TrimSpace(defaultQueryURL),
		rechargeURL:         strings.TrimSpace(defaultRechargeURL),
		insufficientMessage: strings.TrimSpace(defaultInsufficientMessage),
	}
	if strings.TrimSpace(username) == "" || len(rules) == 0 {
		return resolved
	}

	sortedRules := append([]operation_setting.UserPointsRoutingRule(nil), rules...)
	sort.SliceStable(sortedRules, func(i, j int) bool {
		return sortedRules[i].Priority > sortedRules[j].Priority
	})
	for _, rule := range sortedRules {
		if !rule.Enabled {
			continue
		}
		prefixes := model.ParseDailyUserUsagePrefixes(rule.PrefixPattern)
		matched := false
		for _, prefix := range prefixes {
			prefix = strings.TrimSpace(strings.TrimSuffix(prefix, "*"))
			if prefix == "" {
				continue
			}
			if strings.HasPrefix(username, prefix) {
				matched = true
				break
			}
		}
		if !matched {
			continue
		}
		if value := strings.TrimSpace(rule.QueryURL); value != "" {
			resolved.queryURL = value
		}
		if value := strings.TrimSpace(rule.RechargeURL); value != "" {
			resolved.rechargeURL = value
		}
		if value := strings.TrimSpace(rule.InsufficientMessage); value != "" {
			resolved.insufficientMessage = value
		}
		return resolved
	}
	return resolved
}

func buildEffectivePrefixFilter(globalPrefixFilter string, rules []operation_setting.UserPointsRoutingRule) string {
	prefixes := model.ParseDailyUserUsagePrefixes(globalPrefixFilter)
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		prefixes = append(prefixes, model.ParseDailyUserUsagePrefixes(rule.PrefixPattern)...)
	}
	return strings.Join(prefixes, ",")
}

// RunUserPointsPreDeductGuard checks external user points API after token auth.
// On external errors, behavior follows configured policy:
// allow => fail-open, deny => fail-close.
func RunUserPointsPreDeductGuard(c *gin.Context, token *model.Token) *types.NewAPIError {
	if c == nil {
		return nil
	}
	if !isUserPointsGuardPath(c.Request.Method, c.Request.URL.Path) {
		return nil
	}

	cfg := operation_setting.GetPaymentSetting()
	if cfg == nil || !cfg.UserPointsEnabled {
		return nil
	}

	effectivePrefixFilter := buildEffectivePrefixFilter(cfg.UserPointsUsernamePrefixFilter, cfg.UserPointsRoutingRules)
	if strings.TrimSpace(effectivePrefixFilter) == "" {
		return nil
	}

	tokenKey := strings.TrimSpace(c.GetString("token_key"))
	if tokenKey == "" && token != nil {
		tokenKey = strings.TrimSpace(token.Key)
	}
	if tokenKey == "" {
		return nil
	}

	username := strings.TrimSpace(c.GetString("username"))
	if username == "" {
		return nil
	}

	if !shouldCheckUserPoints(tokenKey, username, effectivePrefixFilter) {
		return nil
	}

	resolved := resolveUserPointsRouting(
		username,
		cfg.UserPointsQueryURL,
		cfg.UserPointsRechargeURL,
		cfg.UserPointsInsufficientMessage,
		cfg.UserPointsRoutingRules,
	)

	jsonPath := normalizeUserPointsJSONPath(cfg.UserPointsCanPreDeductJSONPath)
	onErrorDecision := normalizeUserPointsOnErrorDecision(cfg.UserPointsOnErrorDecision)
	// Gate rule: request is allowed only when resolved can_pre_deduct value is true.
	// If resolved value is false, request is always blocked.
	// on_error_decision only controls request/parse error behavior.
	externalSK := resolveUserPointsExternalSK(c, token, tokenKey)

	canPreDeduct, err := fetchUserPointsCanPreDeduct(
		c.Request.Context(),
		resolved.queryURL,
		externalSK,
		jsonPath,
	)
	if err != nil {
		failOpen := onErrorDecision == userPointsOnErrorAllow
		// Persist diagnostics to callback logs for observability/troubleshooting.
		reportUserPointsGuardFailureCallbackLog(c, resolved.queryURL, jsonPath, externalSK, err, failOpen)
		if failOpen {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("user_points guard failed open, request continues: %s", err.Error()))
			return nil
		}
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("user_points guard failed close, request blocked: %s", err.Error()))
		return buildUserPointsQuotaRejectErrorWithOverride(resolved.rechargeURL, resolved.insufficientMessage)
	}
	if canPreDeduct {
		return nil
	}

	return buildUserPointsQuotaRejectErrorWithOverride(resolved.rechargeURL, resolved.insufficientMessage)
}

func buildUserPointsQuotaRejectError() *types.NewAPIError {
	message := buildUserPointsQuotaRejectMessage(operation_setting.GetPaymentSetting())
	return types.NewErrorWithStatusCode(
		errors.New(message),
		types.ErrorCodeInsufficientUserQuota,
		http.StatusForbidden,
		types.ErrOptionWithSkipRetry(),
		types.ErrOptionWithNoRecordErrorLog(),
	)
}

func buildUserPointsQuotaRejectErrorWithOverride(rechargeURL, insufficientMessage string) *types.NewAPIError {
	cfg := operation_setting.GetPaymentSetting()
	override := operation_setting.PaymentSetting{}
	if cfg != nil {
		override = *cfg
	}
	override.UserPointsRechargeURL = strings.TrimSpace(rechargeURL)
	override.UserPointsInsufficientMessage = strings.TrimSpace(insufficientMessage)
	message := buildUserPointsQuotaRejectMessage(&override)
	return types.NewErrorWithStatusCode(
		errors.New(message),
		types.ErrorCodeInsufficientUserQuota,
		http.StatusForbidden,
		types.ErrOptionWithSkipRetry(),
		types.ErrOptionWithNoRecordErrorLog(),
	)
}

// buildUserPointsQuotaRejectMessage builds an English error message for user_points rejection.
// It supports a custom copy and recharge URL from payment settings.
// If custom message contains "{recharge_url}", the placeholder will be replaced.
func buildUserPointsQuotaRejectMessage(cfg *operation_setting.PaymentSetting) string {
	defaultMessage := userPointsQuotaInsufficientMessageEN
	if cfg == nil {
		return defaultMessage
	}

	customMessage := strings.TrimSpace(cfg.UserPointsInsufficientMessage)
	rechargeURL := strings.TrimSpace(cfg.UserPointsRechargeURL)
	if customMessage == "" {
		if rechargeURL == "" {
			return defaultMessage
		}
		return fmt.Sprintf("%s Please recharge at %s", defaultMessage, rechargeURL)
	}
	if rechargeURL == "" {
		return customMessage
	}

	replaced := strings.ReplaceAll(customMessage, userPointsRechargeURLPlaceholder, rechargeURL)
	if replaced != customMessage {
		return replaced
	}
	return fmt.Sprintf("%s %s", customMessage, rechargeURL)
}

// isUserPointsGuardPath decides which relay endpoints should trigger the guard.
// Only real invoke endpoints are covered (POST). Read-only model query endpoints are excluded.
func isUserPointsGuardPath(method string, path string) bool {
	if method != http.MethodPost {
		return false
	}
	return isPrimaryRelayInvokePath(path)
}

func isPrimaryRelayInvokePath(path string) bool {
	switch {
	case path == "/v1/messages":
		return true
	case strings.HasPrefix(path, "/v1/completions"):
		return true
	case strings.HasPrefix(path, "/v1/chat/completions"):
		return true
	case strings.HasPrefix(path, "/v1/responses"):
		return true
	case strings.HasPrefix(path, "/v1/embeddings"):
		return true
	case strings.HasPrefix(path, "/v1/edits"):
		return true
	case strings.HasPrefix(path, "/v1/images/"):
		return true
	case strings.HasPrefix(path, "/v1/audio/"):
		return true
	case strings.HasPrefix(path, "/v1/moderations"):
		return true
	case strings.HasPrefix(path, "/v1/rerank"):
		return true
	case strings.HasPrefix(path, "/v1/engines/"):
		return true
	case strings.HasPrefix(path, "/v1/models/"):
		// Gemini-compatible invoke path: /v1/models/*path
		return true
	case strings.HasPrefix(path, "/v1beta/models/"):
		// Gemini invoke path: /v1beta/models/{model}:{action}
		return true
	default:
		return false
	}
}

func shouldCheckUserPoints(tokenKey string, username string, rawPrefixFilter string) bool {
	cacheKey := tokenKey + "|" + rawPrefixFilter
	now := time.Now().Unix()
	if cached, ok := userPointsPrefixCache.Load(cacheKey); ok {
		if entry, ok := cached.(userPointsPrefixCacheEntry); ok && entry.expiresAt > now && entry.username == username {
			return entry.shouldCheck
		}
	}

	prefixes := model.ParseDailyUserUsagePrefixes(rawPrefixFilter)
	shouldCheck := false
	for _, prefix := range prefixes {
		// Allow optional wildcard style in config, e.g. "ima_*" == "ima_".
		prefix = strings.TrimSpace(strings.TrimSuffix(prefix, "*"))
		if prefix == "" {
			continue
		}
		if strings.HasPrefix(username, prefix) {
			shouldCheck = true
			break
		}
	}
	userPointsPrefixCache.Store(cacheKey, userPointsPrefixCacheEntry{
		username:    username,
		shouldCheck: shouldCheck,
		expiresAt:   time.Now().Add(userPointsPrefixCacheTTL).Unix(),
	})
	return shouldCheck
}

// fetchUserPointsCanPreDeduct requests external points service and extracts
// can_pre_deduct value using JSONPath-like path (resolved to gjson path) from response JSON.
func fetchUserPointsCanPreDeduct(ctx context.Context, rawQueryURL string, externalSK string, jsonPath string) (bool, error) {
	requestURL, err := buildUserPointsRequestURL(rawQueryURL, normalizeExternalSK(externalSK))
	if err != nil {
		return false, err
	}

	resolvedJSONPath := normalizeUserPointsJSONPath(jsonPath)

	timeoutCtx, cancel := context.WithTimeout(ctx, userPointsRequestTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(timeoutCtx, http.MethodGet, requestURL, nil)
	if err != nil {
		return false, err
	}

	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return false, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, err
	}

	result := gjson.GetBytes(body, resolvedJSONPath)
	if !result.Exists() {
		return false, fmt.Errorf("jsonpath not found: %s", resolvedJSONPath)
	}

	if value, ok := gjsonResultToBool(result); ok {
		return value, nil
	}
	return false, fmt.Errorf("jsonpath value is not boolean-like: %s", resolvedJSONPath)
}

// buildUserPointsRequestURL supports two URL styles:
// 1) URL template with {sk} placeholder
// 2) Plain URL (function appends sk query parameter)
func buildUserPointsRequestURL(rawQueryURL string, tokenKey string) (string, error) {
	trimmed := strings.TrimSpace(rawQueryURL)
	if trimmed == "" {
		return "", fmt.Errorf("user_points_query_url is empty")
	}
	if strings.Contains(trimmed, "{sk}") {
		return strings.ReplaceAll(trimmed, "{sk}", url.QueryEscape(tokenKey)), nil
	}
	parsedURL, err := url.Parse(trimmed)
	if err != nil {
		return "", err
	}
	query := parsedURL.Query()
	query.Set("sk", tokenKey)
	parsedURL.RawQuery = query.Encode()
	return parsedURL.String(), nil
}

func normalizeExternalSK(raw string) string {
	key := strings.TrimSpace(raw)
	return key
}

func stripBearerTokenValue(raw string) string {
	text := strings.TrimSpace(raw)
	if strings.HasPrefix(text, "Bearer ") || strings.HasPrefix(text, "bearer ") {
		text = strings.TrimSpace(text[7:])
	}
	return strings.TrimSpace(text)
}

func extractPresentedTokenFromRequest(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return ""
	}

	key := stripBearerTokenValue(c.GetHeader("Authorization"))
	if key == "" || key == "midjourney-proxy" {
		key = stripBearerTokenValue(c.GetHeader("mj-api-secret"))
	}
	return strings.TrimSpace(key)
}

func baseTokenKey(tokenKey string, token *model.Token) string {
	key := strings.TrimSpace(tokenKey)
	if key == "" && token != nil {
		key = strings.TrimSpace(token.Key)
	}
	key = strings.TrimPrefix(key, skPrefixStandard)
	key = strings.TrimPrefix(key, skPrefixCustomer)
	return strings.TrimSpace(key)
}

func normalizeHeaderSKPrefix(raw string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case skPrefixStandard:
		return skPrefixStandard, true
	case skPrefixCustomer:
		return skPrefixCustomer, true
	default:
		return "", false
	}
}

func resolveUserPointsExternalSK(c *gin.Context, token *model.Token, tokenKey string) string {
	baseKey := baseTokenKey(tokenKey, token)
	if c != nil && c.Request != nil {
		if forcedPrefix, ok := normalizeHeaderSKPrefix(c.GetHeader(userPointsSKPrefixHeader)); ok && baseKey != "" {
			return forcedPrefix + baseKey
		}
		presentedKey := extractPresentedTokenFromRequest(c)
		if presentedKey != "" {
			if baseKey == "" || baseTokenKey(presentedKey, nil) == baseKey {
				return presentedKey
			}
		}
	}

	// Fallback behavior: keep original raw token key.
	return baseKey
}

// gjsonResultToBool accepts typical boolean-like values from external API:
// bool, number(0/1), string(true/false/yes/no/0/1).
func gjsonResultToBool(result gjson.Result) (bool, bool) {
	switch result.Type {
	case gjson.True:
		return true, true
	case gjson.False:
		return false, true
	case gjson.Number:
		return result.Num != 0, true
	case gjson.String:
		text := strings.ToLower(strings.TrimSpace(result.String()))
		switch text {
		case "true", "1", "yes", "y":
			return true, true
		case "false", "0", "no", "n":
			return false, true
		default:
			return false, false
		}
	default:
		return false, false
	}
}

// reportUserPointsGuardFailureCallbackLog writes a terminal callback-event row for
// user_points guard failures. It never affects request flow.
func reportUserPointsGuardFailureCallbackLog(c *gin.Context, rawQueryURL string, jsonPath string, externalSK string, guardErr error, failOpen bool) {
	if c == nil || guardErr == nil || model.DB == nil {
		return
	}

	event, err := buildUserPointsFailureCallbackEvent(c, rawQueryURL, jsonPath, externalSK, guardErr, failOpen)
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("build user_points failure callback log failed: %s", err.Error()))
		return
	}

	if err := model.InsertCallbackEvent(event); err != nil {
		if isDuplicateEventInsertError(err) {
			return
		}
		logger.LogWarn(context.Background(), fmt.Sprintf("insert user_points failure callback log failed: %s", err.Error()))
	}
}

// buildUserPointsFailureCallbackEvent builds a non-dispatching callback-event record.
// Status is set to terminal(dead), so dispatcher won't claim it.
func buildUserPointsFailureCallbackEvent(c *gin.Context, rawQueryURL string, jsonPath string, externalSK string, guardErr error, failOpen bool) (*model.CallbackEvent, error) {
	if c == nil {
		return nil, fmt.Errorf("nil context")
	}
	if guardErr == nil {
		return nil, fmt.Errorf("nil guard error")
	}

	requestID := strings.TrimSpace(c.GetString(common.RequestIdKey))
	requestPath := ""
	if c.Request != nil && c.Request.URL != nil {
		requestPath = c.Request.URL.Path
	}
	resolvedQueryURL := strings.TrimSpace(rawQueryURL)
	externalSK = normalizeExternalSK(externalSK)
	if builtURL, err := buildUserPointsRequestURL(rawQueryURL, externalSK); err == nil {
		resolvedQueryURL = builtURL
	}
	jsonPath = normalizeUserPointsJSONPath(jsonPath)

	reason := "user_points_guard_failed_close"
	if failOpen {
		reason = "user_points_guard_failed_open"
	}

	payload, err := common.Marshal(map[string]interface{}{})
	if err != nil {
		return nil, fmt.Errorf("marshal user_points guard failure payload: %w", err)
	}

	now := common.GetTimestamp()
	idempotencySuffix := requestID
	if idempotencySuffix == "" {
		idempotencySuffix = common.GetUUID()
	}

	return &model.CallbackEvent{
		EventID:           common.GetUUID(),
		IdempotencyKey:    fmt.Sprintf("user_points_guard:%s", idempotencySuffix),
		Source:            model.CallbackEventSourceUserPointsGuard,
		EventType:         userPointsGuardFailureEventType,
		SinkType:          model.CallbackEventSinkUserPointsGuardLog,
		RequestID:         requestID,
		UserID:            c.GetInt("id"),
		TokenID:           c.GetInt("token_id"),
		UsernameSnapshot:  trimSnapshotField(strings.TrimSpace(c.GetString("username")), 64),
		TokenNameSnapshot: trimSnapshotField(strings.TrimSpace(c.GetString("token_name")), 100),
		TokenSKSnapshot:   trimSnapshotField(normalizeSnapshotSK(externalSK), 128),
		CallbackURL:       resolvedQueryURL,
		HTTPMethod:        http.MethodGet,
		Headers:           "{}",
		ContentType:       "application/json",
		Body:              string(payload),
		BodySHA256:        hex.EncodeToString(common.Sha256Raw(payload)),
		Status:            model.CallbackEventStatusDead,
		MaxRetries:        0,
		NextRetryAt:       0,
		LastError: strings.TrimSpace(fmt.Sprintf(
			"%s: %s | request_path=%s | user_points_query_url=%s | resolved_user_points_query_url=%s | can_pre_deduct_jsonpath=%s | fail_open=%t",
			reason,
			guardErr.Error(),
			requestPath,
			strings.TrimSpace(rawQueryURL),
			resolvedQueryURL,
			jsonPath,
			failOpen,
		)),
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// normalizeUserPointsJSONPath normalizes operator input to the path syntax accepted by gjson.
// Supported forms:
// - data.can_pre_deduct
// - $.data.can_pre_deduct (standard JSONPath style)
func normalizeUserPointsJSONPath(raw string) string {
	path := strings.TrimSpace(raw)
	if path == "" {
		return defaultUserPointsCanPreDeductJSONPath
	}
	if strings.HasPrefix(path, "$.") {
		path = strings.TrimPrefix(path, "$.")
	} else if strings.HasPrefix(path, "$") {
		path = strings.TrimPrefix(path, "$")
		path = strings.TrimPrefix(path, ".")
	}
	if path == "" {
		return defaultUserPointsCanPreDeductJSONPath
	}
	return path
}

func normalizeUserPointsOnErrorDecision(raw string) string {
	decision := strings.ToLower(strings.TrimSpace(raw))
	switch decision {
	case userPointsOnErrorDeny:
		return userPointsOnErrorDeny
	case userPointsOnErrorAllow:
		return userPointsOnErrorAllow
	default:
		return userPointsOnErrorAllow
	}
}
