package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestAnthropicEndpointTypeCapabilityContract(t *testing.T) {
	specs := capabilitySpecsFromEndpointType(constant.EndpointTypeAnthropic)

	chat, ok := specs["chat"]
	if !ok {
		t.Fatal("expected chat capability")
	}
	if chat.Path != "/v1/chat/completions" {
		t.Fatalf("unexpected chat path: %s", chat.Path)
	}
	if chat.ProviderStyle != "openai-chat" {
		t.Fatalf("unexpected chat provider style: %s", chat.ProviderStyle)
	}
	if chat.SDKMethod != "aiApi.chatCompletions" {
		t.Fatalf("unexpected chat sdk method: %s", chat.SDKMethod)
	}

	claude, ok := specs["claude_messages"]
	if !ok {
		t.Fatal("expected claude_messages capability")
	}
	if claude.Path != "/v1/messages" {
		t.Fatalf("unexpected claude_messages path: %s", claude.Path)
	}
	if claude.ProviderStyle != "anthropic" {
		t.Fatalf("unexpected claude_messages provider style: %s", claude.ProviderStyle)
	}
	if claude.SDKMethod != "aiApi.messages" {
		t.Fatalf("unexpected claude_messages sdk method: %s", claude.SDKMethod)
	}
}

func TestInferSDKMethodKeepsClaudeMessagesSyncMethod(t *testing.T) {
	got := inferSDKMethod("claude_messages", "/v1/messages", "anthropic")
	if got != "aiApi.messages" {
		t.Fatalf("unexpected claude_messages sdk method: %s", got)
	}
}
