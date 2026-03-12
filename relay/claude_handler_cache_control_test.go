package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func TestNormalizeClaudeTopLevelCacheControl_SystemString(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model:        "claude-sonnet-4-5-20250929",
		System:       "system prompt",
		CacheControl: []byte(`{"type":"ephemeral"}`),
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hello"},
		},
	}

	ok := normalizeClaudeTopLevelCacheControl(req)
	if !ok {
		t.Fatalf("expected normalize success")
	}
	if len(req.CacheControl) != 0 {
		t.Fatalf("expected top-level cache_control cleared")
	}

	system, ok := req.System.([]dto.ClaudeMediaMessage)
	if !ok || len(system) != 1 {
		t.Fatalf("expected system converted to one media block, got: %#v", req.System)
	}
	if system[0].Type != "text" || system[0].GetText() != "system prompt" {
		t.Fatalf("unexpected system block: %#v", system[0])
	}
	if len(system[0].CacheControl) == 0 {
		t.Fatalf("expected system block cache_control preserved")
	}
}

func TestNormalizeClaudeTopLevelCacheControl_MessageFallback(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model:        "claude-sonnet-4-5-20250929",
		CacheControl: []byte(`{"type":"ephemeral"}`),
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "first"},
			{Role: "assistant", Content: "second"},
		},
	}

	ok := normalizeClaudeTopLevelCacheControl(req)
	if !ok {
		t.Fatalf("expected normalize success")
	}
	if len(req.CacheControl) != 0 {
		t.Fatalf("expected top-level cache_control cleared")
	}

	last := req.Messages[len(req.Messages)-1]
	content, err := last.ParseContent()
	if err != nil || len(content) != 1 {
		t.Fatalf("expected last message converted to one content block, err=%v, content=%#v", err, content)
	}
	if content[0].Type != "text" || content[0].GetText() != "second" {
		t.Fatalf("unexpected last content block: %#v", content[0])
	}
	if len(content[0].CacheControl) == 0 {
		t.Fatalf("expected cache_control on fallback message content")
	}
}

func TestNormalizeClaudeTopLevelCacheControl_BlockLevelAlreadyPresent(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model:        "claude-sonnet-4-5-20250929",
		CacheControl: []byte(`{"type":"ephemeral"}`),
		System: []dto.ClaudeMediaMessage{
			{
				Type:         "text",
				Text:         common.GetPointer("sys"),
				CacheControl: []byte(`{"type":"ephemeral","ttl":"1h"}`),
			},
		},
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hello"},
		},
	}

	ok := normalizeClaudeTopLevelCacheControl(req)
	if !ok {
		t.Fatalf("expected normalize success")
	}
	if len(req.CacheControl) != 0 {
		t.Fatalf("expected top-level cache_control cleared")
	}

	system := req.ParseSystem()
	if len(system) != 1 || len(system[0].CacheControl) == 0 {
		t.Fatalf("expected existing block-level cache_control kept, got: %#v", system)
	}
}

func TestNormalizeClaudeTopLevelCacheControl_NoTextBlock(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model:        "claude-sonnet-4-5-20250929",
		CacheControl: []byte(`{"type":"ephemeral"}`),
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []dto.ClaudeMediaMessage{
					{Type: "tool_use", Id: "id_1", Name: "tool_a", Input: map[string]any{"k": "v"}},
				},
			},
		},
	}

	ok := normalizeClaudeTopLevelCacheControl(req)
	if ok {
		t.Fatalf("expected normalize failure when no text block exists")
	}
	if len(req.CacheControl) == 0 {
		t.Fatalf("expected top-level cache_control unchanged on failure")
	}
}

