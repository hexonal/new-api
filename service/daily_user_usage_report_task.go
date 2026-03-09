package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	dailyUserUsageReportDefaultHour   = 0
	dailyUserUsageReportDefaultMinute = 10
	dailyUserUsageReportDefaultTopN   = 20
	dailyUserUsageReportTypeWebhook   = "webhook"
	dailyUserUsageReportTypeFeishu    = "feishu"
)

type dailyUserUsageReportConfig struct {
	Enabled      bool
	ReportType   string
	CallbackURL  string
	Secret       string
	PrefixFilter string
	Hour         int
	Minute       int
}

type dailyUserUsageReportWebhookPayload struct {
	Event     string                      `json:"event"`
	Timestamp string                      `json:"timestamp"`
	Data      *model.DailyUserUsageReport `json:"data"`
}

var (
	dailyUserUsageReportOnce    sync.Once
	dailyUserUsageReportRunning atomic.Bool
)

func StartDailyUserUsageReportTask() {
	dailyUserUsageReportOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			cfg := getDailyUserUsageReportConfig()
			common.SysLog(fmt.Sprintf(
				"daily user usage report task started: daily %02d:%02d type=%s",
				cfg.Hour,
				cfg.Minute,
				cfg.ReportType,
			))
			for {
				cfg = getDailyUserUsageReportConfig()
				waitDuration := durationUntilNextDailyUserUsageReport(time.Now(), cfg.Hour, cfg.Minute)
				timer := time.NewTimer(waitDuration)
				<-timer.C
				runDailyUserUsageReportOnce(time.Now())
			}
		})
	})
}

func durationUntilNextDailyUserUsageReport(now time.Time, hour int, minute int) time.Duration {
	nextRun := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
	if !now.Before(nextRun) {
		nextRun = nextRun.Add(24 * time.Hour)
	}
	return nextRun.Sub(now)
}

func runDailyUserUsageReportOnce(now time.Time) {
	if !dailyUserUsageReportRunning.CompareAndSwap(false, true) {
		return
	}
	defer dailyUserUsageReportRunning.Store(false)

	cfg := getDailyUserUsageReportConfig()
	if !cfg.Enabled || strings.TrimSpace(cfg.CallbackURL) == "" {
		return
	}

	model.SaveQuotaDataCache()

	report, err := model.GetDailyUserUsageReportForYesterday(now, cfg.PrefixFilter, dailyUserUsageReportDefaultTopN)
	if err != nil {
		common.SysError("daily user usage report task failed: " + err.Error())
		return
	}
	if report == nil {
		return
	}

	if err := enqueueDailyUserUsageReport(report, cfg); err != nil {
		common.SysError("daily user usage report enqueue failed: " + err.Error())
		return
	}
	common.SysLog(fmt.Sprintf(
		"daily user usage report queued: date=%s users=%d tokens=%d amount_usd=%.6f",
		report.Date,
		report.TotalUsers,
		report.TotalTokens,
		report.TotalAmountUSD,
	))
}

func getDailyUserUsageReportConfig() dailyUserUsageReportConfig {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	cfg := dailyUserUsageReportConfig{
		Enabled:      common.OptionMap["DailyUserUsageReportEnabled"] == "true",
		ReportType:   strings.TrimSpace(strings.ToLower(common.OptionMap["DailyUserUsageReportType"])),
		CallbackURL:  strings.TrimSpace(common.OptionMap["DailyUserUsageReportUrl"]),
		Secret:       common.OptionMap["DailyUserUsageReportSecret"],
		PrefixFilter: common.OptionMap["DailyUserUsageReportUserPrefixFilter"],
		Hour:         parseDailyUserUsageReportClock(common.OptionMap["DailyUserUsageReportHour"], dailyUserUsageReportDefaultHour, 0, 23),
		Minute:       parseDailyUserUsageReportClock(common.OptionMap["DailyUserUsageReportMinute"], dailyUserUsageReportDefaultMinute, 0, 59),
	}
	if cfg.ReportType == "" {
		cfg.ReportType = dailyUserUsageReportTypeWebhook
	}
	return cfg
}

func parseDailyUserUsageReportClock(raw string, fallback int, min int, max int) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	if value < min || value > max {
		return fallback
	}
	return value
}

