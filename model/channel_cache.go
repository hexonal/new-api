package model

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

var group2model2channels map[string]map[string][]int // enabled channel
var channelsIDM map[int]*Channel                     // all channels include disabled
var channelSyncLock sync.RWMutex
var localCacheVersion atomic.Int64 // local version, updated after each InitChannelCache

// negativeCacheMiss stores group|model keys confirmed absent from DB,
// with an expiry timestamp. Prevents repeated DB queries for non-existent models.
var negativeCacheMiss sync.Map // key: "group|model" → value: int64 (unix timestamp of expiry)

const (
	channelCacheVersionKey = "new-api:channel-cache-version"
	negativeCacheTTLSec    = 10 // negative cache entries expire after 10 seconds
)

// refreshingCache prevents concurrent InitChannelCache storms.
// Multiple goroutines hitting cache miss simultaneously should not all
// trigger a full DB reload — only one proceeds, others skip.
var refreshingCache atomic.Bool

// IncrChannelCacheVersion atomically increments the Redis-based channel cache
// version counter. Returns the new version, or 0 if Redis is unavailable.
func IncrChannelCacheVersion() int64 {
	if !common.RedisEnabled || common.RDB == nil {
		return 0
	}
	ver, err := common.RDB.Incr(context.Background(), channelCacheVersionKey).Result()
	if err != nil {
		common.SysError("incr channel cache version failed: " + err.Error())
		return 0
	}
	return ver
}

// GetChannelCacheVersion returns the current Redis-based channel cache version,
// or 0 if Redis is unavailable or the key does not exist.
func GetChannelCacheVersion() int64 {
	if !common.RedisEnabled || common.RDB == nil {
		return 0
	}
	ver, err := common.RDB.Get(context.Background(), channelCacheVersionKey).Int64()
	if err != nil {
		return 0
	}
	return ver
}

// tryRefreshChannelCache attempts to refresh the channel cache, but skips
// if another goroutine is already refreshing. Returns true if refresh was performed.
func tryRefreshChannelCache() bool {
	if !refreshingCache.CompareAndSwap(false, true) {
		return false // another goroutine is already refreshing
	}
	defer refreshingCache.Store(false)
	InitChannelCache()
	return true
}

// isNegativelyCached returns true if group|model was recently confirmed absent.
func isNegativelyCached(group, model string) bool {
	key := group + "|" + model
	if v, ok := negativeCacheMiss.Load(key); ok {
		if expiry, _ := v.(int64); time.Now().Unix() < expiry {
			return true
		}
		negativeCacheMiss.Delete(key) // expired
	}
	return false
}

// setNegativeCache marks a group|model as confirmed absent for a short TTL.
func setNegativeCache(group, model string) {
	key := group + "|" + model
	negativeCacheMiss.Store(key, time.Now().Unix()+negativeCacheTTLSec)
}

// invalidateNegativeCache clears all negative cache entries.
// Called after InitChannelCache since the routing table has changed.
func invalidateNegativeCache() {
	negativeCacheMiss.Range(func(key, _ any) bool {
		negativeCacheMiss.Delete(key)
		return true
	})
}

func InitChannelCache() {
	if !common.MemoryCacheEnabled {
		return
	}
	newChannelId2channel := make(map[int]*Channel)
	var channels []*Channel
	DB.Find(&channels)
	for _, channel := range channels {
		newChannelId2channel[channel.Id] = channel
	}
	var abilities []*Ability
	DB.Find(&abilities)
	groups := make(map[string]bool)
	for _, ability := range abilities {
		groups[ability.Group] = true
	}
	// Build ability lookup set: only (group, model, channel_id) entries that are enabled
	abilitySet := make(map[string]bool)
	for _, ability := range abilities {
		if ability.Enabled {
			key := fmt.Sprintf("%s|%s|%d", ability.Group, ability.Model, ability.ChannelId)
			abilitySet[key] = true
		}
	}
	newGroup2model2channels := make(map[string]map[string][]int)
	for group := range groups {
		newGroup2model2channels[group] = make(map[string][]int)
	}
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue // skip disabled channels
		}
		groups := strings.Split(channel.Group, ",")
		for _, group := range groups {
			group = strings.TrimSpace(group)
			if group == "" {
				continue
			}
			models := strings.Split(channel.Models, ",")
			for _, model := range models {
				model = strings.TrimSpace(model)
				if model == "" {
					continue
				}
				// Only add to cache if ability exists and is enabled
				abilityKey := fmt.Sprintf("%s|%s|%d", group, model, channel.Id)
				if !abilitySet[abilityKey] {
					continue
				}
				if _, ok := newGroup2model2channels[group][model]; !ok {
					newGroup2model2channels[group][model] = make([]int, 0)
				}
				newGroup2model2channels[group][model] = append(newGroup2model2channels[group][model], channel.Id)
			}
		}
	}

	// sort by priority
	for group, model2channels := range newGroup2model2channels {
		for model, channels := range model2channels {
			sort.Slice(channels, func(i, j int) bool {
				return newChannelId2channel[channels[i]].GetPriority() > newChannelId2channel[channels[j]].GetPriority()
			})
			newGroup2model2channels[group][model] = channels
		}
	}

	channelSyncLock.Lock()
	group2model2channels = newGroup2model2channels
	//channelsIDM = newChannelId2channel
	for i, channel := range newChannelId2channel {
		if channel.ChannelInfo.IsMultiKey {
			channel.Keys = channel.GetKeys()
			if channel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling {
				if oldChannel, ok := channelsIDM[i]; ok {
					// 存在旧的渠道，如果是多key且轮询，保留轮询索引信息
					if oldChannel.ChannelInfo.IsMultiKey && oldChannel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling {
						channel.ChannelInfo.MultiKeyPollingIndex = oldChannel.ChannelInfo.MultiKeyPollingIndex
					}
				}
			}
		}
	}
	channelsIDM = newChannelId2channel
	channelSyncLock.Unlock()
	localCacheVersion.Store(GetChannelCacheVersion())
	invalidateNegativeCache()
	common.SysLog("channels synced from database")
}

