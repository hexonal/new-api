package model

import (
	"fmt"
	"math/rand"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type priorityBucket struct {
	priority int64
	channels []*Channel
}

func selectChannelByPriorityWithBreaker(channels []*Channel, retry int) (*Channel, error) {
	if len(channels) == 0 {
		return nil, nil
	}
	now := time.Now()
	buckets, err := buildSelectablePriorityBuckets(channels, now)
	if err != nil {
		return nil, err
	}
	if len(buckets) == 0 {
		return nil, nil
	}
	if retry < 0 {
		retry = 0
	}
	if retry >= len(buckets) {
		retry = len(buckets) - 1
	}
	selected, pickErr := pickChannelFromBucket(buckets[retry], now)
	if pickErr != nil {
		return nil, pickErr
	}
	return selected, nil
}

func buildSelectablePriorityBuckets(channels []*Channel, now time.Time) ([]priorityBucket, error) {
	bucketMap := make(map[int64][]*Channel)
	priorities := make(map[int64]struct{})
	for _, channel := range channels {
		allowed, err := channelBreakerAllowedForSelection(channel, now)
		if err != nil {
			return nil, err
		}
		if !allowed {
			continue
		}
		priority := channel.GetPriority()
		bucketMap[priority] = append(bucketMap[priority], channel)
		priorities[priority] = struct{}{}
	}
	sortedPriorities := make([]int64, 0, len(priorities))
	for priority := range priorities {
		sortedPriorities = append(sortedPriorities, priority)
	}
	sort.Slice(sortedPriorities, func(i, j int) bool {
		return sortedPriorities[i] > sortedPriorities[j]
	})
	buckets := make([]priorityBucket, 0, len(sortedPriorities))
	for _, priority := range sortedPriorities {
		buckets = append(buckets, priorityBucket{priority: priority, channels: bucketMap[priority]})
	}
	return buckets, nil
}

func channelBreakerAllowedForSelection(channel *Channel, now time.Time) (bool, error) {
	if channel == nil {
		return false, nil
	}
	cfg := channel.GetOtherSettings().GetBreakerConfig()
	if !cfg.Enabled {
		return true, nil
	}
	_, allowed, err := common.InspectChannelBreakerAt(channel.Id, cfg, now)
	return allowed, err
}

func pickChannelFromBucket(bucket priorityBucket, now time.Time) (*Channel, error) {
	candidates := append([]*Channel(nil), bucket.channels...)
	for len(candidates) > 0 {
		idx := weightedChannelIndex(candidates)
		channel := candidates[idx]
		cfg := channel.GetOtherSettings().GetBreakerConfig()
		allowed, _, err := common.TryAcquireChannelBreakerAt(channel.Id, cfg, now)
		if err != nil {
			return nil, fmt.Errorf("failed to acquire channel breaker for channel #%d: %w", channel.Id, err)
		}
		if allowed {
			return channel, nil
		}
		candidates = append(candidates[:idx], candidates[idx+1:]...)
	}
	return nil, nil
}

func weightedChannelIndex(channels []*Channel) int {
	if len(channels) <= 1 {
		return 0
	}
	sumWeight := 0
	for _, channel := range channels {
		sumWeight += channel.GetWeight()
	}
	smoothingFactor := 1
	smoothingAdjustment := 0
	if sumWeight == 0 {
		sumWeight = len(channels) * 100
		smoothingAdjustment = 100
	} else if sumWeight/len(channels) < 10 {
		smoothingFactor = 100
	}
	randomWeight := rand.Intn(sumWeight * smoothingFactor)
	for idx, channel := range channels {
		randomWeight -= channel.GetWeight()*smoothingFactor + smoothingAdjustment
		if randomWeight < 0 {
			return idx
		}
	}
	return len(channels) - 1
}
