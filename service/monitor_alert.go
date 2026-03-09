package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	monitorAlertTypeWebhook = "webhook"
	monitorAlertTypeFeishu  = "feishu"

	monitorAlertDefaultDiskThreshold   = 90
	monitorAlertDefaultCooldownMinutes = 60
	monitorAlertDiskPollInterval       = time.Minute
)

type monitorAlertConfig struct {
	Enabled              bool
	Name                 string
	AlertType            string
	CallbackURL          string
	Secret               string
	CallErrorEnabled     bool
	CallbackErrorEnabled bool
	DiskEnabled          bool
	DiskThresholdPercent int
	CooldownMinutes      int
}

type monitorAlertWebhookPayload struct {
	Event     string                 `json:"event"`
	Timestamp string                 `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

var (
	monitorAlertOnce      sync.Once
	monitorAlertCooldowns sync.Map
)

func StartMonitorAlertTask() {
	monitorAlertOnce.Do(func() {
		gopool.Go(func() {
			ticker := time.NewTicker(monitorAlertDiskPollInterval)
			defer ticker.Stop()
			common.SysLog("monitor alert task started")
			checkMonitorDiskAlert(time.Now())
			for now := range ticker.C {
				checkMonitorDiskAlert(now)
			}
		})
	})
}

func NotifyMonitorCallError(c *gin.Context, channelError types.ChannelError, err *types.NewAPIError) {
	if c == nil || err == nil {
		return
	}
	cfg := getMonitorAlertConfig()
	if !cfg.Enabled || !cfg.CallErrorEnabled || strings.TrimSpace(cfg.CallbackURL) == "" {
		return
	}

	requestID := strings.TrimSpace(c.GetString(common.RequestIdKey))
	data := map[string]interface{}{
		"kind":         "call_error",
		"request_id":   requestID,
		"request_path": "",
		"node":         monitorAlertNodeName(),
		"status_code":  err.StatusCode,
		"error_type":   err.GetErrorType(),
		"error_code":   err.GetErrorCode(),
		"error":        err.ErrorWithStatusCode(),
		"user_id":      c.GetInt("id"),
		"username":     strings.TrimSpace(c.GetString("username")),
		"group":        strings.TrimSpace(c.GetString("group")),
		"model_name":   strings.TrimSpace(c.GetString("original_model")),
		"token_name":   strings.TrimSpace(c.GetString("token_name")),
		"channel_id":   channelError.ChannelId,
		"channel_name": strings.TrimSpace(c.GetString("channel_name")),
		"channel_type": c.GetInt("channel_type"),
	}
	if c.Request != nil && c.Request.URL != nil {
		data["request_path"] = c.Request.URL.Path
	}

	idempotencyKey := fmt.Sprintf("monitor_alert:call_error:%s", nonEmptyMonitorAlertID(requestID))
	gopool.Go(func() {
		if enqueueErr := enqueueMonitorAlert(cfg, "API call error", requestID, data, idempotencyKey); enqueueErr != nil {
			common.SysError("enqueue monitor call error alert failed: " + enqueueErr.Error())
		}
	})
}

func NotifyMonitorCallbackError(event *model.CallbackEvent, attemptNo int, statusCode int, errMsg string, responseSnippet string) {
	if event == nil || isMonitorAlertCallbackEvent(event) {
		return
	}
	cfg := getMonitorAlertConfig()
	if !cfg.Enabled || !cfg.CallbackErrorEnabled || strings.TrimSpace(cfg.CallbackURL) == "" {
		return
	}

	data := map[string]interface{}{
		"kind":              "callback_error",
		"request_id":        strings.TrimSpace(event.RequestID),
		"node":              monitorAlertNodeName(),
		"callback_event_id": event.ID,
		"callback_event":    strings.TrimSpace(event.EventType),
		"sink_type":         strings.TrimSpace(event.SinkType),
		"source":            strings.TrimSpace(event.Source),
		"attempt_no":        attemptNo,
		"http_status":       statusCode,
		"error":             strings.TrimSpace(errMsg),
		"response":          strings.TrimSpace(responseSnippet),
		"callback_url":      strings.TrimSpace(event.CallbackURL),
		"user_id":           event.UserID,
		"username":          strings.TrimSpace(event.UsernameSnapshot),
		"token_id":          event.TokenID,
		"token_name":        strings.TrimSpace(event.TokenNameSnapshot),
	}

	idempotencyKey := fmt.Sprintf("monitor_alert:callback_error:%d:%d", event.ID, attemptNo)
	gopool.Go(func() {
		if enqueueErr := enqueueMonitorAlert(cfg, "Callback delivery failed", strings.TrimSpace(event.RequestID), data, idempotencyKey); enqueueErr != nil {
			common.SysError("enqueue monitor callback error alert failed: " + enqueueErr.Error())
		}
	})
}

func checkMonitorDiskAlert(now time.Time) {
	cfg := getMonitorAlertConfig()
	if !cfg.Enabled || !cfg.DiskEnabled || strings.TrimSpace(cfg.CallbackURL) == "" {
		return
	}

	diskInfo := common.GetDiskSpaceInfo()
	if diskInfo.Total == 0 || diskInfo.UsedPercent < float64(cfg.DiskThresholdPercent) {
		return
	}
	if !allowMonitorAlertByCooldown("disk_low", now, cfg.CooldownMinutes) {
		return
	}

	cacheFiles, cacheBytes, _ := common.GetDiskCacheInfo()
	data := map[string]interface{}{
		"kind":               "disk_low",
		"request_id":         "",
		"cache_path":         common.GetDiskCacheDir(),
		"used_percent":       fmt.Sprintf("%.2f%%", diskInfo.UsedPercent),
		"threshold_percent":  cfg.DiskThresholdPercent,
		"total":              common.Bytes2Size(int64(diskInfo.Total)),
		"used":               common.Bytes2Size(int64(diskInfo.Used)),
		"free":               common.Bytes2Size(int64(diskInfo.Free)),
		"cache_file_count":   cacheFiles,
		"cache_total_size":   common.Bytes2Size(cacheBytes),
		"cooldown_minutes":   cfg.CooldownMinutes,
		"monitor_trigger_at": now.Format(time.RFC3339),
	}
	idempotencyKey := fmt.Sprintf("monitor_alert:disk_low:%s", now.Format("200601021504"))
	if err := enqueueMonitorAlert(cfg, "Disk space is low", "", data, idempotencyKey); err != nil {
		common.SysError("enqueue monitor disk alert failed: " + err.Error())
	}
}

func getMonitorAlertConfig() monitorAlertConfig {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	cfg := monitorAlertConfig{
		Enabled:              common.OptionMap["MonitorAlertEnabled"] == "true",
		AlertType:            strings.TrimSpace(strings.ToLower(common.OptionMap["MonitorAlertType"])),
		CallbackURL:          strings.TrimSpace(common.OptionMap["MonitorAlertUrl"]),
		Secret:               common.OptionMap["MonitorAlertSecret"],
		CallErrorEnabled:     common.OptionMap["MonitorAlertCallErrorEnabled"] != "false",
		CallbackErrorEnabled: common.OptionMap["MonitorAlertCallbackErrorEnabled"] != "false",
		DiskEnabled:          common.OptionMap["MonitorAlertDiskEnabled"] != "false",
		DiskThresholdPercent: parseMonitorAlertIntOption(common.OptionMap["MonitorAlertDiskThresholdPercent"], monitorAlertDefaultDiskThreshold, 1, 99),
		CooldownMinutes:      parseMonitorAlertIntOption(common.OptionMap["MonitorAlertCooldownMinutes"], monitorAlertDefaultCooldownMinutes, 1, 1440),
	}
	if cfg.AlertType == "" {
		cfg.AlertType = monitorAlertTypeFeishu
	}
	return cfg
}

func parseMonitorAlertIntOption(raw string, fallback int, min int, max int) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	if value < min || value > max {
		return fallback
	}
	return value
}

func allowMonitorAlertByCooldown(key string, now time.Time, cooldownMinutes int) bool {
	if cooldownMinutes <= 0 {
		return true
	}
	lastValue, ok := monitorAlertCooldowns.Load(key)
	if ok {
		lastSent, typeOK := lastValue.(time.Time)
		if typeOK && now.Sub(lastSent) < time.Duration(cooldownMinutes)*time.Minute {
			return false
		}
	}
	monitorAlertCooldowns.Store(key, now)
	return true
}

func enqueueMonitorAlert(cfg monitorAlertConfig, title string, requestID string, data map[string]interface{}, idempotencyKey string) error {
	switch cfg.AlertType {
	case monitorAlertTypeWebhook:
		return enqueueMonitorAlertWebhook(cfg, title, requestID, data, idempotencyKey)
	default:
		return enqueueMonitorAlertFeishu(cfg, title, requestID, data, idempotencyKey)
	}
}

func enqueueMonitorAlertWebhook(cfg monitorAlertConfig, title string, requestID string, data map[string]interface{}, idempotencyKey string) error {
	timestamp := strconv.FormatInt(common.GetTimestamp(), 10)
	payload, err := common.Marshal(monitorAlertWebhookPayload{
		Event:     "monitor.alert",
		Timestamp: timestamp,
		Data:      mergeMonitorAlertData(title, requestID, data),
	})
	if err != nil {
		return fmt.Errorf("marshal monitor webhook payload: %w", err)
	}

	headers := map[string]string{
		"X-New-Api-Timestamp": timestamp,
	}
	if strings.TrimSpace(cfg.Secret) != "" {
		headers["X-New-Api-Signature"] = signMonitorAlert(cfg.Secret, timestamp, payload)
	}

	return enqueuePersistentCallbackEvent(callbackEventEnqueueRequest{
		Source:         "monitor",
		EventType:      "monitor.alert",
		SinkType:       "monitor_webhook",
		RequestID:      requestID,
		CallbackURL:    cfg.CallbackURL,
		HTTPMethod:     "POST",
		Headers:        headers,
		ContentType:    "application/json",
		Payload:        payload,
		IdempotencyKey: idempotencyKey,
	})
}

func enqueueMonitorAlertFeishu(cfg monitorAlertConfig, title string, requestID string, data map[string]interface{}, idempotencyKey string) error {
	body, err := common.Marshal(buildMonitorAlertFeishuCard(title, requestID, data))
	if err != nil {
		return fmt.Errorf("marshal monitor feishu payload: %w", err)
	}

	return enqueuePersistentCallbackEvent(callbackEventEnqueueRequest{
		Source:         model.CallbackEventSourceFeishu,
		EventType:      "monitor.alert",
		SinkType:       model.CallbackEventSinkFeishuWebhook,
		RequestID:      requestID,
		CallbackURL:    cfg.CallbackURL,
		HTTPMethod:     "POST",
		ContentType:    "application/json",
		Payload:        body,
		IdempotencyKey: idempotencyKey,
	})
}

func buildMonitorAlertFeishuCard(title string, requestID string, data map[string]interface{}) map[string]interface{} {
	content := formatMonitorAlertMarkdown(title, requestID, data)
	return map[string]interface{}{
		"msg_type": "interactive",
		"card": map[string]interface{}{
			"config": map[string]interface{}{
				"wide_screen_mode": true,
				"enable_forward":   true,
			},
			"header": map[string]interface{}{
				"template": "red",
				"title": map[string]interface{}{
					"tag":     "plain_text",
					"content": title,
				},
			},
			"elements": []map[string]interface{}{
				{
					"tag": "div",
					"text": map[string]interface{}{
						"tag":     "lark_md",
						"content": content,
					},
				},
			},
		},
	}
}

func formatMonitorAlertMarkdown(title string, requestID string, data map[string]interface{}) string {
	lines := []string{
		fmt.Sprintf("**%s**", title),
		fmt.Sprintf("Time: %s", time.Now().Format("2006-01-02 15:04:05")),
	}
	if strings.TrimSpace(requestID) != "" {
		lines = append(lines, fmt.Sprintf("Request ID: %s", requestID))
	}
	orderedKeys := []string{
		"kind", "request_path", "status_code", "error_type", "error_code", "error",
		"user_id", "username", "group", "model_name", "token_name", "channel_id", "channel_name", "channel_type",
		"callback_event_id", "callback_event", "sink_type", "source", "attempt_no", "http_status", "callback_url", "response",
		"cache_path", "used_percent", "threshold_percent", "total", "used", "free", "cache_file_count", "cache_total_size",
	}
	for _, key := range orderedKeys {
		value, ok := data[key]
		if !ok {
			continue
		}
		text := strings.TrimSpace(fmt.Sprintf("%v", value))
		if text == "" {
			continue
		}
		lines = append(lines, fmt.Sprintf("%s: %s", strings.ReplaceAll(key, "_", " "), text))
	}
	return strings.Join(lines, "\n")
}

func mergeMonitorAlertData(title string, requestID string, data map[string]interface{}) map[string]interface{} {
	merged := map[string]interface{}{
		"title":      title,
		"request_id": requestID,
		"time":       time.Now().Format(time.RFC3339),
	}
	for key, value := range data {
		merged[key] = value
	}
	return merged
}

func signMonitorAlert(secret string, timestamp string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func nonEmptyMonitorAlertID(value string) string {
	value = strings.TrimSpace(value)
	if value != "" {
		return value
	}
	return common.GetUUID()
}

func isMonitorAlertCallbackEvent(event *model.CallbackEvent) bool {
	if event == nil {
		return false
	}
	return strings.TrimSpace(event.EventType) == "monitor.alert" || strings.TrimSpace(event.Source) == "monitor"
}
