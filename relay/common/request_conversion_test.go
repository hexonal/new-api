package common

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestAppendRequestConversionFromRequest_UpdatesRelayRequest(t *testing.T) {
	originalRequest := &dto.GeneralOpenAIRequest{
		Model: "claude-sonnet-4-6",
	}
	convertedRequest := &dto.ClaudeRequest{
		Model: "claude-sonnet-4-6",
	}
	info := &RelayInfo{
		Request:                originalRequest,
		RelayFormat:            types.RelayFormatOpenAI,
		RequestConversionChain: []types.RelayFormat{types.RelayFormatOpenAI},
	}

	AppendRequestConversionFromRequest(info, convertedRequest)

	require.Same(t, convertedRequest, info.Request)
	require.Equal(t, []types.RelayFormat{
		types.RelayFormatOpenAI,
		types.RelayFormatClaude,
	}, info.RequestConversionChain)
}

func TestAppendRequestConversionFromRequest_IgnoreUnknownType(t *testing.T) {
	originalRequest := &dto.GeneralOpenAIRequest{
		Model: "claude-sonnet-4-6",
	}
	info := &RelayInfo{
		Request:                originalRequest,
		RelayFormat:            types.RelayFormatOpenAI,
		RequestConversionChain: []types.RelayFormat{types.RelayFormatOpenAI},
	}

	AppendRequestConversionFromRequest(info, map[string]any{"foo": "bar"})

	require.Same(t, originalRequest, info.Request)
	require.Equal(t, []types.RelayFormat{
		types.RelayFormatOpenAI,
	}, info.RequestConversionChain)
}

