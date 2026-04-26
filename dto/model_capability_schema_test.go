package dto

import (
	"encoding/json"
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
	if chat.StreamSDKMethod != "aiApi.chatCompletionsStream" {
		t.Fatalf("unexpected chat stream sdk method: %s", chat.StreamSDKMethod)
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
	if claude.StreamSDKMethod != "aiApi.messagesStream" {
		t.Fatalf("unexpected claude_messages stream sdk method: %s", claude.StreamSDKMethod)
	}
}

func TestInferSDKMethodKeepsClaudeMessagesSyncMethod(t *testing.T) {
	got := inferSDKMethod("claude_messages", "/v1/messages", "anthropic")
	if got != "aiApi.messages" {
		t.Fatalf("unexpected claude_messages sdk method: %s", got)
	}
}

func TestInferStreamSDKMethodForTextCapabilities(t *testing.T) {
	chat := inferStreamSDKMethod("chat", "/v1/chat/completions", "openai-chat")
	if chat != "aiApi.chatCompletionsStream" {
		t.Fatalf("unexpected chat stream sdk method: %s", chat)
	}

	claude := inferStreamSDKMethod("claude_messages", "/v1/messages", "anthropic")
	if claude != "aiApi.messagesStream" {
		t.Fatalf("unexpected claude_messages stream sdk method: %s", claude)
	}
}

func TestParseCapabilitySpecPreservesExplicitSDKMethod(t *testing.T) {
	raw := json.RawMessage(`{
		"supported": true,
		"path": "/v1/messages",
		"method": "POST",
		"provider_style": "anthropic",
		"request_format": "json",
		"sdk_method": "aiApi.messagesStream",
		"parameters": {}
	}`)

	spec, ok := parseCapabilitySpec("claude_messages", raw)
	if !ok {
		t.Fatal("expected claude_messages capability to parse")
	}
	if spec.SDKMethod != "aiApi.messagesStream" {
		t.Fatalf("unexpected preserved sdk method: %s", spec.SDKMethod)
	}
	if spec.StreamSDKMethod != "aiApi.messagesStream" {
		t.Fatalf("unexpected stream sdk method: %s", spec.StreamSDKMethod)
	}
}

func TestImageToImageUnifiedGenerationsPreservesSyncContract(t *testing.T) {
	raw := json.RawMessage(`{
		"supported": true,
		"path": "/v1/images/generations",
		"method": "POST",
		"provider_style": "openai-image",
		"request_format": "json",
		"sdk_method": "aiApi.imageGenerations",
		"parameters": {}
	}`)

	spec, ok := parseCapabilitySpec("image_to_image", raw)
	if !ok {
		t.Fatal("expected image_to_image capability to parse")
	}
	if spec.Path != "/v1/images/generations" {
		t.Fatalf("unexpected image_to_image path: %s", spec.Path)
	}
	if spec.RequestFormat != "json" {
		t.Fatalf("unexpected image_to_image request format: %s", spec.RequestFormat)
	}
	if spec.SDKMethod != "aiApi.imageGenerations" {
		t.Fatalf("unexpected image_to_image sdk method: %s", spec.SDKMethod)
	}
}
