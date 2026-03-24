package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestSelectChannelByPrioritySkipsBreakerOpenChannels(t *testing.T) {
	restore := common.SetChannelBreakerBackendForTest(common.NewInMemoryChannelBreakerBackend())
	defer restore()

	settings := dto.ChannelOtherSettings{
		BreakerEnabled:         true,
		BreakerThresholdCount:  1,
		BreakerWindowSeconds:   60,
		BreakerCooldownSeconds: 300,
		BreakerErrorTypes:      []string{"429"},
	}
	cfg := settings.GetBreakerConfig()

	high := &Channel{Id: 1, Name: "high", Priority: common.GetPointer[int64](100), Weight: common.GetPointer[uint](100)}
	high.SetOtherSettings(settings)
	low := &Channel{Id: 2, Name: "low", Priority: common.GetPointer[int64](90), Weight: common.GetPointer[uint](100)}
	low.SetOtherSettings(settings)

	opened, err := common.RecordChannelBreakerFailureAt(high.Id, cfg, "429", time.Now())
	require.NoError(t, err)
	require.True(t, opened)

	selected, err := selectChannelByPriorityWithBreaker([]*Channel{high, low}, 0)
	require.NoError(t, err)
	require.NotNil(t, selected)
	require.Equal(t, low.Id, selected.Id)
}
