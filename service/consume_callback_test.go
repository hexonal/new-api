package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
)

func TestNormalizeConsumeUsage_DerivesPromptTokens(t *testing.T) {
	usage := normalizeConsumeUsage(ConsumeCallbackUsage{
		CompletionTokens: 32,
		TotalTokens:      120,
	})

	assert.Equal(t, 88, usage.PromptTokens)
	assert.Equal(t, 32, usage.CompletionTokens)
	assert.Equal(t, 120, usage.TotalTokens)
}

func TestNormalizeConsumeUsage_FixesInconsistentTotals(t *testing.T) {
	usage := normalizeConsumeUsage(ConsumeCallbackUsage{
		PromptTokens:     20,
		CompletionTokens: 30,
		TotalTokens:      10,
	})

	assert.Equal(t, 20, usage.PromptTokens)
	assert.Equal(t, 30, usage.CompletionTokens)
	assert.Equal(t, 50, usage.TotalTokens)
}

func TestNewConsumeCallbackPayload_Normalization(t *testing.T) {
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1000000
	t.Cleanup(func() {
		common.QuotaPerUnit = oldQuotaPerUnit
	})

	payload := newConsumeCallbackPayload(
		"req-1",
		100,
		200,
		"gpt-4o-mini",
		300,
		"",
		ConsumeCallbackUsage{CompletionTokens: 40, TotalTokens: 100},
		250000,
		ConsumeCallbackPhaseSettle,
	)

	assert.Equal(t, "req-1", payload.RequestID)
	assert.Equal(t, 100, payload.UserID)
	assert.Equal(t, 200, payload.TokenID)
	assert.Equal(t, "gpt-4o-mini", payload.ModelName)
	assert.Equal(t, 300, payload.ChannelID)
	assert.Equal(t, BillingSourceWallet, payload.BillingSource)
	assert.Equal(t, 60, payload.PromptTokens)
	assert.Equal(t, 40, payload.CompletionTokens)
	assert.Equal(t, 100, payload.TotalTokens)
	assert.Equal(t, 250000, payload.Quota)
	assert.Equal(t, 0.25, payload.AmountUSD)
	assert.Equal(t, ConsumeCallbackPhaseSettle, payload.EventPhase)
	assert.NotZero(t, payload.Timestamp)
}

func TestIsConsumeCallbackRelayFormatSupported(t *testing.T) {
	assert.True(t, isConsumeCallbackRelayFormatSupported(types.RelayFormatOpenAI))
	assert.True(t, isConsumeCallbackRelayFormatSupported(types.RelayFormatClaude))
	assert.True(t, isConsumeCallbackRelayFormatSupported(types.RelayFormatOpenAIResponses))
	assert.True(t, isConsumeCallbackRelayFormatSupported(types.RelayFormatOpenAIResponsesCompaction))

	assert.False(t, isConsumeCallbackRelayFormatSupported(types.RelayFormatOpenAIAudio))
	assert.False(t, isConsumeCallbackRelayFormatSupported(types.RelayFormatOpenAIImage))
	assert.False(t, isConsumeCallbackRelayFormatSupported(types.RelayFormatTask))
	assert.False(t, isConsumeCallbackRelayFormatSupported(types.RelayFormatMjProxy))
	assert.False(t, isConsumeCallbackRelayFormatSupported(types.RelayFormat("")))
}

func TestIsConsumeCallbackRelayModeSupported(t *testing.T) {
	assert.True(t, isConsumeCallbackRelayModeSupported(relayconstant.RelayModeChatCompletions))
	assert.True(t, isConsumeCallbackRelayModeSupported(relayconstant.RelayModeCompletions))
	assert.True(t, isConsumeCallbackRelayModeSupported(relayconstant.RelayModeResponses))
	assert.True(t, isConsumeCallbackRelayModeSupported(relayconstant.RelayModeResponsesCompact))

	assert.False(t, isConsumeCallbackRelayModeSupported(relayconstant.RelayModeUnknown))
	assert.False(t, isConsumeCallbackRelayModeSupported(relayconstant.RelayModeEmbeddings))
	assert.False(t, isConsumeCallbackRelayModeSupported(relayconstant.RelayModeAudioSpeech))
	assert.False(t, isConsumeCallbackRelayModeSupported(relayconstant.RelayModeMidjourneyImagine))
}
