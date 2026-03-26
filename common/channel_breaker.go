package common

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

type ChannelBreakerState string

const (
	ChannelBreakerStateClosed   ChannelBreakerState = "CLOSED"
	ChannelBreakerStateOpen     ChannelBreakerState = "OPEN"
	ChannelBreakerStateHalfOpen ChannelBreakerState = "HALF_OPEN"
)

type ChannelBreakerConfig struct {
	Enabled              bool
	ThresholdCount       int
	WindowSeconds        int
	CooldownSeconds      int
	HalfOpenProbeCount   int
	RecoverySuccessCount int
	ErrorTypes           []string
}

func (c ChannelBreakerConfig) HasErrorType(kind string) bool {
	kind = strings.TrimSpace(kind)
	if kind == "" {
		return false
	}
	for _, item := range c.ErrorTypes {
		if item == kind {
			return true
		}
	}
	return false
}

type ChannelBreakerBackend interface {
	Inspect(channelID int, cfg ChannelBreakerConfig, now time.Time) (ChannelBreakerState, bool, error)
	TryAcquire(channelID int, cfg ChannelBreakerConfig, now time.Time) (bool, ChannelBreakerState, error)
	RecordFailure(channelID int, cfg ChannelBreakerConfig, errType string, now time.Time) (bool, error)
	MarkSuccess(channelID int, cfg ChannelBreakerConfig, now time.Time) error
}

var (
	channelBreakerBackendMu sync.RWMutex
	channelBreakerBackend   ChannelBreakerBackend
	defaultBreakerBackend   = NewInMemoryChannelBreakerBackend()
)

func activeChannelBreakerBackend() ChannelBreakerBackend {
	channelBreakerBackendMu.RLock()
	backend := channelBreakerBackend
	channelBreakerBackendMu.RUnlock()
	if backend != nil {
		return backend
	}
	if RedisEnabled && RDB != nil {
		return redisChannelBreakerBackend{}
	}
	return defaultBreakerBackend
}

func SetChannelBreakerBackendForTest(backend ChannelBreakerBackend) func() {
	channelBreakerBackendMu.Lock()
	previous := channelBreakerBackend
	channelBreakerBackend = backend
	channelBreakerBackendMu.Unlock()
	return func() {
		channelBreakerBackendMu.Lock()
		channelBreakerBackend = previous
		channelBreakerBackendMu.Unlock()
	}
}

func InspectChannelBreakerAt(channelID int, cfg ChannelBreakerConfig, now time.Time) (ChannelBreakerState, bool, error) {
	if channelID <= 0 || !cfg.Enabled {
		return ChannelBreakerStateClosed, true, nil
	}
	return activeChannelBreakerBackend().Inspect(channelID, sanitizeChannelBreakerConfig(cfg), now)
}

func TryAcquireChannelBreakerAt(channelID int, cfg ChannelBreakerConfig, now time.Time) (bool, ChannelBreakerState, error) {
	if channelID <= 0 || !cfg.Enabled {
		return true, ChannelBreakerStateClosed, nil
	}
	return activeChannelBreakerBackend().TryAcquire(channelID, sanitizeChannelBreakerConfig(cfg), now)
}

func TryAcquireChannelBreaker(channelID int, cfg ChannelBreakerConfig) (bool, ChannelBreakerState, error) {
	return TryAcquireChannelBreakerAt(channelID, cfg, time.Now())
}

func RecordChannelBreakerFailureAt(channelID int, cfg ChannelBreakerConfig, errType string, now time.Time) (bool, error) {
	if channelID <= 0 || !cfg.Enabled {
		return false, nil
	}
	return activeChannelBreakerBackend().RecordFailure(channelID, sanitizeChannelBreakerConfig(cfg), strings.TrimSpace(errType), now)
}

func MarkChannelBreakerSuccessAt(channelID int, cfg ChannelBreakerConfig, now time.Time) error {
	if channelID <= 0 || !cfg.Enabled {
		return nil
	}
	return activeChannelBreakerBackend().MarkSuccess(channelID, sanitizeChannelBreakerConfig(cfg), now)
}

func MarkChannelBreakerSuccess(channelID int, cfg ChannelBreakerConfig) error {
	return MarkChannelBreakerSuccessAt(channelID, cfg, time.Now())
}

func sanitizeChannelBreakerConfig(cfg ChannelBreakerConfig) ChannelBreakerConfig {
	if cfg.ThresholdCount <= 0 {
		cfg.ThresholdCount = 10
	}
	if cfg.WindowSeconds <= 0 {
		cfg.WindowSeconds = 60
	}
	if cfg.CooldownSeconds <= 0 {
		cfg.CooldownSeconds = 300
	}
	if cfg.HalfOpenProbeCount <= 0 {
		cfg.HalfOpenProbeCount = 1
	}
	if cfg.RecoverySuccessCount <= 0 {
		cfg.RecoverySuccessCount = 1
	}
	return cfg
}

