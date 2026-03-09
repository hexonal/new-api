package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func truncateDailyUserUsageReportTables(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		DB.Exec("DELETE FROM quota_data")
	})
}

func TestParseDailyUserUsagePrefixes(t *testing.T) {
	prefixes := ParseDailyUserUsagePrefixes(" ima_,\nteam-\r\n\nima_ ")
	assert.Equal(t, []string{"ima_", "team-"}, prefixes)
}

func TestGetYesterdayWindow(t *testing.T) {
	now := time.Date(2026, 3, 9, 15, 30, 0, 0, time.FixedZone("CST", 8*3600))
	start, end := GetYesterdayWindow(now)

	assert.Equal(t, time.Date(2026, 3, 8, 0, 0, 0, 0, now.Location()), start)
	assert.Equal(t, time.Date(2026, 3, 9, 0, 0, 0, 0, now.Location()), end)
}

func TestGetDailyUserUsageReportForYesterday(t *testing.T) {
	truncateTables(t)
	truncateDailyUserUsageReportTables(t)
	require.NoError(t, DB.AutoMigrate(&QuotaData{}))

	location := time.FixedZone("CST", 8*3600)
	yesterdayStart := time.Date(2026, 3, 8, 0, 0, 0, 0, location).Unix()
	todayStart := time.Date(2026, 3, 9, 0, 0, 0, 0, location).Unix()

	seedQuotaData := []*QuotaData{
		{UserID: 1, Username: "ima_alpha", ModelName: "gpt-4o", CreatedAt: yesterdayStart, TokenUsed: 120, Count: 2, Quota: 600000},
		{UserID: 1, Username: "ima_alpha", ModelName: "gpt-4o-mini", CreatedAt: yesterdayStart + 3600, TokenUsed: 80, Count: 1, Quota: 400000},
		{UserID: 2, Username: "ima_beta", ModelName: "gpt-4o", CreatedAt: yesterdayStart + 7200, TokenUsed: 90, Count: 3, Quota: 300000},
		{UserID: 3, Username: "team_gamma", ModelName: "gpt-4o", CreatedAt: yesterdayStart + 10800, TokenUsed: 60, Count: 1, Quota: 200000},
		{UserID: 4, Username: "ima_skip", ModelName: "gpt-4o", CreatedAt: todayStart, TokenUsed: 999, Count: 9, Quota: 999000},
	}
	for _, item := range seedQuotaData {
		require.NoError(t, DB.Create(item).Error)
	}

	report, err := GetDailyUserUsageReportForYesterday(time.Date(2026, 3, 9, 10, 0, 0, 0, location), "ima_,\nteam_", 20)
	require.NoError(t, err)

	assert.Equal(t, "2026-03-08", report.Date)
	assert.EqualValues(t, yesterdayStart, report.StartTimestamp)
	assert.EqualValues(t, todayStart-1, report.EndTimestamp)
	assert.Equal(t, []string{"ima_", "team_"}, report.Prefixes)
	assert.EqualValues(t, 3, report.TotalUsers)
	assert.EqualValues(t, 7, report.TotalMessages)
	assert.EqualValues(t, 350, report.TotalTokens)
	assert.EqualValues(t, 1500000, report.TotalQuota)
	assert.InDelta(t, 3.0, report.TotalAmountUSD, 0.000001)
	require.Len(t, report.Ranking, 3)

	assert.Equal(t, "ima_alpha", report.Ranking[0].Username)
	assert.EqualValues(t, 3, report.Ranking[0].Messages)
	assert.EqualValues(t, 200, report.Ranking[0].Tokens)
	assert.EqualValues(t, 1000000, report.Ranking[0].Quota)
	assert.InDelta(t, 2.0, report.Ranking[0].AmountUSD, 0.000001)

	assert.Equal(t, "ima_beta", report.Ranking[1].Username)
	assert.Equal(t, "team_gamma", report.Ranking[2].Username)
}

func TestGetDailyUserUsageReportEscapesLikeWildcards(t *testing.T) {
	truncateTables(t)
	truncateDailyUserUsageReportTables(t)
	require.NoError(t, DB.AutoMigrate(&QuotaData{}))

	start := time.Date(2026, 3, 8, 0, 0, 0, 0, time.Local).Unix()
	end := time.Date(2026, 3, 9, 0, 0, 0, 0, time.Local).Unix()

	rows := []*QuotaData{
		{UserID: 1, Username: "ima_100", ModelName: "gpt-4o", CreatedAt: start, TokenUsed: 10, Count: 1, Quota: 5000},
		{UserID: 2, Username: "imax100", ModelName: "gpt-4o", CreatedAt: start, TokenUsed: 20, Count: 1, Quota: 10000},
		{UserID: 3, Username: "ima%200", ModelName: "gpt-4o", CreatedAt: start, TokenUsed: 30, Count: 1, Quota: 15000},
	}
	for _, row := range rows {
		require.NoError(t, DB.Create(row).Error)
	}

	report, err := GetDailyUserUsageReport("ima_", 20, start, end)
	require.NoError(t, err)
	require.Len(t, report.Ranking, 1)
	assert.Equal(t, "ima_100", report.Ranking[0].Username)

	report, err = GetDailyUserUsageReport("ima%", 20, start, end)
	require.NoError(t, err)
	require.Len(t, report.Ranking, 1)
	assert.Equal(t, "ima%200", report.Ranking[0].Username)
}