func SyncChannelCache(frequency int) {
	for {
		time.Sleep(time.Duration(frequency) * time.Second)
		common.SysLog("syncing channels from database")
		InitChannelCache()
	}
}

func GetRandomSatisfiedChannel(group string, model string, retry int) (*Channel, error) {
	// if memory cache is disabled, get channel directly from database
	if !common.MemoryCacheEnabled {
		return GetChannel(group, model, retry)
	}

	// Try cache lookup, with one optional refresh retry on miss
	for attempt := 0; attempt < 2; attempt++ {
		channelSyncLock.RLock()
		channels := group2model2channels[group][model]
		if len(channels) == 0 {
			normalizedModel := ratio_setting.FormatMatchingModelName(model)
			channels = group2model2channels[group][normalizedModel]
		}

		if len(channels) > 0 {
			// Cache hit — select channel and return
			targetChannels := make([]*Channel, 0, len(channels))
			for _, channelId := range channels {
				if channel, ok := channelsIDM[channelId]; ok {
					targetChannels = append(targetChannels, channel)
				} else {
					channelSyncLock.RUnlock()
					return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channelId)
				}
			}
			channelSyncLock.RUnlock()
			return selectChannelByPriorityWithBreaker(targetChannels, retry)
		}
		channelSyncLock.RUnlock()

		// Cache miss — on first attempt, check if cache is stale and refresh
		if attempt == 0 && common.RedisEnabled && common.RDB != nil {
			remoteVer := GetChannelCacheVersion()
			if remoteVer > localCacheVersion.Load() {
				common.SysLog(fmt.Sprintf("channel cache version stale (local=%d, remote=%d), refreshing on miss",
					localCacheVersion.Load(), remoteVer))
				tryRefreshChannelCache()
				continue // retry lookup from refreshed cache
			}
		}
		break // version is current or no Redis, no point retrying
	}

	// Cache confirmed miss — check negative cache to avoid DB pressure
	if isNegativelyCached(group, model) {
		return nil, nil
	}

	// DB fallback: last resort
	dbChannel, err := GetChannel(group, model, retry)
	if err != nil {
		return nil, err
	}
	if dbChannel == nil {
		// Confirmed absent in both cache and DB — set negative cache
		setNegativeCache(group, model)
		return nil, nil
	}

	// DB found something cache didn't — async refresh
	go func() {
		IncrChannelCacheVersion()
		tryRefreshChannelCache()
	}()
	return dbChannel, nil
}

func CacheGetChannel(id int) (*Channel, error) {
	if !common.MemoryCacheEnabled {
		return GetChannelById(id, true)
	}
	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	c, ok := channelsIDM[id]
	if !ok {
		return nil, fmt.Errorf("渠道# %d，已不存在", id)
	}
	return c, nil
}

func CacheGetChannelInfo(id int) (*ChannelInfo, error) {
	if !common.MemoryCacheEnabled {
		channel, err := GetChannelById(id, true)
		if err != nil {
			return nil, err
		}
		return &channel.ChannelInfo, nil
	}
	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	c, ok := channelsIDM[id]
	if !ok {
		return nil, fmt.Errorf("渠道# %d，已不存在", id)
	}
	return &c.ChannelInfo, nil
}

func CacheUpdateChannelStatus(id int, status int) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()
	if channel, ok := channelsIDM[id]; ok {
		channel.Status = status
	}
	if status != common.ChannelStatusEnabled {
		// delete the channel from group2model2channels
		for group, model2channels := range group2model2channels {
			for model, channels := range model2channels {
				for i, channelId := range channels {
					if channelId == id {
						// remove the channel from the slice
						group2model2channels[group][model] = append(channels[:i], channels[i+1:]...)
						break
					}
				}
			}
		}
	}
}

func CacheUpdateChannel(channel *Channel) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()
	if channel == nil {
		return
	}

	println("CacheUpdateChannel:", channel.Id, channel.Name, channel.Status, channel.ChannelInfo.MultiKeyPollingIndex)

	println("before:", channelsIDM[channel.Id].ChannelInfo.MultiKeyPollingIndex)
	channelsIDM[channel.Id] = channel
	println("after :", channelsIDM[channel.Id].ChannelInfo.MultiKeyPollingIndex)
}

// onBroadcastFailure is called when channel cache broadcast fails.
// Set via RegisterChannelCacheBroadcastFailureHook to avoid model→service circular import.
var onBroadcastFailure func(err error)

// RegisterChannelCacheBroadcastFailureHook registers a callback invoked
// when Redis broadcast of channel cache refresh fails.
func RegisterChannelCacheBroadcastFailureHook(fn func(err error)) {
	onBroadcastFailure = fn
}

// InitChannelCacheAndBroadcast refreshes the local channel cache and
// broadcasts a refresh signal to all other nodes via Redis Pub/Sub.
// Use this instead of bare InitChannelCache() in controller/handler code
// to ensure multi-node consistency.
func InitChannelCacheAndBroadcast() {
	IncrChannelCacheVersion()
	InitChannelCache()
	if err := BroadcastChannelCacheRefreshSignal(); err != nil {
		common.SysError(fmt.Sprintf("broadcast channel cache refresh failed: %v", err))
		if onBroadcastFailure != nil {
			onBroadcastFailure(err)
		}
	}
}
