package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func resetLogQueryTestTables(t *testing.T) {
	t.Helper()
	require.NoError(t, LOG_DB.Exec("DELETE FROM logs").Error)
	t.Cleanup(func() {
		_ = LOG_DB.Exec("DELETE FROM logs").Error
	})
}

func seedLogForTokenQuery(t *testing.T, log *Log) {
	t.Helper()
	require.NoError(t, LOG_DB.Create(log).Error)
}

func TestGetLogByTokenIdFiltersByRequestId(t *testing.T) {
	resetLogQueryTestTables(t)

	seedLogForTokenQuery(t, &Log{
		TokenId:   11,
		RequestId: "task_target",
		CreatedAt: 1001,
		Type:      LogTypeConsume,
		Quota:     100,
		Other:     `{"actual_quota":150}`,
	})
	seedLogForTokenQuery(t, &Log{
		TokenId:   11,
		RequestId: "task_other",
		CreatedAt: 1002,
		Type:      LogTypeConsume,
		Quota:     200,
		Other:     `{}`,
	})
	seedLogForTokenQuery(t, &Log{
		TokenId:   12,
		RequestId: "task_target",
		CreatedAt: 1003,
		Type:      LogTypeConsume,
		Quota:     300,
		Other:     `{}`,
	})

	logs, err := GetLogByTokenId(11, "task_target")
	require.NoError(t, err)
	require.Len(t, logs, 1)
	require.Equal(t, 11, logs[0].TokenId)
	require.Equal(t, "task_target", logs[0].RequestId)
	require.Equal(t, 100, logs[0].Quota)
	require.Equal(t, float64(150)/common.QuotaPerUnit, logs[0].AmountUSD)
}

func TestGetLogByTokenIdAmountUSDFallsBackToQuotaWhenOtherIsInvalid(t *testing.T) {
	resetLogQueryTestTables(t)

	seedLogForTokenQuery(t, &Log{
		TokenId:   11,
		RequestId: "task_target",
		CreatedAt: 1001,
		Type:      LogTypeConsume,
		Quota:     100,
		Other:     `{invalid-json`,
	})

	logs, err := GetLogByTokenId(11, "task_target")
	require.NoError(t, err)
	require.Len(t, logs, 1)
	require.Equal(t, float64(100)/common.QuotaPerUnit, logs[0].AmountUSD)
}

func TestGetLogByTokenIdAmountUSDIgnoresEstimatedQuotaForPendingDeferredSettle(t *testing.T) {
	resetLogQueryTestTables(t)

	seedLogForTokenQuery(t, &Log{
		TokenId:   11,
		RequestId: "task_target",
		CreatedAt: 1001,
		Type:      LogTypeConsume,
		Quota:     0,
		Other:     `{"deferred_settle":true,"terminal_charge_state":"pending","estimated_quota":1400}`,
	})

	logs, err := GetLogByTokenId(11, "task_target")
	require.NoError(t, err)
	require.Len(t, logs, 1)
	require.Equal(t, float64(0), logs[0].AmountUSD)
}

func TestGetLogByTokenIdAmountUSDUsesActualQuotaOverEstimatedQuota(t *testing.T) {
	resetLogQueryTestTables(t)

	seedLogForTokenQuery(t, &Log{
		TokenId:   11,
		RequestId: "task_target",
		CreatedAt: 1001,
		Type:      LogTypeConsume,
		Quota:     0,
		Other:     `{"deferred_settle":true,"terminal_charge_state":"applied","estimated_quota":1400,"actual_quota":2400}`,
	})

	logs, err := GetLogByTokenId(11, "task_target")
	require.NoError(t, err)
	require.Len(t, logs, 1)
	require.Equal(t, float64(2400)/common.QuotaPerUnit, logs[0].AmountUSD)
}

func TestGetLogByTokenIdWithoutRequestIdKeepsTokenOnlyBehavior(t *testing.T) {
	resetLogQueryTestTables(t)

	seedLogForTokenQuery(t, &Log{
		TokenId:   11,
		RequestId: "task_old",
		CreatedAt: 1001,
		Type:      LogTypeConsume,
		Quota:     100,
		Other:     `{}`,
	})
	seedLogForTokenQuery(t, &Log{
		TokenId:   11,
		RequestId: "task_new",
		CreatedAt: 1002,
		Type:      LogTypeConsume,
		Quota:     200,
		Other:     `{}`,
	})
	seedLogForTokenQuery(t, &Log{
		TokenId:   12,
		RequestId: "task_other_token",
		CreatedAt: 1003,
		Type:      LogTypeConsume,
		Quota:     300,
		Other:     `{}`,
	})

	logs, err := GetLogByTokenId(11)
	require.NoError(t, err)
	require.Len(t, logs, 2)
	require.Equal(t, 11, logs[0].TokenId)
	require.Equal(t, 11, logs[1].TokenId)
	require.Equal(t, "task_new", logs[0].RequestId)
	require.Equal(t, "task_old", logs[1].RequestId)
}
