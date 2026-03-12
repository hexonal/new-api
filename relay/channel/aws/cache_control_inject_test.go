package aws

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestMaybeInjectAwsClaudeCacheControl_SystemString(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model:  "claude-sonnet-4-6",
		System: "stable system prefix",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "question"},
		},
	}

	injected := maybeInjectAwsClaudeCacheControl(req)
	require.True(t, injected)
	require.False(t, req.IsStringSystem())
	systemBlocks := req.ParseSystem()
	require.NotEmpty(t, systemBlocks)
	require.NotEmpty(t, systemBlocks[0].CacheControl)
}

func TestMaybeInjectAwsClaudeCacheControl_MessageString(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model:  "claude-sonnet-4-6",
		System: "",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "long stable prefix block for cache"},
			{Role: "user", Content: "short dynamic question"},
		},
	}

	injected := maybeInjectAwsClaudeCacheControl(req)
	require.True(t, injected)
	blocks, err := req.Messages[0].ParseContent()
	require.NoError(t, err)
	require.NotEmpty(t, blocks)
	require.NotEmpty(t, blocks[0].CacheControl)
}

func TestMaybeInjectAwsClaudeCacheControl_ExistingCacheControl(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model: "claude-sonnet-4-6",
		Messages: []dto.ClaudeMessage{
			{
				Role: "user",
				Content: []any{
					map[string]any{
						"type":          "text",
						"text":          "already has cache control",
						"cache_control": map[string]any{"type": "ephemeral"},
					},
				},
			},
		},
	}

	injected := maybeInjectAwsClaudeCacheControl(req)
	require.False(t, injected)
	blocks, err := req.Messages[0].ParseContent()
	require.NoError(t, err)
	require.NotEmpty(t, blocks)
	require.NotEmpty(t, blocks[0].CacheControl)
}

func TestMaybeInjectAwsClaudeCacheControl_PreferFirstUserContent(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model:  "claude-sonnet-4-6",
		System: "",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "stable prefix"},
			{Role: "assistant", Content: "very very very very very long assistant message"},
			{Role: "user", Content: "another user message"},
		},
	}

	injected := maybeInjectAwsClaudeCacheControl(req)
	require.True(t, injected)

	firstBlocks, err := req.Messages[0].ParseContent()
	require.NoError(t, err)
	require.NotEmpty(t, firstBlocks)
	require.NotEmpty(t, firstBlocks[0].CacheControl)

	require.True(t, req.Messages[1].IsStringContent())
}
