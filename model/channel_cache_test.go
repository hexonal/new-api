package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestGetNextSatisfiedChannelSkipsAttemptedChannels(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldGroup2Model := group2model2channels
	oldChannelsIDM := channelsIDM
	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		group2model2channels = oldGroup2Model
		channelsIDM = oldChannelsIDM
	})

	common.MemoryCacheEnabled = true

	priorityHigh := int64(10)
	priorityLow := int64(5)
	weightHigh := uint(100)
	weightZero := uint(0)

	group2model2channels = map[string]map[string][]int{
		"default": {
			"gpt-4o": {1, 2, 3},
		},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Priority: &priorityHigh, Weight: &weightHigh},
		2: {Id: 2, Priority: &priorityHigh, Weight: &weightZero},
		3: {Id: 3, Priority: &priorityLow, Weight: &weightZero},
	}

	channel, err := GetNextSatisfiedChannel("default", "gpt-4o", nil)
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 1, channel.Id)

	channel, err = GetNextSatisfiedChannel("default", "gpt-4o", map[int]struct{}{1: {}})
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 2, channel.Id)

	channel, err = GetNextSatisfiedChannel("default", "gpt-4o", map[int]struct{}{
		1: {},
		2: {},
	})
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 3, channel.Id)

	channel, err = GetNextSatisfiedChannel("default", "gpt-4o", map[int]struct{}{
		1: {},
		2: {},
		3: {},
	})
	require.NoError(t, err)
	require.Nil(t, channel)
}
