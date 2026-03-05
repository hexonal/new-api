package controller

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type callbackEventListItem struct {
	ID             int64  `json:"id"`
	EventID        string `json:"event_id"`
	IdempotencyKey string `json:"idempotency_key"`
	Source         string `json:"source"`
	EventType      string `json:"event_type"`
	SinkType       string `json:"sink_type"`

	RequestID     string `json:"request_id"`
	UserID        int    `json:"user_id"`
	Username      string `json:"username"`
	TokenID       int    `json:"token_id"`
	TokenName     string `json:"token_name"`
	TokenSK       string `json:"token_sk"`
	TokenSKMasked string `json:"token_sk_masked"`
	CallbackURL   string `json:"callback_url"`

	RequestMethod  string `json:"request_method"`
	RequestHeaders string `json:"request_headers"`
	RequestBody    string `json:"request_body"`
	ContentType    string `json:"content_type"`
	BodySHA256     string `json:"body_sha256"`

	Status       string `json:"status"`
	AttemptCount int    `json:"attempt_count"`
	MaxRetries   int    `json:"max_retries"`
	NextRetryAt  int64  `json:"next_retry_at"`

	FirstAttemptAt int64  `json:"first_attempt_at"`
	LastAttemptAt  int64  `json:"last_attempt_at"`
	SucceededAt    int64  `json:"succeeded_at"`
	LastHTTPStatus int    `json:"last_http_status"`
	LastError      string `json:"last_error"`

	CreatedAt int64 `json:"created_at"`
	UpdatedAt int64 `json:"updated_at"`
}

type callbackEventAttemptItem struct {
	ID              int64  `json:"id"`
	EventID         int64  `json:"event_id"`
	AttemptNo       int    `json:"attempt_no"`
	StartedAt       int64  `json:"started_at"`
	FinishedAt      int64  `json:"finished_at"`
	HTTPStatus      int    `json:"http_status"`
	Success         bool   `json:"success"`
	Error           string `json:"error"`
	ResponseSnippet string `json:"response_snippet"`
	NodeID          string `json:"node_id"`
	CreatedAt       int64  `json:"created_at"`
}

