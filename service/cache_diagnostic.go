package service

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

const (
	cacheStatusHit     = "hit"
	cacheStatusCreated = "created"
	cacheStatusMiss    = "miss"

	cacheMissReasonNoBreakpoint = "no_cache_control_breakpoint"
	cacheMissReasonBelowMin     = "below_min_prompt_tokens"
	cacheMissReasonAWSNoSignal  = "upstream_no_cache_signal_aws"
	cacheMissReasonNoSignal     = "upstream_no_cache_signal"
)

// AppendClaudeCacheDiagnosticInfo writes lightweight cache diagnostics into the log "other" map.
// It is intentionally side-effect free for existing billing logic.
func AppendClaudeCacheDiagnosticInfo(relayInfo *relaycommon.RelayInfo, usage *dto.Usage, other map[string]interface{}) {
	if relayInfo == nil || usage == nil || other == nil {
		return
	}

	cacheReadTokens := usage.PromptTokensDetails.CachedTokens
	cacheCreationTokens := usage.PromptTokensDetails.CachedCreationTokens +
		usage.ClaudeCacheCreation5mTokens +
		usage.ClaudeCacheCreation1hTokens

	if cacheReadTokens > 0 {
		other["cache_status"] = cacheStatusHit
		return
	}
	if cacheCreationTokens > 0 {
		other["cache_status"] = cacheStatusCreated
		return
	}

	other["cache_status"] = cacheStatusMiss
	hasBreakpoint := hasCacheControlBreakpoint(relayInfo.Request)
	other["cache_breakpoint_present"] = hasBreakpoint

	minTokens := getClaudeCacheMinPromptTokens(relayInfo.OriginModelName)
	if minTokens > 0 {
		other["cache_min_tokens_required"] = minTokens
	}
	other["cache_prompt_tokens_observed"] = usage.PromptTokens

	switch {
	case !hasBreakpoint:
		other["cache_miss_reason"] = cacheMissReasonNoBreakpoint
	case minTokens > 0 && usage.PromptTokens < minTokens:
		other["cache_miss_reason"] = cacheMissReasonBelowMin
	case relayInfo.ChannelType == constant.ChannelTypeAws:
		other["cache_miss_reason"] = cacheMissReasonAWSNoSignal
	default:
		other["cache_miss_reason"] = cacheMissReasonNoSignal
	}
}

func getClaudeCacheMinPromptTokens(modelName string) int {
	name := strings.ToLower(modelName)
	switch {
	case strings.Contains(name, "claude-opus-4-6"):
		return 4096
	case strings.Contains(name, "claude-sonnet-4-6"):
		return 1024
	default:
		return 0
	}
}

func hasCacheControlBreakpoint(req dto.Request) bool {
	if req == nil {
		return false
	}

	switch r := req.(type) {
	case *dto.GeneralOpenAIRequest:
		return hasOpenAICacheControlBreakpoint(r)
	case *dto.ClaudeRequest:
		return hasClaudeCacheControlBreakpoint(r)
	default:
		return false
	}
}

func hasOpenAICacheControlBreakpoint(req *dto.GeneralOpenAIRequest) bool {
	if req == nil {
		return false
	}
	for _, message := range req.Messages {
		for _, content := range message.ParseContent() {
			if len(content.CacheControl) > 0 {
				return true
			}
		}
	}
	return false
}

func hasClaudeCacheControlBreakpoint(req *dto.ClaudeRequest) bool {
	if req == nil {
		return false
	}
	if len(req.CacheControl) > 0 {
		return true
	}
	if !req.IsStringSystem() {
		for _, block := range req.ParseSystem() {
			if len(block.CacheControl) > 0 {
				return true
			}
		}
	}
	for _, message := range req.Messages {
		blocks, err := message.ParseContent()
		if err != nil {
			continue
		}
		for _, block := range blocks {
			if len(block.CacheControl) > 0 {
				return true
			}
		}
	}
	return false
}
