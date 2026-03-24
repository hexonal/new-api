package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type operatorCallbackPayload struct {
	Event     string               `json:"event"`
	Timestamp string               `json:"timestamp"`
	Data      operatorCallbackData `json:"data"`
}

type operatorCallbackData struct {
	Sk             string `json:"sk"`
	UserID         int    `json:"user_id"`
	RemainingQuota int    `json:"remaining_quota"`
	Threshold      int    `json:"threshold"`
	RemainingUSD   string `json:"remaining_usd"`
}

func normalizeOperatorCallbackSK(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	if strings.HasPrefix(value, "sk-") || strings.HasPrefix(value, "customer-sk-") {
		return value
	}
	// Keep no-prefix custom token forms (e.g. ima_abc123) unchanged.
	return value
}

// SendFeishuQuotaNotify writes a quota-warning callback event for Feishu webhook delivery.
func SendFeishuQuotaNotify(userId int, username string, requestID string, remainingQuota int, threshold int) {
	common.OptionMapRWMutex.RLock()
	enabled := common.OptionMap["FeishuNotifyEnabled"] == "true"
	webhookURL := common.OptionMap["FeishuWebhookUrl"]
	common.OptionMapRWMutex.RUnlock()

	if !enabled || strings.TrimSpace(webhookURL) == "" {
		return
	}

	remainingUSD := float64(remainingQuota) / common.QuotaPerUnit
	text := fmt.Sprintf(
		"[Zcheap AI] 用户额度预警\n用户 ID：%d\n用户名：%s\n剩余额度：%d（≈ $%.4f）\n阈值：%d",
		userId, username, remainingQuota, remainingUSD, threshold,
	)
	body, err := common.Marshal(map[string]any{
		"msg_type": "text",
		"content":  map[string]string{"text": text},
	})
	if err != nil {
		common.SysError(fmt.Sprintf("feishu notify marshal failed for user %d: %s", userId, err.Error()))
		return
	}

	idempotencyKey := buildQuotaWarningIdempotencyKey("feishu", userId, requestID)
	if err := enqueuePersistentCallbackEvent(callbackEventEnqueueRequest{
		Source:         "feishu",
		EventType:      "quota.warning",
		SinkType:       "feishu_webhook",
		RequestID:      requestID,
		UserID:         userId,
		Username:       username,
		CallbackURL:    webhookURL,
		HTTPMethod:     "POST",
		ContentType:    "application/json",
		Payload:        body,
		IdempotencyKey: idempotencyKey,
	}); err != nil {
		common.SysError(fmt.Sprintf("enqueue feishu callback failed for user %d: %s", userId, err.Error()))
	}
}

// SendOperatorCallback writes a quota-warning callback event for operator webhook delivery.
func SendOperatorCallback(userId int, sk string, requestID string, remainingQuota int, threshold int) {
	common.OptionMapRWMutex.RLock()
	enabled := common.OptionMap["OperatorCallbackEnabled"] == "true"
	callbackURL := common.OptionMap["OperatorCallbackUrl"]
	secret := common.OptionMap["OperatorCallbackSecret"]
	common.OptionMapRWMutex.RUnlock()
	if !enabled || strings.TrimSpace(callbackURL) == "" {
		return
	}

	timestamp := strconv.FormatInt(common.GetTimestamp(), 10)
	remainingUSD := fmt.Sprintf("%.4f", float64(remainingQuota)/common.QuotaPerUnit)
	payload, err := common.Marshal(operatorCallbackPayload{
		Event:     "quota.warning",
		Timestamp: timestamp,
		Data: operatorCallbackData{
			Sk:             normalizeOperatorCallbackSK(sk),
			UserID:         userId,
			RemainingQuota: remainingQuota,
			Threshold:      threshold,
			RemainingUSD:   remainingUSD,
		},
	})
	if err != nil {
		common.SysError(fmt.Sprintf("operator callback payload marshal failed for user %d: %s", userId, err.Error()))
		return
	}

	headers := map[string]string{
		"X-New-Api-Timestamp": timestamp,
	}
	if secret != "" {
		headers["X-New-Api-Signature"] = signOperatorCallback(secret, timestamp, payload)
	}

	idempotencyKey := buildQuotaWarningIdempotencyKey("operator", userId, requestID)
	if err := enqueuePersistentCallbackEvent(callbackEventEnqueueRequest{
		Source:         "operator",
		EventType:      "quota.warning",
		SinkType:       "operator_webhook",
		RequestID:      requestID,
		UserID:         userId,
		TokenSK:        normalizeOperatorCallbackSK(sk),
		CallbackURL:    callbackURL,
		HTTPMethod:     "POST",
		Headers:        headers,
		ContentType:    "application/json",
		Payload:        payload,
		IdempotencyKey: idempotencyKey,
	}); err != nil {
		common.SysError(fmt.Sprintf("enqueue operator callback failed for user %d: %s", userId, err.Error()))
	}
}

func buildQuotaWarningIdempotencyKey(prefix string, userID int, requestID string) string {
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		requestID = common.GetUUID()
	}
	return fmt.Sprintf("%s:quota.warning:%d:%s", prefix, userID, requestID)
}

func signOperatorCallback(secret string, timestamp string, payload []byte) string {
	// Signature spec: HMAC_SHA256(timestamp + "." + raw_payload).
	// Receiver must verify with the same concatenation order.
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}