func GetAllCallbackEvents(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	userID, _ := strconv.Atoi(c.Query("user_id"))
	tokenID, _ := strconv.Atoi(c.Query("token_id"))

	queryParams := model.CallbackEventQueryParams{
		Source:         strings.TrimSpace(c.Query("source")),
		SinkType:       strings.TrimSpace(c.Query("sink_type")),
		EventType:      strings.TrimSpace(c.Query("event_type")),
		Status:         strings.TrimSpace(c.Query("status")),
		RequestID:      strings.TrimSpace(c.Query("request_id")),
		EventID:        strings.TrimSpace(c.Query("event_id")),
		UserID:         userID,
		TokenID:        tokenID,
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
	}

	events, total, err := model.GetAllCallbackEvents(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), queryParams)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	maskSensitive := isCallbackLogMaskSensitiveEnabled()
	userMap, tokenMap := batchLoadCallbackEventIdentityMaps(events)

	items := make([]*callbackEventListItem, 0, len(events))
	for _, event := range events {
		tokenInfo := tokenMap[event.TokenID]
		username := strings.TrimSpace(event.UsernameSnapshot)
		if username == "" {
			username = strings.TrimSpace(userMap[event.UserID])
		}

		tokenName := strings.TrimSpace(event.TokenNameSnapshot)
		if tokenName == "" {
			tokenName = strings.TrimSpace(tokenInfo.Name)
		}

		tokenSK := normalizeSK(event.TokenSKSnapshot)
		if tokenSK == "" {
			tokenSK = normalizeSK(tokenInfo.Key)
		}
		tokenSKMasked := buildMaskedSK(tokenSK)
		displayTokenSK := tokenSK
		if maskSensitive {
			displayTokenSK = tokenSKMasked
		}
		items = append(items, &callbackEventListItem{
			ID:             event.ID,
			EventID:        event.EventID,
			IdempotencyKey: event.IdempotencyKey,
			Source:         event.Source,
			EventType:      event.EventType,
			SinkType:       event.SinkType,
			RequestID:      event.RequestID,
			UserID:         event.UserID,
			Username:       username,
			TokenID:        event.TokenID,
			TokenName:      tokenName,
			TokenSK:        trimCallbackField(displayTokenSK, 128),
			TokenSKMasked:  trimCallbackField(tokenSKMasked, 128),
			CallbackURL:    trimCallbackFieldWithMask(event.CallbackURL, 2048, maskSensitive),
			RequestMethod:  trimCallbackField(event.HTTPMethod, 16),
			RequestHeaders: trimCallbackFieldWithMask(event.Headers, 16000, maskSensitive),
			RequestBody:    trimCallbackFieldWithMask(event.Body, 32000, maskSensitive),
			ContentType:    trimCallbackField(event.ContentType, 128),
			BodySHA256:     trimCallbackField(event.BodySHA256, 128),
			Status:         event.Status,
			AttemptCount:   event.AttemptCount,
			MaxRetries:     event.MaxRetries,
			NextRetryAt:    event.NextRetryAt,
			FirstAttemptAt: event.FirstAttemptAt,
			LastAttemptAt:  event.LastAttemptAt,
			SucceededAt:    event.SucceededAt,
			LastHTTPStatus: event.LastHTTPStatus,
			LastError:      trimCallbackFieldWithMask(event.LastError, 8000, maskSensitive),
			CreatedAt:      event.CreatedAt,
			UpdatedAt:      event.UpdatedAt,
		})
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetCallbackEventAttempts(c *gin.Context) {
	eventID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || eventID <= 0 {
		c.JSON(200, gin.H{
			"success": false,
			"message": "invalid callback event id",
		})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	attempts, err := model.GetCallbackEventAttempts(eventID, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]*callbackEventAttemptItem, 0, len(attempts))
	maskSensitive := isCallbackLogMaskSensitiveEnabled()
	for _, attempt := range attempts {
		items = append(items, &callbackEventAttemptItem{
			ID:              attempt.ID,
			EventID:         attempt.EventID,
			AttemptNo:       attempt.AttemptNo,
			StartedAt:       attempt.StartedAt,
			FinishedAt:      attempt.FinishedAt,
			HTTPStatus:      attempt.HTTPStatus,
			Success:         attempt.Success,
			Error:           trimCallbackFieldWithMask(attempt.Error, 8000, maskSensitive),
			ResponseSnippet: trimCallbackFieldWithMask(attempt.ResponseSnippet, 8000, maskSensitive),
			NodeID:          attempt.NodeID,
			CreatedAt:       attempt.CreatedAt,
		})
	}

	common.ApiSuccess(c, items)
}

type callbackEventTokenInfo struct {
	ID   int
	Name string
	Key  string
}

func batchLoadCallbackEventIdentityMaps(events []*model.CallbackEvent) (map[int]string, map[int]callbackEventTokenInfo) {
	userIDs := make([]int, 0)
	tokenIDs := make([]int, 0)
	userSeen := map[int]struct{}{}
	tokenSeen := map[int]struct{}{}
	for _, event := range events {
		if event == nil {
			continue
		}
		if event.UserID > 0 && strings.TrimSpace(event.UsernameSnapshot) == "" {
			if _, ok := userSeen[event.UserID]; !ok {
				userSeen[event.UserID] = struct{}{}
				userIDs = append(userIDs, event.UserID)
			}
		}
		tokenSnapshotMissing := strings.TrimSpace(event.TokenNameSnapshot) == "" || strings.TrimSpace(event.TokenSKSnapshot) == ""
		if event.TokenID > 0 && tokenSnapshotMissing {
			if _, ok := tokenSeen[event.TokenID]; !ok {
				tokenSeen[event.TokenID] = struct{}{}
				tokenIDs = append(tokenIDs, event.TokenID)
			}
		}
	}

	userMap := map[int]string{}
	if len(userIDs) > 0 {
		for _, userID := range userIDs {
			username, err := model.GetUsernameById(userID, false)
			if err != nil {
				common.SysError(fmt.Sprintf("callback events: load username failed: user_id=%d err=%s", userID, err.Error()))
				continue
			}
			userMap[userID] = strings.TrimSpace(username)
		}
	}

	tokenMap := map[int]callbackEventTokenInfo{}
	if len(tokenIDs) > 0 {
		for _, tokenID := range tokenIDs {
			tokenInfo, err := getCallbackTokenInfoCached(tokenID)
			if err != nil {
				common.SysError(fmt.Sprintf("callback events: load token failed: token_id=%d err=%s", tokenID, err.Error()))
				continue
			}
			tokenMap[tokenID] = tokenInfo
		}
	}

	return userMap, tokenMap
}

func normalizeSK(rawKey string) string {
	key := strings.TrimSpace(strings.TrimPrefix(rawKey, "sk-"))
	if key == "" {
		return ""
	}
	return "sk-" + key
}

func buildMaskedSK(rawKey string) string {
	key := strings.TrimSpace(strings.TrimPrefix(rawKey, "sk-"))
	if key == "" {
		return ""
	}
	if len(key) <= 8 {
		return "sk-" + key
	}
	return fmt.Sprintf("sk-%s***%s", key[:4], key[len(key)-4:])
}

func getCallbackTokenInfoCached(tokenID int) (callbackEventTokenInfo, error) {
	if tokenID <= 0 {
		return callbackEventTokenInfo{}, fmt.Errorf("invalid token id: %d", tokenID)
	}
	cacheKey := fmt.Sprintf("callback:event:token:%d", tokenID)
	if common.RedisEnabled {
		if raw, err := common.RedisGet(cacheKey); err == nil && strings.TrimSpace(raw) != "" {
			var cached callbackEventTokenInfo
			if unmarshalErr := json.Unmarshal([]byte(raw), &cached); unmarshalErr == nil {
				return cached, nil
			}
		}
	}

	token, err := model.GetTokenById(tokenID)
	if err != nil {
		return callbackEventTokenInfo{}, err
	}
	info := callbackEventTokenInfo{
		ID:   token.Id,
		Name: strings.TrimSpace(token.Name),
		Key:  strings.TrimSpace(token.Key),
	}
	if common.RedisEnabled {
		if payload, marshalErr := json.Marshal(info); marshalErr == nil {
			_ = common.RedisSet(cacheKey, string(payload), time.Duration(common.RedisKeyCacheSeconds())*time.Second)
		}
	}
	return info, nil
}

func isCallbackLogMaskSensitiveEnabled() bool {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return common.OptionMap["CallbackLogMaskSensitiveEnabled"] == "true"
}

func trimCallbackField(input string, maxLen int) string {
	value := strings.TrimSpace(input)
	if maxLen <= 0 || len(value) <= maxLen {
		return value
	}
	return value[:maxLen]
}

func trimCallbackFieldWithMask(input string, maxLen int, maskSensitive bool) string {
	value := strings.TrimSpace(input)
	if maskSensitive {
		value = common.MaskSensitiveInfo(value)
	}
	if maxLen <= 0 || len(value) <= maxLen {
		return value
	}
	return value[:maxLen]
}
