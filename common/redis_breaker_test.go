package common_test

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestChannelBreakerOpensAndRecoversAfterHalfOpenSuccess(t *testing.T) {
	restore := common.SetChannelBreakerBackendForTest(common.NewInMemoryChannelBreakerBackend())
	defer restore()

	cfg := common.ChannelBreakerConfig{
		Enabled:              true,
		ThresholdCount:       2,
		WindowSeconds:        60,
		CooldownSeconds:      30,
		HalfOpenProbeCount:   1,
		RecoverySuccessCount: 1,
		ErrorTypes:           []string{"429"},
	}

	now := time.Unix(1700000000, 0)
	allowed, state, err := common.TryAcquireChannelBreakerAt(1001, cfg, now)
	require.NoError(t, err)
	require.True(t, allowed)
	require.Equal(t, common.ChannelBreakerStateClosed, state)

	opened, err := common.RecordChannelBreakerFailureAt(1001, cfg, "429", now.Add(time.Second))
	require.NoError(t, err)
	require.False(t, opened)

	opened, err = common.RecordChannelBreakerFailureAt(1001, cfg, "429", now.Add(2*time.Second))
	require.NoError(t, err)
	require.True(t, opened)

	allowed, state, err = common.TryAcquireChannelBreakerAt(1001, cfg, now.Add(3*time.Second))
	require.NoError(t, err)
	require.False(t, allowed)
	require.Equal(t, common.ChannelBreakerStateOpen, state)

	allowed, state, err = common.TryAcquireChannelBreakerAt(1001, cfg, now.Add(33*time.Second))
	require.NoError(t, err)
	require.True(t, allowed)
	require.Equal(t, common.ChannelBreakerStateHalfOpen, state)

	err = common.MarkChannelBreakerSuccessAt(1001, cfg, now.Add(34*time.Second))
	require.NoError(t, err)

	allowed, state, err = common.TryAcquireChannelBreakerAt(1001, cfg, now.Add(35*time.Second))
	require.NoError(t, err)
	require.True(t, allowed)
	require.Equal(t, common.ChannelBreakerStateClosed, state)
}

func TestChannelBreakerIgnoresUnconfiguredFailureTypes(t *testing.T) {
	restore := common.SetChannelBreakerBackendForTest(common.NewInMemoryChannelBreakerBackend())
	defer restore()

	cfg := common.ChannelBreakerConfig{
		Enabled:         true,
		ThresholdCount:  1,
		WindowSeconds:   60,
		CooldownSeconds: 30,
		ErrorTypes:      []string{"429"},
	}

	now := time.Unix(1700000100, 0)
	opened, err := common.RecordChannelBreakerFailureAt(1002, cfg, "5xx", now)
	require.NoError(t, err)
	require.False(t, opened)

	allowed, state, err := common.TryAcquireChannelBreakerAt(1002, cfg, now.Add(time.Second))
	require.NoError(t, err)
	require.True(t, allowed)
	require.Equal(t, common.ChannelBreakerStateClosed, state)
}
