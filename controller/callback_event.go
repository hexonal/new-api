package controller

import (
	"strconv"
	"strings"

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

	RequestID   string `json:"request_id"`
	UserID      int    `json:"user_id"`
	TokenID     int    `json:"token_id"`
	CallbackURL string `json:"callback_url"`

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

	items := make([]*callbackEventListItem, 0, len(events))
	for _, event := range events {
		items = append(items, &callbackEventListItem{
			ID:             event.ID,
			EventID:        event.EventID,
			IdempotencyKey: event.IdempotencyKey,
			Source:         event.Source,
			EventType:      event.EventType,
			SinkType:       event.SinkType,
			RequestID:      event.RequestID,
			UserID:         event.UserID,
			TokenID:        event.TokenID,
			CallbackURL:    common.MaskSensitiveInfo(event.CallbackURL),
			Status:         event.Status,
			AttemptCount:   event.AttemptCount,
			MaxRetries:     event.MaxRetries,
			NextRetryAt:    event.NextRetryAt,
			FirstAttemptAt: event.FirstAttemptAt,
			LastAttemptAt:  event.LastAttemptAt,
			SucceededAt:    event.SucceededAt,
			LastHTTPStatus: event.LastHTTPStatus,
			LastError:      trimAndMaskCallbackField(event.LastError, 1024),
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
	for _, attempt := range attempts {
		items = append(items, &callbackEventAttemptItem{
			ID:              attempt.ID,
			EventID:         attempt.EventID,
			AttemptNo:       attempt.AttemptNo,
			StartedAt:       attempt.StartedAt,
			FinishedAt:      attempt.FinishedAt,
			HTTPStatus:      attempt.HTTPStatus,
			Success:         attempt.Success,
			Error:           trimAndMaskCallbackField(attempt.Error, 1024),
			ResponseSnippet: trimAndMaskCallbackField(attempt.ResponseSnippet, 1024),
			NodeID:          attempt.NodeID,
			CreatedAt:       attempt.CreatedAt,
		})
	}

	common.ApiSuccess(c, items)
}

func trimAndMaskCallbackField(input string, maxLen int) string {
	value := common.MaskSensitiveInfo(strings.TrimSpace(input))
	if maxLen <= 0 || len(value) <= maxLen {
		return value
	}
	return value[:maxLen]
}