type inMemoryChannelBreakerRecord struct {
	State         ChannelBreakerState
	WindowStart   int64
	FailureCounts map[string]int
	OpenUntil     int64
	ProbeInflight int
	SuccessCount  int
}

type InMemoryChannelBreakerBackend struct {
	mu      sync.Mutex
	records map[int]*inMemoryChannelBreakerRecord
}

func NewInMemoryChannelBreakerBackend() *InMemoryChannelBreakerBackend {
	return &InMemoryChannelBreakerBackend{records: make(map[int]*inMemoryChannelBreakerRecord)}
}

func (b *InMemoryChannelBreakerBackend) Inspect(channelID int, cfg ChannelBreakerConfig, now time.Time) (ChannelBreakerState, bool, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	record := b.ensureRecord(channelID)
	state, allowed := inspectRecord(record, cfg, now.Unix())
	return state, allowed, nil
}

func (b *InMemoryChannelBreakerBackend) TryAcquire(channelID int, cfg ChannelBreakerConfig, now time.Time) (bool, ChannelBreakerState, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	record := b.ensureRecord(channelID)
	allowed, state := tryAcquireRecord(record, cfg, now.Unix())
	return allowed, state, nil
}

func (b *InMemoryChannelBreakerBackend) RecordFailure(channelID int, cfg ChannelBreakerConfig, errType string, now time.Time) (bool, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	record := b.ensureRecord(channelID)
	return recordFailure(record, cfg, errType, now.Unix()), nil
}

func (b *InMemoryChannelBreakerBackend) MarkSuccess(channelID int, cfg ChannelBreakerConfig, now time.Time) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	record := b.ensureRecord(channelID)
	markSuccess(record, cfg, now.Unix())
	return nil
}

func (b *InMemoryChannelBreakerBackend) ensureRecord(channelID int) *inMemoryChannelBreakerRecord {
	record, ok := b.records[channelID]
	if !ok {
		record = &inMemoryChannelBreakerRecord{State: ChannelBreakerStateClosed, FailureCounts: make(map[string]int)}
		b.records[channelID] = record
	}
	if record.FailureCounts == nil {
		record.FailureCounts = make(map[string]int)
	}
	return record
}

func inspectRecord(record *inMemoryChannelBreakerRecord, cfg ChannelBreakerConfig, nowUnix int64) (ChannelBreakerState, bool) {
	switch record.State {
	case ChannelBreakerStateOpen:
		if record.OpenUntil > nowUnix {
			return ChannelBreakerStateOpen, false
		}
		return ChannelBreakerStateHalfOpen, true
	case ChannelBreakerStateHalfOpen:
		return ChannelBreakerStateHalfOpen, record.ProbeInflight < cfg.HalfOpenProbeCount
	default:
		return ChannelBreakerStateClosed, true
	}
}

func tryAcquireRecord(record *inMemoryChannelBreakerRecord, cfg ChannelBreakerConfig, nowUnix int64) (bool, ChannelBreakerState) {
	switch record.State {
	case ChannelBreakerStateOpen:
		if record.OpenUntil > nowUnix {
			return false, ChannelBreakerStateOpen
		}
		resetFailureWindow(record)
		record.State = ChannelBreakerStateHalfOpen
		record.OpenUntil = 0
		record.SuccessCount = 0
		record.ProbeInflight = 0
	case ChannelBreakerStateHalfOpen:
		if record.ProbeInflight >= cfg.HalfOpenProbeCount {
			return false, ChannelBreakerStateHalfOpen
		}
		record.ProbeInflight++
		return true, ChannelBreakerStateHalfOpen
	default:
		return true, ChannelBreakerStateClosed
	}
	record.ProbeInflight++
	return true, record.State
}

func recordFailure(record *inMemoryChannelBreakerRecord, cfg ChannelBreakerConfig, errType string, nowUnix int64) bool {
	if record.State == ChannelBreakerStateHalfOpen {
		openRecord(record, cfg, nowUnix)
		return true
	}
	if !cfg.HasErrorType(errType) {
		return false
	}
	if record.WindowStart == 0 || nowUnix-record.WindowStart >= int64(cfg.WindowSeconds) {
		resetFailureWindow(record)
		record.WindowStart = nowUnix
	}
	record.FailureCounts[errType]++
	if record.FailureCounts[errType] >= cfg.ThresholdCount {
		openRecord(record, cfg, nowUnix)
		return true
	}
	return false
}

func markSuccess(record *inMemoryChannelBreakerRecord, cfg ChannelBreakerConfig, _ int64) {
	if record.State != ChannelBreakerStateHalfOpen {
		return
	}
	if record.ProbeInflight > 0 {
		record.ProbeInflight--
	}
	record.SuccessCount++
	if record.SuccessCount >= cfg.RecoverySuccessCount {
		resetFailureWindow(record)
		record.State = ChannelBreakerStateClosed
		record.OpenUntil = 0
		record.ProbeInflight = 0
		record.SuccessCount = 0
	}
}