func enqueueDailyUserUsageReport(report *model.DailyUserUsageReport, cfg dailyUserUsageReportConfig) error {
	switch cfg.ReportType {
	case dailyUserUsageReportTypeFeishu:
		return enqueueDailyUserUsageReportFeishu(report, cfg)
	default:
		return enqueueDailyUserUsageReportWebhook(report, cfg)
	}
}

func enqueueDailyUserUsageReportWebhook(report *model.DailyUserUsageReport, cfg dailyUserUsageReportConfig) error {
	timestamp := strconv.FormatInt(common.GetTimestamp(), 10)
	payload, err := common.Marshal(dailyUserUsageReportWebhookPayload{
		Event:     "daily_user_usage_report",
		Timestamp: timestamp,
		Data:      report,
	})
	if err != nil {
		return fmt.Errorf("marshal webhook payload: %w", err)
	}

	headers := map[string]string{
		"X-New-Api-Timestamp": timestamp,
	}
	if strings.TrimSpace(cfg.Secret) != "" {
		headers["X-New-Api-Signature"] = signDailyUserUsageReport(cfg.Secret, timestamp, payload)
	}

	return enqueuePersistentCallbackEvent(callbackEventEnqueueRequest{
		Source:         "daily_user_usage_report",
		EventType:      "daily_user_usage_report",
		SinkType:       "daily_user_usage_report_webhook",
		RequestID:      buildDailyUserUsageReportRequestID(report),
		CallbackURL:    cfg.CallbackURL,
		HTTPMethod:     "POST",
		Headers:        headers,
		ContentType:    "application/json",
		Payload:        payload,
		IdempotencyKey: fmt.Sprintf("daily_user_usage_report:webhook:%s", report.Date),
	})
}

func enqueueDailyUserUsageReportFeishu(report *model.DailyUserUsageReport, cfg dailyUserUsageReportConfig) error {
	body, err := common.Marshal(map[string]any{
		"msg_type": "text",
		"content": map[string]string{
			"text": formatDailyUserUsageReportFeishuText(report),
		},
	})
	if err != nil {
		return fmt.Errorf("marshal feishu payload: %w", err)
	}

	return enqueuePersistentCallbackEvent(callbackEventEnqueueRequest{
		Source:         model.CallbackEventSourceFeishu,
		EventType:      "daily_user_usage_report",
		SinkType:       model.CallbackEventSinkFeishuWebhook,
		RequestID:      buildDailyUserUsageReportRequestID(report),
		CallbackURL:    cfg.CallbackURL,
		HTTPMethod:     "POST",
		ContentType:    "application/json",
		Payload:        body,
		IdempotencyKey: fmt.Sprintf("daily_user_usage_report:feishu:%s", report.Date),
	})
}

func formatDailyUserUsageReportFeishuText(report *model.DailyUserUsageReport) string {
	var builder strings.Builder
	builder.WriteString("[new-api] Daily User Usage Report\n")
	builder.WriteString(fmt.Sprintf("Date: %s\n", report.Date))
	if len(report.Prefixes) > 0 {
		builder.WriteString(fmt.Sprintf("Prefixes: %s\n", strings.Join(report.Prefixes, ", ")))
	}
	builder.WriteString(fmt.Sprintf("Users: %d\n", report.TotalUsers))
	builder.WriteString(fmt.Sprintf("Messages: %d\n", report.TotalMessages))
	builder.WriteString(fmt.Sprintf("Tokens: %d\n", report.TotalTokens))
	builder.WriteString(fmt.Sprintf("Amount USD: %.6f\n", report.TotalAmountUSD))
	builder.WriteString("Top 20:\n")
	for index, item := range report.Ranking {
		builder.WriteString(fmt.Sprintf(
			"%d. %s | messages=%d | tokens=%d | amount=$%.6f\n",
			index+1,
			item.Username,
			item.Messages,
			item.Tokens,
			item.AmountUSD,
		))
	}
	return strings.TrimSpace(builder.String())
}

func buildDailyUserUsageReportRequestID(report *model.DailyUserUsageReport) string {
	if report == nil {
		return common.GetUUID()
	}
	return fmt.Sprintf("daily-user-usage-report-%s", report.Date)
}

func signDailyUserUsageReport(secret string, timestamp string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func SendDailyUserUsageReportNow(ctx context.Context) error {
	_ = ctx
	runDailyUserUsageReportOnce(time.Now())
	return nil
}
