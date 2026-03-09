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
	})
	require.Contains(t, output, "API call error")
	require.Contains(t, output, "Request ID: req-123")
	require.Contains(t, output, "status code: 401")
	require.Contains(t, output, "model name: gpt-4.1-mini")
}
