package service

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestAllowMonitorAlertByCooldown(t *testing.T) {
	monitorAlertCooldowns = sync.Map{}
	now := time.Date(2026, 3, 10, 10, 0, 0, 0, time.UTC)

	require.True(t, allowMonitorAlertByCooldown("disk_low", now, 60))
	require.False(t, allowMonitorAlertByCooldown("disk_low", now.Add(30*time.Minute), 60))
	require.True(t, allowMonitorAlertByCooldown("disk_low", now.Add(61*time.Minute), 60))
}

func TestIsMonitorAlertCallbackEvent(t *testing.T) {
	require.True(t, isMonitorAlertCallbackEvent(&model.CallbackEvent{
		EventType: "monitor.alert",
	}))
	require.True(t, isMonitorAlertCallbackEvent(&model.CallbackEvent{
		Source: "monitor",
	}))
	require.False(t, isMonitorAlertCallbackEvent(&model.CallbackEvent{
		EventType: "daily_user_usage_report",
		Source:    "feishu",
	}))
}

func TestFormatMonitorAlertMarkdown(t *testing.T) {
	output := formatMonitorAlertMarkdown("API call error", "req-123", map[string]interface{}{
		"status_code": 401,
		"error":       "invalid token",
		"model_name":  "gpt-4.1-mini",
		"site_domain": "zcheap.ai",
	})
	require.Contains(t, output, "API call error")
	require.Contains(t, output, "Request ID: req-123")
	require.Contains(t, output, "site domain: zcheap.ai")
	require.Contains(t, output, "status code: 401")
	require.Contains(t, output, "model name: gpt-4.1-mini")
}

func TestExtractMonitorAlertDomain(t *testing.T) {
	require.Equal(t, "zcheap.ai", extractMonitorAlertDomain("zcheap.ai"))
	require.Equal(t, "zcheap.ai", extractMonitorAlertDomain("zcheap.ai:443"))
	require.Equal(t, "zcheap.ai", extractMonitorAlertDomain("https://zcheap.ai/console"))
	require.Equal(t, "zcheap.ai", extractMonitorAlertDomain("zcheap.ai, proxy.local"))
}

func TestBuildMonitorAlertTitleWithDomain(t *testing.T) {
	require.Equal(t,
		"API request rejected-zcheap.ai",
		buildMonitorAlertTitleWithDomain("API request rejected", map[string]interface{}{"site_domain": "zcheap.ai"}),
	)
	require.Equal(t,
		"API request rejected-zcheap.ai",
		buildMonitorAlertTitleWithDomain("API request rejected-zcheap.ai", map[string]interface{}{"site_domain": "zcheap.ai"}),
	)
	require.Equal(t,
		"API request rejected",
		buildMonitorAlertTitleWithDomain("API request rejected", map[string]interface{}{}),
	)
}

func TestSanitizeMonitorAlertDataMaskDisabledRestoresTokenSK(t *testing.T) {
	cfg := monitorAlertConfig{MaskSensitive: false}
	output := sanitizeMonitorAlertData(cfg, map[string]interface{}{
		"error":    "[sk-Bmr***Zsn] token quota exhausted",
		"token_sk": "Bmr1eHLOBM5UfIP9ytdwygdY0lDqOEZxNHI79oo1spR12Zsn",
	})

	require.Equal(t, "Bmr1eHLOBM5UfIP9ytdwygdY0lDqOEZxNHI79oo1spR12Zsn", output["token_sk"])
	require.Contains(t, output["error"], "Bmr1eHLOBM5UfIP9ytdwygdY0lDqOEZxNHI79oo1spR12Zsn")
}

func TestSanitizeMonitorAlertDataMaskEnabledMasksSensitiveFields(t *testing.T) {
	cfg := monitorAlertConfig{MaskSensitive: true}
	output := sanitizeMonitorAlertData(cfg, map[string]interface{}{
		"error":        "request to https://open.feishu.cn/open-apis/bot/v2/hook/abc failed for sk-Bmr1eHLOBM5UfIP9ytdwygdY0lDqOEZxNHI79oo1spR12Zsn",
		"callback_url": "https://open.feishu.cn/open-apis/bot/v2/hook/abc",
		"token_sk":     "Bmr1eHLOBM5UfIP9ytdwygdY0lDqOEZxNHI79oo1spR12Zsn",
	})

	require.Equal(t, "Bmr1***2Zsn", output["token_sk"])
	require.NotContains(t, output["error"], "open.feishu.cn")
	require.NotContains(t, output["callback_url"], "open.feishu.cn")
}

func TestMonitorAlertTokenSKNoPrefixKeptAsIs(t *testing.T) {
	cfg := monitorAlertConfig{MaskSensitive: false}
	output := sanitizeMonitorAlertData(cfg, map[string]interface{}{
		"token_sk": "ima_61f24b472a5640a8b5860944b6178abf",
	})
	require.Equal(t, "ima_61f24b472a5640a8b5860944b6178abf", output["token_sk"])
}
