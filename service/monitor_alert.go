package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
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
	monitorAlertContextSentKey         = "monitor_alert_sent"
)

type monitorAlertConfig struct {
	Enabled              bool
	Name                 string
	AlertType            string
	CallbackURL          string
	Secret               string
	MaskSensitive        bool
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
	maskedSKPattern       = regexp.MustCompile(`sk-[A-Za-z0-9]{1,8}\*{3}[A-Za-z0-9]{1,8}`)
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
	if monitorAlertAlreadySent(c) {
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
		"token_sk":     strings.TrimSpace(c.GetString("token_key")),
		"channel_id":   channelError.ChannelId,
		"channel_name": strings.TrimSpace(c.GetString("channel_name")),
		"channel_type": c.GetInt("channel_type"),
	}
	if c.Request != nil && c.Request.URL != nil {
		data["request_path"] = c.Request.URL.Path
	}

	idempotencyKey := fmt.Sprintf("monitor_alert:call_error:%s", nonEmptyMonitorAlertID(requestID))
	markMonitorAlertSent(c)
	gopool.Go(func() {
		if enqueueErr := enqueueMonitorAlert(cfg, "API call error", requestID, data, idempotencyKey); enqueueErr != nil {
			common.SysError("enqueue monitor call error alert failed: " + enqueueErr.Error())
		}
	})
}

func NotifyMonitorAPIError(c *gin.Context, title string, statusCode int, message string, errorType string, errorCode string) {
	if c == nil {
		return
	}
	if monitorAlertAlreadySent(c) {
		return
	}
	cfg := getMonitorAlertConfig()
	if !cfg.Enabled || !cfg.CallErrorEnabled || strings.TrimSpace(cfg.CallbackURL) == "" {
		return
	}

	requestID := strings.TrimSpace(c.GetString(common.RequestIdKey))
	data := map[string]interface{}{
		"kind":         "api_error",
		"request_id":   requestID,
		"request_path": "",
		"status_code":  statusCode,
		"error_type":   strings.TrimSpace(errorType),
		"error_code":   strings.TrimSpace(errorCode),
		"error":        strings.TrimSpace(message),
		"user_id":      c.GetInt("id"),
		"username":     strings.TrimSpace(c.GetString("username")),
		"group":        strings.TrimSpace(c.GetString("group")),
		"model_name":   strings.TrimSpace(c.GetString("original_model")),
		"token_name":   strings.TrimSpace(c.GetString("token_name")),
		"token_sk":     strings.TrimSpace(c.GetString("token_key")),
		"channel_id":   c.GetInt("channel_id"),
		"channel_name": strings.TrimSpace(c.GetString("channel_name")),
		"channel_type": c.GetInt("channel_type"),
	}
	if c.Request != nil && c.Request.URL != nil {
		data["request_path"] = c.Request.URL.Path
	}
	idempotencyKey := fmt.Sprintf("monitor_alert:api_error:%s", nonEmptyMonitorAlertID(requestID))
	markMonitorAlertSent(c)
	gopool.Go(func() {
		if enqueueErr := enqueueMonitorAlert(cfg, title, requestID, data, idempotencyKey); enqueueErr != nil {
			common.SysError("enqueue monitor api error alert failed: " + enqueueErr.Error())
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
		"token_sk":          strings.TrimSpace(event.TokenSKSnapshot),
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
		MaskSensitive:        common.OptionMap["MonitorAlertMaskSensitiveEnabled"] == "true",
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
	data = sanitizeMonitorAlertData(cfg, data)
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
		"user_id", "username", "group", "model_name", "token_name", "token_sk", "channel_id", "channel_name", "channel_type",
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

func sanitizeMonitorAlertData(cfg monitorAlertConfig, data map[string]interface{}) map[string]interface{} {
	sanitized := make(map[string]interface{}, len(data))
	for key, value := range data {
		sanitized[key] = value
	}

	tokenSK := normalizeMonitorAlertTokenSK(sanitized["token_sk"])
	if cfg.MaskSensitive {
		if tokenSK != "" {
			sanitized["token_sk"] = maskMonitorAlertSK(tokenSK)
		}
		for _, key := range []string{"error", "response", "callback_url", "request_path"} {
			text := strings.TrimSpace(fmt.Sprintf("%v", sanitized[key]))
			if text != "" {
				sanitized[key] = common.MaskSensitiveInfo(text)
			}
		}
		return sanitized
	}

	if tokenSK != "" {
		sanitized["token_sk"] = tokenSK
		if text := strings.TrimSpace(fmt.Sprintf("%v", sanitized["error"])); text != "" {
			sanitized["error"] = restoreMonitorAlertSK(text, tokenSK)
		}
		if text := strings.TrimSpace(fmt.Sprintf("%v", sanitized["response"])); text != "" {
			sanitized["response"] = restoreMonitorAlertSK(text, tokenSK)
		}
	}
	return sanitized
}

func normalizeMonitorAlertTokenSK(raw interface{}) string {
	text := strings.TrimSpace(fmt.Sprintf("%v", raw))
	if text == "" || text == "<nil>" {
		return ""
	}
	if strings.HasPrefix(text, "sk-") {
		return text
	}
	return "sk-" + text
}

func maskMonitorAlertSK(raw string) string {
	raw = normalizeMonitorAlertTokenSK(raw)
	if raw == "" {
		return ""
	}
	key := strings.TrimPrefix(raw, "sk-")
	if len(key) <= 8 {
		return "sk-***"
	}
	return fmt.Sprintf("sk-%s***%s", key[:4], key[len(key)-4:])
}

func restoreMonitorAlertSK(text string, tokenSK string) string {
	tokenSK = normalizeMonitorAlertTokenSK(tokenSK)
	if tokenSK == "" || strings.TrimSpace(text) == "" {
		return text
	}
	return maskedSKPattern.ReplaceAllString(text, tokenSK)
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

func monitorAlertAlreadySent(c *gin.Context) bool {
	if c == nil {
		return false
	}
	return c.GetBool(monitorAlertContextSentKey)
}

func markMonitorAlertSent(c *gin.Context) {
	if c == nil {
		return
	}
	c.Set(monitorAlertContextSentKey, true)
}

func monitorAlertNodeName() string {
	host := strings.TrimSpace(common.GetEnvOrDefaultString("HOSTNAME", ""))
	if host != "" {
		return host
	}
	ip := strings.TrimSpace(common.GetIp())
	if ip != "" {
		return ip
	}
	return "node"
}

func isMonitorAlertCallbackEvent(event *model.CallbackEvent) bool {
	if event == nil {
		return false
	}
	return strings.TrimSpace(event.EventType) == "monitor.alert" || strings.TrimSpace(event.Source) == "monitor"
}
