package openaicompat

import "github.com/QuantumNous/new-api/setting/model_setting"

// responseNativeModelPatterns are models that should always be routed through
// /v1/responses when called from /v1/chat/completions compatibility mode.
// This protects chat callers from upstream endpoint incompatibilities.
var responseNativeModelPatterns = []string{
	`^gpt-5\.3-codex$`,
}

func ShouldChatCompletionsUseResponsesPolicy(policy model_setting.ChatCompletionsToResponsesPolicy, channelID int, channelType int, model string) bool {
	if !policy.IsChannelEnabled(channelID, channelType) {
		return false
	}
	return matchAnyRegex(policy.ModelPatterns, model)
}

func shouldForceResponsesByModel(model string) bool {
	return matchAnyRegex(responseNativeModelPatterns, model)
}

func ShouldChatCompletionsUseResponsesGlobal(channelID int, channelType int, model string) bool {
	if shouldForceResponsesByModel(model) {
		return true
	}
	return ShouldChatCompletionsUseResponsesPolicy(
		model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy,
		channelID,
		channelType,
		model,
	)
}
