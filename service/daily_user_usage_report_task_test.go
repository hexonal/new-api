package service

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDurationUntilNextDailyUserUsageReport(t *testing.T) {
	now := time.Date(2026, 3, 9, 0, 5, 0, 0, time.Local)
	got := durationUntilNextDailyUserUsageReport(now, 0, 10)
	assert.Equal(t, 5*time.Minute, got)

	now = time.Date(2026, 3, 9, 0, 10, 0, 0, time.Local)
	got = durationUntilNextDailyUserUsageReport(now, 0, 10)
	assert.Equal(t, 24*time.Hour, got)
}

func TestBuildDailyUserUsageReportFeishuCard(t *testing.T) {
	report := &model.DailyUserUsageReport{
		Date:           "2026-03-08",
		Prefixes:       []string{"ima_"},
		TotalUsers:     2,
		TotalMessages:  12,
		TotalTokens:    3456,
		TotalAmountUSD: 7.89,
		Ranking: []model.DailyUserUsageRankingItem{
			{Username: "ima_a", Messages: 7, Tokens: 2000, AmountUSD: 4.56},
			{Username: "ima_b", Messages: 5, Tokens: 1456, AmountUSD: 3.33},
		},
	}

	card := buildDailyUserUsageReportFeishuCard(report)
	require.Equal(t, "interactive", card["msg_type"])

	body, ok := card["card"].(map[string]any)
	require.True(t, ok)
	assert.NotNil(t, body["header"])
	assert.NotNil(t, body["elements"])

	jsonText := mustMarshalJSON(t, card)
	assert.Contains(t, jsonText, "[new-api] Daily User Usage Report")
	assert.Contains(t, jsonText, "**Date**\\n2026-03-08")
	assert.Contains(t, jsonText, "**Prefixes**\\nima_")
	assert.Contains(t, jsonText, "1. `ima_a`\\nMessages: 7 | Tokens: 2000 | Amount: $4.560000")
	assert.Contains(t, jsonText, "2. `ima_b`\\nMessages: 5 | Tokens: 1456 | Amount: $3.330000")
}

func mustMarshalJSON(t *testing.T, value any) string {
	t.Helper()
	bytes, err := json.Marshal(value)
	require.NoError(t, err)
	return string(bytes)
}
