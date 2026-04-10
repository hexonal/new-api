package hailuo

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	ChannelName = "hailuo-video"
)

var ModelList = []string{
	"MiniMax-Hailuo-2.3",
	"MiniMax-Hailuo-2.3-Fast",
	"MiniMax-Hailuo-02",
	"T2V-01-Director",
	"T2V-01",
	"I2V-01-Director",
	"I2V-01-live",
	"I2V-01",
	"S2V-01",
}

const (
	TextToVideoEndpoint = "/v1/video_generation"
	QueryTaskEndpoint   = "/v1/query/video_generation"
)

const (
	StatusSuccess    = 0
	StatusRateLimit  = 1002
	StatusAuthFailed = 1004
	StatusNoBalance  = 1008
	StatusSensitive  = 1026
	StatusParamError = 2013
	StatusInvalidKey = 2049
)

const (
	TaskStatusPreparing  = "Preparing"
	TaskStatusQueueing   = "Queueing"
	TaskStatusProcessing = "Processing"
	TaskStatusSuccess    = "Success"
	TaskStatusFailed     = "Fail"
)

const (
	Resolution512P  = "512P"
	Resolution720P  = "720P"
	Resolution768P  = "768P"
	Resolution1080P = "1080P"
)

const (
	DefaultDuration   = 6
	DefaultResolution = Resolution720P
)

// NormalizeResolution uppercases and trims a resolution string.
func NormalizeResolution(resolution string) string {
	return strings.ToUpper(strings.TrimSpace(resolution))
}

// IsValidResolution checks if the resolution is in the supported set.
func IsValidResolution(resolution string) bool {
	switch resolution {
	case Resolution512P, Resolution720P, Resolution768P, Resolution1080P:
		return true
	default:
		return false
	}
}

// ParseDurationFromOverride parses duration from param_override tolerant values.
func ParseDurationFromOverride(v any) (int, error) {
	switch val := v.(type) {
	case float64:
		return int(val), nil
	case string:
		if i, err := strconv.Atoi(strings.TrimSpace(val)); err == nil {
			return i, nil
		}
		return 0, fmt.Errorf("invalid duration string: %s", val)
	default:
		return 0, fmt.Errorf("unsupported duration type: %T", v)
	}
}

// ResolutionMultiplier returns price multiplier relative to 768P baseline.
// Based on MiniMax official pricing.
func ResolutionMultiplier(model, resolution string) float64 {
	m := strings.ToLower(model)
	resolution = NormalizeResolution(resolution)
	switch resolution {
	case Resolution512P:
		if strings.Contains(m, "hailuo-02") {
			return 0.30 // ¥0.60 / ¥2.00
		}
		return 1.0
	case Resolution768P, Resolution720P:
		return 1.0
	case Resolution1080P:
		if strings.Contains(m, "2.3-fast") {
			return 1.711 // ¥2.31 / ¥1.35
		}
		return 1.75 // ¥3.50 / ¥2.00
	default:
		return 1.0
	}
}

// DurationMultiplier returns price multiplier relative to 6s baseline.
func DurationMultiplier(model string, duration int) float64 {
	if duration <= 6 {
		return 1.0
	}
	m := strings.ToLower(model)
	if strings.Contains(m, "2.3-fast") {
		return 1.667 // ¥2.25 / ¥1.35
	}
	return 2.0 // ¥4.00 / ¥2.00
}
