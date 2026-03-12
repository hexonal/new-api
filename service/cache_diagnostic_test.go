package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestAppendClaudeCacheDiagnosticInfo_NoBreakpoint(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-4-6",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeAws},
		Request: &dto.GeneralOpenAIRequest{
			Messages: []dto.Message{{Role: "user", Content: "hello"}},
		},
	}
	usage := &dto.Usage{PromptTokens: 5000}
	other := map[string]interface{}{}

	AppendClaudeCacheDiagnosticInfo(relayInfo, usage, other)

	require.Equal(t, "miss", other["cache_status"])
	require.Equal(t, "upstream_no_cache_signal_aws", other["cache_miss_reason"])
	require.Equal(t, "no_cache_control_breakpoint", other["cache_miss_local_hint"])
	require.Equal(t, "upstream_usage", other["cache_status_source"])
	require.Equal(t, false, other["cache_breakpoint_present"])
}

func TestAppendClaudeCacheDiagnosticInfo_BelowMinTokens(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-4-6",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeAws},
		Request:         buildOpenAICacheBreakpointRequest(),
	}
	usage := &dto.Usage{PromptTokens: 1000}
	other := map[string]interface{}{}

	AppendClaudeCacheDiagnosticInfo(relayInfo, usage, other)

	require.Equal(t, "miss", other["cache_status"])
	require.Equal(t, "upstream_no_cache_signal_aws", other["cache_miss_reason"])
	require.Equal(t, "below_min_prompt_tokens", other["cache_miss_local_hint"])
	require.Equal(t, true, other["cache_breakpoint_present"])
	require.Equal(t, 4096, other["cache_min_tokens_required"])
	require.Equal(t, "upstream_usage", other["cache_status_source"])
}

func TestAppendClaudeCacheDiagnosticInfo_HitAndCreated(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-4-6",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeAws},
		Request:         buildOpenAICacheBreakpointRequest(),
	}

	hitUsage := &dto.Usage{
		PromptTokens: 3,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 4510,
		},
	}
	hitOther := map[string]interface{}{}
	AppendClaudeCacheDiagnosticInfo(relayInfo, hitUsage, hitOther)
	require.Equal(t, "hit", hitOther["cache_status"])
	require.Equal(t, "upstream_usage", hitOther["cache_status_source"])
	_, hasHitMissReason := hitOther["cache_miss_reason"]
	require.False(t, hasHitMissReason)

	createUsage := &dto.Usage{
		PromptTokens:                3,
		ClaudeCacheCreation5mTokens: 4510,
	}
	createOther := map[string]interface{}{}
	AppendClaudeCacheDiagnosticInfo(relayInfo, createUsage, createOther)
	require.Equal(t, "created", createOther["cache_status"])
	require.Equal(t, "upstream_usage", createOther["cache_status_source"])
	_, hasCreateMissReason := createOther["cache_miss_reason"]
	require.False(t, hasCreateMissReason)
}

func TestAppendClaudeCacheDiagnosticInfo_AWSNoSignal(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-4-6",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeAws},
		Request:         buildOpenAICacheBreakpointRequest(),
	}
	usage := &dto.Usage{PromptTokens: 5000}
	other := map[string]interface{}{}

	AppendClaudeCacheDiagnosticInfo(relayInfo, usage, other)

	require.Equal(t, "miss", other["cache_status"])
	require.Equal(t, "upstream_no_cache_signal_aws", other["cache_miss_reason"])
	_, hasHint := other["cache_miss_local_hint"]
	require.False(t, hasHint)
	require.Equal(t, true, other["cache_breakpoint_present"])
	require.Equal(t, "upstream_usage", other["cache_status_source"])
}

func TestAppendClaudeCacheDiagnosticInfo_NonAWSNoSignal(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-4-6",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeAnthropic},
		Request:         buildOpenAICacheBreakpointRequest(),
	}
	usage := &dto.Usage{PromptTokens: 5000}
	other := map[string]interface{}{}

	AppendClaudeCacheDiagnosticInfo(relayInfo, usage, other)

	require.Equal(t, "miss", other["cache_status"])
	require.Equal(t, "upstream_no_cache_signal", other["cache_miss_reason"])
	require.Equal(t, "upstream_usage", other["cache_status_source"])
}

func buildOpenAICacheBreakpointRequest() *dto.GeneralOpenAIRequest {
	return &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			{
				Role: "system",
				Content: []any{
					map[string]any{
						"type":          "text",
						"text":          "prefix",
						"cache_control": map[string]any{"type": "ephemeral"},
					},
				},
			},
			{
				Role: "user",
				Content: []any{
					map[string]any{
						"type":          "text",
						"text":          "question",
						"cache_control": map[string]any{"type": "ephemeral"},
					},
				},
			},
		},
	}
}