func openRecord(record *inMemoryChannelBreakerRecord, cfg ChannelBreakerConfig, nowUnix int64) {
	resetFailureWindow(record)
	record.State = ChannelBreakerStateOpen
	record.OpenUntil = nowUnix + int64(cfg.CooldownSeconds)
	record.ProbeInflight = 0
	record.SuccessCount = 0
}

func resetFailureWindow(record *inMemoryChannelBreakerRecord) {
	record.WindowStart = 0
	record.FailureCounts = make(map[string]int)
}

type redisChannelBreakerBackend struct{}

func (redisChannelBreakerBackend) Inspect(channelID int, cfg ChannelBreakerConfig, now time.Time) (ChannelBreakerState, bool, error) {
	ctx := context.Background()
	result, err := RDB.HMGet(ctx, channelBreakerStateKey(channelID), "state", "open_until", "probe_inflight").Result()
	if err != nil {
		return ChannelBreakerStateClosed, true, err
	}
	state := parseChannelBreakerState(redisResultString(result, 0))
	openUntil := parseInt64(redisResultString(result, 1))
	probeInflight := int(parseInt64(redisResultString(result, 2)))
	switch state {
	case ChannelBreakerStateOpen:
		if openUntil > now.Unix() {
			return ChannelBreakerStateOpen, false, nil
		}
		return ChannelBreakerStateHalfOpen, true, nil
	case ChannelBreakerStateHalfOpen:
		return ChannelBreakerStateHalfOpen, probeInflight < cfg.HalfOpenProbeCount, nil
	default:
		return ChannelBreakerStateClosed, true, nil
	}
}

func (redisChannelBreakerBackend) TryAcquire(channelID int, cfg ChannelBreakerConfig, now time.Time) (bool, ChannelBreakerState, error) {
	ctx := context.Background()
	res, err := RDB.Eval(ctx, redisChannelBreakerTryAcquireScript, []string{channelBreakerStateKey(channelID)}, now.Unix(), cfg.HalfOpenProbeCount).Result()
	if err != nil {
		return false, ChannelBreakerStateClosed, err
	}
	allowed, state, err := parseRedisBoolStateResult(res)
	if err != nil {
		return false, ChannelBreakerStateClosed, err
	}
	return allowed, state, nil
}

func (redisChannelBreakerBackend) RecordFailure(channelID int, cfg ChannelBreakerConfig, errType string, now time.Time) (bool, error) {
	ctx := context.Background()
	args := buildBreakerScriptArgs(now.Unix(), cfg, errType)
	res, err := RDB.Eval(ctx, redisChannelBreakerRecordFailureScript, []string{channelBreakerStateKey(channelID)}, args...).Result()
	if err != nil {
		return false, err
	}
	return parseRedisBoolResult(res), nil
}

func (redisChannelBreakerBackend) MarkSuccess(channelID int, cfg ChannelBreakerConfig, now time.Time) error {
	ctx := context.Background()
	args := []interface{}{now.Unix(), cfg.RecoverySuccessCount, len(cfg.ErrorTypes)}
	for _, item := range cfg.ErrorTypes {
		args = append(args, item)
	}
	_, err := RDB.Eval(ctx, redisChannelBreakerMarkSuccessScript, []string{channelBreakerStateKey(channelID)}, args...).Result()
	return err
}

func buildBreakerScriptArgs(nowUnix int64, cfg ChannelBreakerConfig, errType string) []interface{} {
	args := []interface{}{nowUnix, cfg.WindowSeconds, cfg.ThresholdCount, cfg.CooldownSeconds, errType, len(cfg.ErrorTypes)}
	for _, item := range cfg.ErrorTypes {
		args = append(args, item)
	}
	return args
}

func parseRedisBoolStateResult(value interface{}) (bool, ChannelBreakerState, error) {
	values, ok := value.([]interface{})
	if !ok || len(values) < 2 {
		return false, ChannelBreakerStateClosed, fmt.Errorf("unexpected breaker eval result: %T", value)
	}
	return parseRedisBoolResult(values[0]), parseChannelBreakerState(redisInterfaceToString(values[1])), nil
}

func parseRedisBoolResult(value interface{}) bool {
	switch v := value.(type) {
	case int64:
		return v > 0
	case string:
		return v == "1" || strings.EqualFold(v, "true")
	default:
		return false
	}
}

func parseChannelBreakerState(value string) ChannelBreakerState {
	switch ChannelBreakerState(value) {
	case ChannelBreakerStateOpen, ChannelBreakerStateHalfOpen:
		return ChannelBreakerState(value)
	default:
		return ChannelBreakerStateClosed
	}
}

