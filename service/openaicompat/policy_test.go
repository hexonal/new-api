package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/model_setting"
)

func TestShouldForceResponsesByModel(t *testing.T) {
	if !shouldForceResponsesByModel("gpt-5.3-codex") {
		t.Fatalf("expected gpt-5.3-codex to force responses compatibility")
	}
	if shouldForceResponsesByModel("gpt-5.2") {
		t.Fatalf("did not expect gpt-5.2 to force responses compatibility")
	}
}

func TestShouldChatCompletionsUseResponsesPolicy(t *testing.T) {
	policy := model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		AllChannels:   false,
		ChannelIDs:    []int{3},
		ModelPatterns: []string{`^gpt-5\.3-codex$`},
	}

	if !ShouldChatCompletionsUseResponsesPolicy(policy, 3, 0, "gpt-5.3-codex") {
		t.Fatalf("expected policy match for channel 3 + gpt-5.3-codex")
	}
	if ShouldChatCompletionsUseResponsesPolicy(policy, 12, 0, "gpt-5.3-codex") {
		t.Fatalf("did not expect policy match for channel 12")
	}
	if ShouldChatCompletionsUseResponsesPolicy(policy, 3, 0, "gpt-5.2") {
		t.Fatalf("did not expect policy match for gpt-5.2")
	}
}

