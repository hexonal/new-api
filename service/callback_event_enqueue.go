package service

import (
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type callbackEventEnqueueRequest struct {
	Source         string
	EventType      string
	SinkType       string
	RequestID      string
	UserID         int
	TokenID        int
	CallbackURL    string
	HTTPMethod     string
	Headers        map[string]string
	ContentType    string
	Payload        []byte
	IdempotencyKey string
}

func enqueuePersistentCallbackEvent(req callbackEventEnqueueRequest) error {
	callbackURL := strings.TrimSpace(req.CallbackURL)
	if callbackURL == "" {
		return nil
	}

	payload := req.Payload
	if len(payload) == 0 {
		payload = []byte("{}")
	}

	headersJSON, err := common.Marshal(normalizeCallbackHeaders(req.Headers))
	if err != nil {
		return fmt.Errorf("marshal callback headers: %w", err)
	}

	idempotencyKey := strings.TrimSpace(req.IdempotencyKey)
	if idempotencyKey == "" {
		idempotencyKey = fmt.Sprintf("%s:%s", strings.TrimSpace(req.SinkType), common.GetUUID())
	}

	event := &model.CallbackEvent{
		EventID:        common.GetUUID(),
		IdempotencyKey: idempotencyKey,
		Source:         strings.TrimSpace(req.Source),
		EventType:      strings.TrimSpace(req.EventType),
		SinkType:       strings.TrimSpace(req.SinkType),
		RequestID:      strings.TrimSpace(req.RequestID),
		UserID:         req.UserID,
		TokenID:        req.TokenID,
		CallbackURL:    callbackURL,
		HTTPMethod:     normalizeCallbackMethod(req.HTTPMethod),
		Headers:        string(headersJSON),
		ContentType:    normalizeContentType(req.ContentType),
		Body:           string(payload),
		BodySHA256:     hex.EncodeToString(common.Sha256Raw(payload)),
		Status:         model.CallbackEventStatusPending,
		MaxRetries:     getCallbackDispatchConfig().RetryTimes,
		NextRetryAt:    common.GetTimestamp(),
	}

	if event.MaxRetries < 0 {
		event.MaxRetries = 0
	}
	exists, existsErr := model.CallbackEventExistsBySinkAndIdempotency(event.SinkType, event.IdempotencyKey)
	if existsErr != nil {
		common.SysError(fmt.Sprintf("check callback event duplicate failed: sink=%s key=%s err=%s", event.SinkType, event.IdempotencyKey, existsErr.Error()))
	} else if exists {
		// Fast-path dedupe for common retry/replay cases.
		return nil
	}

	if err := model.InsertCallbackEvent(event); err != nil {
		if isDuplicateEventInsertError(err) {
			return nil
		}
		return fmt.Errorf("insert callback event: %w", err)
	}
	return nil
}

func normalizeCallbackHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return map[string]string{}
	}
	out := make(map[string]string, len(headers))
	for k, v := range headers {
		key := strings.TrimSpace(k)
		if key == "" {
			continue
		}
		out[key] = strings.TrimSpace(v)
	}
	return out
}

func normalizeCallbackMethod(method string) string {
	method = strings.TrimSpace(strings.ToUpper(method))
	if method == "" {
		return "POST"
	}
	return method
}

func normalizeContentType(contentType string) string {
	contentType = strings.TrimSpace(contentType)
	if contentType == "" {
		return "application/json"
	}
	return contentType
}

func isDuplicateEventInsertError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "unique_violation") ||
		strings.Contains(msg, "error 1062")
}
