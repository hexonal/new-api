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
	Name         string
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
		Name:         strings.TrimSpace(common.OptionMap["DailyUserUsageReportName"]),
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
	if cfg.Name == "" {
		cfg.Name = strings.TrimSpace(common.OptionMap["SystemName"])
	}
	if cfg.Name == "" {
		cfg.Name = "new-api"
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
	body, err := common.Marshal(buildDailyUserUsageReportFeishuCard(report, cfg.Name))
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

func buildDailyUserUsageReportFeishuCard(report *model.DailyUserUsageReport, reportName string) map[string]any {
	prefixes := "-"
	if len(report.Prefixes) > 0 {
		prefixes = strings.Join(report.Prefixes, ", ")
	}
	if strings.TrimSpace(reportName) == "" {
		reportName = "new-api"
	}

	return map[string]any{
		"msg_type": "interactive",
		"card": map[string]any{
			"config": map[string]any{
				"wide_screen_mode": true,
				"enable_forward":   true,
			},
			"header": map[string]any{
				"template": "blue",
				"title": map[string]any{
					"tag":     "plain_text",
					"content": fmt.Sprintf("[%s] Daily User Usage Report", reportName),
				},
			},
			"elements": []map[string]any{
				{
					"tag": "div",
					"fields": []map[string]any{
						buildDailyUserUsageReportFeishuField("Date", report.Date),
						buildDailyUserUsageReportFeishuField("Prefixes", prefixes),
						buildDailyUserUsageReportFeishuField("Users", fmt.Sprintf("%d", report.TotalUsers)),
						buildDailyUserUsageReportFeishuField("Messages", fmt.Sprintf("%d", report.TotalMessages)),
						buildDailyUserUsageReportFeishuField("Tokens", fmt.Sprintf("%d", report.TotalTokens)),
						buildDailyUserUsageReportFeishuField("Amount USD", fmt.Sprintf("$%.6f", report.TotalAmountUSD)),
					},
				},
				{
					"tag": "hr",
				},
				{
					"tag": "div",
					"text": map[string]any{
						"tag":     "lark_md",
						"content": formatDailyUserUsageReportFeishuRanking(report.Ranking),
					},
				},
				{
					"tag": "note",
					"elements": []map[string]any{
						{
							"tag":     "lark_md",
							"content": "Generated automatically from the previous day's usage summary.",
						},
					},
				},
			},
		},
	}
}

func buildDailyUserUsageReportFeishuField(label string, value string) map[string]any {
	return map[string]any{
		"is_short": true,
		"text": map[string]any{
			"tag":     "lark_md",
			"content": fmt.Sprintf("**%s**\n%s", label, value),
		},
	}
}

func formatDailyUserUsageReportFeishuRanking(items []model.DailyUserUsageRankingItem) string {
	if len(items) == 0 {
		return "**User Ranking**\nNo matching users found."
	}

	var builder strings.Builder
	builder.WriteString("**User Ranking**\n")
	for index, item := range items {
		rankLabel := fmt.Sprintf("#%d", index+1)
		switch index {
		case 0:
			rankLabel = "🥇 #1"
		case 1:
			rankLabel = "🥈 #2"
		case 2:
			rankLabel = "🥉 #3"
		}
		builder.WriteString(fmt.Sprintf(
			"%s %s\nMessages: %d\nTokens: %d\nAmount: $%.6f\n\n",
			rankLabel,
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
