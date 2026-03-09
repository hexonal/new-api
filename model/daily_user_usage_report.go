package model

import (
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type DailyUserUsageRankingItem struct {
	Username  string  `json:"username"`
	Messages  int64   `json:"messages"`
	Tokens    int64   `json:"tokens"`
	Quota     int64   `json:"quota"`
	AmountUSD float64 `json:"amount_usd"`
}

type DailyUserUsageReport struct {
	Date           string                      `json:"date"`
	StartTimestamp int64                       `json:"start_timestamp"`
	EndTimestamp   int64                       `json:"end_timestamp"`
	Prefixes       []string                    `json:"prefixes"`
	TotalUsers     int64                       `json:"total_users"`
	TotalMessages  int64                       `json:"total_messages"`
	TotalTokens    int64                       `json:"total_tokens"`
	TotalQuota     int64                       `json:"total_quota"`
	TotalAmountUSD float64                     `json:"total_amount_usd"`
	Ranking        []DailyUserUsageRankingItem `json:"ranking"`
}

type dailyUserUsageAggregateRow struct {
	Username string
	Messages int64
	Tokens   int64
	Quota    int64
}

func GetDailyUserUsageReportForYesterday(now time.Time, rawPrefixFilter string, limit int) (*DailyUserUsageReport, error) {
	location := now.Location()
	if location == nil {
		location = time.Local
	}
	start, end := GetYesterdayWindow(now.In(location))
	return GetDailyUserUsageReport(rawPrefixFilter, limit, start.Unix(), end.Unix())
}

func GetDailyUserUsageReport(rawPrefixFilter string, limit int, startTimestamp int64, endTimestamp int64) (*DailyUserUsageReport, error) {
	if limit <= 0 {
		limit = 20
	}
	prefixes := ParseDailyUserUsagePrefixes(rawPrefixFilter)

	tx := DB.Table("quota_data").
		Where("created_at >= ? AND created_at < ?", startTimestamp, endTimestamp)
	tx = applyDailyUserUsagePrefixFilter(tx, prefixes)

	var totals struct {
		TotalUsers    int64
		TotalMessages int64
		TotalTokens   int64
		TotalQuota    int64
	}
	if err := tx.Select(
		"COUNT(DISTINCT username) AS total_users, COALESCE(SUM(count), 0) AS total_messages, COALESCE(SUM(token_used), 0) AS total_tokens, COALESCE(SUM(quota), 0) AS total_quota",
	).Scan(&totals).Error; err != nil {
		return nil, err
	}

	rows := make([]dailyUserUsageAggregateRow, 0)
	if err := tx.Select(
		"username, COALESCE(SUM(count), 0) AS messages, COALESCE(SUM(token_used), 0) AS tokens, COALESCE(SUM(quota), 0) AS quota",
	).Group("username").
		Order("quota DESC, tokens DESC, messages DESC, username ASC").
		Limit(limit).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	ranking := make([]DailyUserUsageRankingItem, 0, len(rows))
	for _, row := range rows {
		ranking = append(ranking, DailyUserUsageRankingItem{
			Username:  row.Username,
			Messages:  row.Messages,
			Tokens:    row.Tokens,
			Quota:     row.Quota,
			AmountUSD: dailyUserUsageQuotaToUSD(row.Quota),
		})
	}

	return &DailyUserUsageReport{
		Date:           time.Unix(startTimestamp, 0).In(time.Local).Format("2006-01-02"),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp - 1,
		Prefixes:       prefixes,
		TotalUsers:     totals.TotalUsers,
		TotalMessages:  totals.TotalMessages,
		TotalTokens:    totals.TotalTokens,
		TotalQuota:     totals.TotalQuota,
		TotalAmountUSD: dailyUserUsageQuotaToUSD(totals.TotalQuota),
		Ranking:        ranking,
	}, nil
}

func GetYesterdayWindow(now time.Time) (time.Time, time.Time) {
	end := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	start := end.Add(-24 * time.Hour)
	return start, end
}

func ParseDailyUserUsagePrefixes(raw string) []string {
	normalized := strings.ReplaceAll(raw, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")
	normalized = strings.ReplaceAll(normalized, ",", "\n")
	parts := strings.Split(normalized, "\n")
	prefixes := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		prefix := strings.TrimSpace(part)
		if prefix == "" {
			continue
		}
		if _, exists := seen[prefix]; exists {
			continue
		}
		seen[prefix] = struct{}{}
		prefixes = append(prefixes, prefix)
	}
	return prefixes
}

func applyDailyUserUsagePrefixFilter(tx *gorm.DB, prefixes []string) *gorm.DB {
	if len(prefixes) == 0 {
		return tx
	}
	query := tx
	for index, prefix := range prefixes {
		pattern := escapeDailyUserUsageLikePrefix(prefix)
		if index == 0 {
			query = query.Where("username LIKE ? ESCAPE '!'", pattern)
			continue
		}
		query = query.Or("username LIKE ? ESCAPE '!'", pattern)
	}
	return query
}

func escapeDailyUserUsageLikePrefix(prefix string) string {
	replacer := strings.NewReplacer("!", "!!", "%", "!%", "_", "!_")
	return replacer.Replace(strings.TrimSpace(prefix)) + "%"
}

func dailyUserUsageQuotaToUSD(quota int64) float64 {
	if quota == 0 || common.QuotaPerUnit <= 0 {
		return 0
	}
	return float64(quota) / common.QuotaPerUnit
}
