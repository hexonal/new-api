package dto

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type ChannelSettings struct {
	ForceFormat            bool   `json:"force_format,omitempty"`
	ThinkingToContent      bool   `json:"thinking_to_content,omitempty"`
	ImageURLAutoBase64     bool   `json:"image_url_auto_base64,omitempty"`
	ImageURLSupported      *bool  `json:"image_url_supported,omitempty"` // 是否允许图片 URL 直传下游（nil=兼容旧行为按支持处理）
	Proxy                  string `json:"proxy"`
	PassThroughBodyEnabled bool   `json:"pass_through_body_enabled,omitempty"`
	SystemPrompt           string `json:"system_prompt,omitempty"`
	SystemPromptOverride   bool   `json:"system_prompt_override,omitempty"`
}

type VertexKeyType string

const (
	VertexKeyTypeJSON   VertexKeyType = "json"
	VertexKeyTypeAPIKey VertexKeyType = "api_key"
)

type AwsKeyType string

const (
	AwsKeyTypeAKSK   AwsKeyType = "ak_sk" // 默认
	AwsKeyTypeApiKey AwsKeyType = "api_key"
)

type ChannelOtherSettings struct {
	AzureResponsesVersion                 string        `json:"azure_responses_version,omitempty"`
	VertexKeyType                         VertexKeyType `json:"vertex_key_type,omitempty"` // "json" or "api_key"
	OpenRouterEnterprise                  *bool         `json:"openrouter_enterprise,omitempty"`
	CallErrorAlertEnabled                 *bool         `json:"call_error_alert_enabled,omitempty"`            // 渠道级 call_error 告警开关（nil=继承全局）
	CallErrorThresholdCount               *int          `json:"call_error_threshold_count,omitempty"`          // 渠道级 call_error 告警阈值次数
	CallErrorThresholdWindowMinutes       *int          `json:"call_error_threshold_window_minutes,omitempty"` // 渠道级 call_error 告警窗口（分钟）
	CallErrorCooldownMinutes              *int          `json:"call_error_cooldown_minutes,omitempty"`         // 渠道级 call_error 告警冷却（分钟，预留）
	ClaudeBetaQuery                       bool          `json:"claude_beta_query,omitempty"`                   // Claude 渠道是否强制追加 ?beta=true
	AllowServiceTier                      bool          `json:"allow_service_tier,omitempty"`                  // 是否允许 service_tier 透传（默认过滤以避免额外计费）
	AllowInferenceGeo                     bool          `json:"allow_inference_geo,omitempty"`                 // 是否允许 inference_geo 透传（仅 Claude，默认过滤以满足数据驻留合规
	AllowSafetyIdentifier                 bool          `json:"allow_safety_identifier,omitempty"`             // 是否允许 safety_identifier 透传（默认过滤以保护用户隐私）
	DisableStore                          bool          `json:"disable_store,omitempty"`                       // 是否禁用 store 透传（默认允许透传，禁用后可能导致 Codex 无法使用）
	AllowIncludeObfuscation               bool          `json:"allow_include_obfuscation,omitempty"`           // 是否允许 stream_options.include_obfuscation 透传（默认过滤以避免关闭流混淆保护）
	AwsKeyType                            AwsKeyType    `json:"aws_key_type,omitempty"`
	UpstreamModelUpdateCheckEnabled       bool          `json:"upstream_model_update_check_enabled,omitempty"`        // 是否检测上游模型更新
	UpstreamModelUpdateAutoSyncEnabled    bool          `json:"upstream_model_update_auto_sync_enabled,omitempty"`    // 是否自动同步上游模型更新
	UpstreamModelUpdateLastCheckTime      int64         `json:"upstream_model_update_last_check_time,omitempty"`      // 上次检测时间
	UpstreamModelUpdateLastDetectedModels []string      `json:"upstream_model_update_last_detected_models,omitempty"` // 上次检测到的可加入模型
	UpstreamModelUpdateLastRemovedModels  []string      `json:"upstream_model_update_last_removed_models,omitempty"`  // 上次检测到的可删除模型
	UpstreamModelUpdateIgnoredModels      []string      `json:"upstream_model_update_ignored_models,omitempty"`       // 手动忽略的模型
	BreakerEnabled                        bool          `json:"breaker_enabled,omitempty"`
	BreakerThresholdCount                 int           `json:"breaker_threshold_count,omitempty"`
	BreakerWindowSeconds                  int           `json:"breaker_window_seconds,omitempty"`
	BreakerCooldownSeconds                int           `json:"breaker_cooldown_seconds,omitempty"`
	BreakerHalfOpenProbeCount             int           `json:"breaker_half_open_probe_count,omitempty"`
	BreakerRecoverySuccessCount           int           `json:"breaker_recovery_success_count,omitempty"`
	BreakerErrorTypes                     []string      `json:"breaker_error_types,omitempty"`
}

var defaultChannelBreakerErrorTypes = []string{
	"balance_insufficient",
	"service_unavailable",
	"429",
	"5xx",
	"timeout",
	"524",
}

func (s ChannelOtherSettings) GetBreakerConfig() common.ChannelBreakerConfig {
	cfg := common.ChannelBreakerConfig{
		Enabled:              s.BreakerEnabled,
		ThresholdCount:       10,
		WindowSeconds:        60,
		CooldownSeconds:      300,
		HalfOpenProbeCount:   1,
		RecoverySuccessCount: 1,
		ErrorTypes:           append([]string(nil), defaultChannelBreakerErrorTypes...),
	}
	if s.BreakerThresholdCount > 0 {
		cfg.ThresholdCount = s.BreakerThresholdCount
	}
	if s.BreakerWindowSeconds > 0 {
		cfg.WindowSeconds = s.BreakerWindowSeconds
	}
	if s.BreakerCooldownSeconds > 0 {
		cfg.CooldownSeconds = s.BreakerCooldownSeconds
	}
	if s.BreakerHalfOpenProbeCount > 0 {
		cfg.HalfOpenProbeCount = s.BreakerHalfOpenProbeCount
	}
	if s.BreakerRecoverySuccessCount > 0 {
		cfg.RecoverySuccessCount = s.BreakerRecoverySuccessCount
	}
	if normalized := normalizeBreakerErrorTypes(s.BreakerErrorTypes); len(normalized) > 0 {
		cfg.ErrorTypes = normalized
	}
	return cfg
}

func normalizeBreakerErrorTypes(items []string) []string {
	if len(items) == 0 {
		return nil
	}
	allowed := make(map[string]struct{}, len(defaultChannelBreakerErrorTypes))
	for _, item := range defaultChannelBreakerErrorTypes {
		allowed[item] = struct{}{}
	}
	normalized := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		value := strings.TrimSpace(item)
		if value == "" {
			continue
		}
		if _, ok := allowed[value]; !ok {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func (s *ChannelOtherSettings) IsOpenRouterEnterprise() bool {
	if s == nil || s.OpenRouterEnterprise == nil {
		return false
	}
	return *s.OpenRouterEnterprise
}
