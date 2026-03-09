package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
)

func TestDurationUntilNextDailyUserUsageReport(t *testing.T) {
	now := time.Date(2026, 3, 9, 0, 5, 0, 0, time.Local)
	got := durationUntilNextDailyUserUsageReport(now, 0, 10)
	assert.Equal(t, 5*time.Minute, got)

	now = time.Date(2026, 3, 9, 0, 10, 0, 0, time.Local)
	got = durationUntilNextDailyUserUsageReport(now, 0, 10)
	assert.Equal(t, 24*time.Hour, got)
}

func TestFormatDailyUserUsageReportFeishuText(t *testing.T) {
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

	text := formatDailyUserUsageReportFeishuText(report)
	assert.Contains(t, text, "Date: 2026-03-08")
	assert.Contains(t, text, "Prefixes: ima_")
	assert.Contains(t, text, "1. ima_a | messages=7 | tokens=2000 | amount=$4.560000")
	assert.Contains(t, text, "2. ima_b | messages=5 | tokens=1456 | amount=$3.330000")
}