func redisResultString(values []interface{}, idx int) string {
	if idx < 0 || idx >= len(values) {
		return ""
	}
	return redisInterfaceToString(values[idx])
}

func redisInterfaceToString(value interface{}) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case []byte:
		return string(v)
	case int64:
		return strconv.FormatInt(v, 10)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func parseInt64(value string) int64 {
	if value == "" {
		return 0
	}
	parsed, _ := strconv.ParseInt(value, 10, 64)
	return parsed
}

func channelBreakerStateKey(channelID int) string {
	return fmt.Sprintf("channel:breaker:%d", channelID)
}

const redisChannelBreakerTryAcquireScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1]) or 0
local max_probes = tonumber(ARGV[2]) or 1
local state = redis.call('HGET', key, 'state') or 'CLOSED'
if state == 'OPEN' then
  local open_until = tonumber(redis.call('HGET', key, 'open_until') or '0')
  if open_until > now then
    return {0, 'OPEN'}
  end
  redis.call('HSET', key, 'state', 'HALF_OPEN', 'probe_inflight', 0, 'success_count', 0, 'updated_at', now)
  redis.call('HDEL', key, 'open_until', 'opened_at')
  state = 'HALF_OPEN'
end
if state == 'HALF_OPEN' then
  local probe_inflight = tonumber(redis.call('HGET', key, 'probe_inflight') or '0')
  if probe_inflight >= max_probes then
    return {0, 'HALF_OPEN'}
  end
  redis.call('HINCRBY', key, 'probe_inflight', 1)
  redis.call('HSET', key, 'updated_at', now)
  return {1, 'HALF_OPEN'}
end
if state ~= 'CLOSED' then
  redis.call('HSET', key, 'state', 'CLOSED', 'probe_inflight', 0, 'success_count', 0, 'updated_at', now)
  redis.call('HDEL', key, 'open_until', 'opened_at')
end
return {1, 'CLOSED'}
`

const redisChannelBreakerRecordFailureScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1]) or 0
local window_seconds = tonumber(ARGV[2]) or 60
local threshold = tonumber(ARGV[3]) or 1
local cooldown = tonumber(ARGV[4]) or 300
local err_type = ARGV[5] or ''
local error_type_count = tonumber(ARGV[6]) or 0
local function reset_failures()
  local fields = {'window_start'}
  for i = 1, error_type_count do
    fields[#fields + 1] = 'fail:' .. ARGV[6 + i]
  end
  redis.call('HDEL', key, unpack(fields))
end
local state = redis.call('HGET', key, 'state') or 'CLOSED'
if state == 'HALF_OPEN' then
  reset_failures()
  redis.call('HSET', key, 'state', 'OPEN', 'open_until', now + cooldown, 'opened_at', now, 'probe_inflight', 0, 'success_count', 0, 'updated_at', now)
  return 1
end
if err_type == '' then
  return 0
end
local window_start = tonumber(redis.call('HGET', key, 'window_start') or '0')
if window_start == 0 or (now - window_start) >= window_seconds then
  reset_failures()
  window_start = now
  redis.call('HSET', key, 'window_start', window_start)
end
local count = tonumber(redis.call('HINCRBY', key, 'fail:' .. err_type, 1))
redis.call('HSET', key, 'updated_at', now)
if count >= threshold then
  reset_failures()
  redis.call('HSET', key, 'state', 'OPEN', 'open_until', now + cooldown, 'opened_at', now, 'probe_inflight', 0, 'success_count', 0, 'updated_at', now)
  return 1
end
return 0
`

const redisChannelBreakerMarkSuccessScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1]) or 0
local success_threshold = tonumber(ARGV[2]) or 1
local error_type_count = tonumber(ARGV[3]) or 0
local function reset_failures()
  local fields = {'window_start'}
  for i = 1, error_type_count do
    fields[#fields + 1] = 'fail:' .. ARGV[3 + i]
  end
  redis.call('HDEL', key, unpack(fields))
end
local state = redis.call('HGET', key, 'state') or 'CLOSED'
if state ~= 'HALF_OPEN' then
  return state
end
local probe_inflight = tonumber(redis.call('HGET', key, 'probe_inflight') or '0')
if probe_inflight > 0 then
  redis.call('HINCRBY', key, 'probe_inflight', -1)
end
local success_count = tonumber(redis.call('HINCRBY', key, 'success_count', 1))
redis.call('HSET', key, 'updated_at', now)
if success_count >= success_threshold then
  reset_failures()
  redis.call('HSET', key, 'state', 'CLOSED', 'probe_inflight', 0, 'success_count', 0, 'updated_at', now)
  redis.call('HDEL', key, 'open_until', 'opened_at')
  return 'CLOSED'
end
return 'HALF_OPEN'
`
