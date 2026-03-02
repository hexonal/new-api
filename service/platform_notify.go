package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
)

// SendFeishuQuotaNotify sends a quota warning message to the platform Feishu webhook.
// Called when any user's remaining quota drops below the threshold.
func SendFeishuQuotaNotify(userId int, username string, remainingQuota int, threshold int) {
	common.OptionMapRWMutex.RLock()
	enabled := common.OptionMap["FeishuNotifyEnabled"] == "true"
	webhookUrl := common.OptionMap["FeishuWebhookUrl"]
	common.OptionMapRWMutex.RUnlock()

	if !enabled || webhookUrl == "" {
		return
	}

	remainingUSD := float64(remainingQuota) / common.QuotaPerUnit
	text := fmt.Sprintf(
		"[Zcheap AI] 用户额度预警\n用户 ID：%d\n用户名：%s\n剩余额度：%d（≈ $%.4f）\n阈值：%d",
		userId, username, remainingQuota, remainingUSD, threshold,
	)

	body, _ := common.Marshal(map[string]any{
		"msg_type": "text",
		"content":  map[string]string{"text": text},
	})

	resp, err := http.Post(webhookUrl, "application/json", bytes.NewReader(body))
	if err != nil {
		common.SysError(fmt.Sprintf("feishu notify failed for user %d: %s", userId, err.Error()))
		return
	}
	resp.Body.Close()
}

// SendOperatorCallback posts a quota warning event to the configured operator callback URL.
// The request is signed with HMAC-SHA256 using OperatorCallbackSecret.
func SendOperatorCallback(userId int, sk string, remainingQuota int, threshold int) {
	common.OptionMapRWMutex.RLock()
	enabled := common.OptionMap["OperatorCallbackEnabled"] == "true"
	callbackUrl := common.OptionMap["OperatorCallbackUrl"]
	secret := common.OptionMap["OperatorCallbackSecret"]
	common.OptionMapRWMutex.RUnlock()

	if !enabled || callbackUrl == "" {
		return
	}

	timestamp := strconv.FormatInt(common.GetTimestamp(), 10)
	remainingUSD := fmt.Sprintf("%.4f", float64(remainingQuota)/common.QuotaPerUnit)

	payload, _ := common.Marshal(map[string]any{
		"event":     "quota.warning",
		"timestamp": timestamp,
		"data": map[string]any{
			"sk":              "sk-" + sk,
			"user_id":         userId,
			"remaining_quota": remainingQuota,
			"threshold":       threshold,
			"remaining_usd":   remainingUSD,
		},
	})

	req, err := http.NewRequest(http.MethodPost, callbackUrl, bytes.NewReader(payload))
	if err != nil {
		common.SysError(fmt.Sprintf("operator callback request build failed for user %d: %s", userId, err.Error()))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-New-Api-Timestamp", timestamp)

	if secret != "" {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(timestamp + "."))
		mac.Write(payload)
		req.Header.Set("X-New-Api-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		common.SysError(fmt.Sprintf("operator callback failed for user %d: %s", userId, err.Error()))
		return
	}
	resp.Body.Close()
}
