package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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

func TestParseConsumeCallbackUserPrefixFilter(t *testing.T) {
	filter := "  alpha_,\n beta-\r\n\nGamma\nalpha_  "
	prefixes := parseConsumeCallbackUserPrefixFilter(filter)

	assert.Equal(t, []string{"alpha_", "beta-", "Gamma"}, prefixes)
}

func TestParseConsumeCallbackUserPrefixFilter_WildcardSuffix(t *testing.T) {
	filter := "ima_*,\nteam-*\nima_"
	prefixes := parseConsumeCallbackUserPrefixFilter(filter)

	assert.Equal(t, []string{"ima_", "team-"}, prefixes)
}

func TestShouldDispatchConsumeCallbackForUsername_EmptyFilterFallback(t *testing.T) {
	assert.True(t, shouldDispatchConsumeCallbackForUsername("any-user", ""))
	assert.True(t, shouldDispatchConsumeCallbackForUsername("any-user", " ,\n  \r\n"))
}

func TestShouldDispatchConsumeCallbackForUsername_PrefixMatch(t *testing.T) {
	filter := "adm,\nteam-"

	assert.True(t, shouldDispatchConsumeCallbackForUsername("adm001", filter))
	assert.True(t, shouldDispatchConsumeCallbackForUsername("team-bot", filter))
	assert.False(t, shouldDispatchConsumeCallbackForUsername("user01", filter))
	assert.False(t, shouldDispatchConsumeCallbackForUsername("", filter))
}

func TestShouldDispatchConsumeCallbackForUsername_CaseSensitive(t *testing.T) {
	filter := "Admin"

	assert.True(t, shouldDispatchConsumeCallbackForUsername("AdminRoot", filter))
	assert.False(t, shouldDispatchConsumeCallbackForUsername("adminRoot", filter))
}

func TestShouldDispatchConsumeCallbackForUsername_WildcardSuffix(t *testing.T) {
	filter := "ima_*"

	assert.True(t, shouldDispatchConsumeCallbackForUsername("ima_1001", filter))
	assert.False(t, shouldDispatchConsumeCallbackForUsername("imb_1001", filter))
}

func TestResolveConsumeCallbackRouting(t *testing.T) {
	origin := *operation_setting.GetPaymentSetting()
	t.Cleanup(func() {
		*operation_setting.GetPaymentSetting() = origin
	})

	globalURL := "https://global.example.com/callback"
	globalSecret := "global-secret"

	t.Run("no rules -> defaults", func(t *testing.T) {
		cfg := operation_setting.GetPaymentSetting()
		cfg.ConsumeCallbackRoutingRules = nil
		resolved := resolveConsumeCallbackRouting("ima_1", globalURL, globalSecret)
		assert.Equal(t, globalURL, resolved.callbackURL)
		assert.Equal(t, globalSecret, resolved.secret)
	})

	t.Run("rule match -> overrides", func(t *testing.T) {
		cfg := operation_setting.GetPaymentSetting()
		cfg.ConsumeCallbackRoutingRules = []operation_setting.ConsumeCallbackRoutingRule{
			{
				Enabled:       true,
				PrefixPattern: "ima_",
				CallbackURL:   "https://rule.example.com/callback",
				Secret:        "rule-secret",
				Priority:      10,
			},
		}
		resolved := resolveConsumeCallbackRouting("ima_1", globalURL, globalSecret)
		assert.Equal(t, "https://rule.example.com/callback", resolved.callbackURL)
		assert.Equal(t, "rule-secret", resolved.secret)
	})

	t.Run("disabled rule skipped", func(t *testing.T) {
		cfg := operation_setting.GetPaymentSetting()
		cfg.ConsumeCallbackRoutingRules = []operation_setting.ConsumeCallbackRoutingRule{
			{
				Enabled:       false,
				PrefixPattern: "ima_",
				CallbackURL:   "https://disabled.example.com/callback",
				Secret:        "disabled-secret",
				Priority:      10,
			},
		}
		resolved := resolveConsumeCallbackRouting("ima_1", globalURL, globalSecret)
		assert.Equal(t, globalURL, resolved.callbackURL)
		assert.Equal(t, globalSecret, resolved.secret)
	})

	t.Run("no match -> defaults", func(t *testing.T) {
		cfg := operation_setting.GetPaymentSetting()
		cfg.ConsumeCallbackRoutingRules = []operation_setting.ConsumeCallbackRoutingRule{
			{
				Enabled:       true,
				PrefixPattern: "vip_",
				CallbackURL:   "https://vip.example.com/callback",
				Secret:        "vip-secret",
				Priority:      10,
			},
		}
		resolved := resolveConsumeCallbackRouting("ima_1", globalURL, globalSecret)
		assert.Equal(t, globalURL, resolved.callbackURL)
		assert.Equal(t, globalSecret, resolved.secret)
	})

	t.Run("partial override callback url only", func(t *testing.T) {
		cfg := operation_setting.GetPaymentSetting()
		cfg.ConsumeCallbackRoutingRules = []operation_setting.ConsumeCallbackRoutingRule{
			{
				Enabled:       true,
				PrefixPattern: "ima_",
				CallbackURL:   "https://partial.example.com/callback",
				Priority:      10,
			},
		}
		resolved := resolveConsumeCallbackRouting("ima_1", globalURL, globalSecret)
		assert.Equal(t, "https://partial.example.com/callback", resolved.callbackURL)
		assert.Equal(t, globalSecret, resolved.secret)
	})

	t.Run("partial override secret only", func(t *testing.T) {
		cfg := operation_setting.GetPaymentSetting()
		cfg.ConsumeCallbackRoutingRules = []operation_setting.ConsumeCallbackRoutingRule{
			{
				Enabled:       true,
				PrefixPattern: "ima_",
				Secret:        "partial-secret",
				Priority:      10,
			},
		}
		resolved := resolveConsumeCallbackRouting("ima_1", globalURL, globalSecret)
		assert.Equal(t, globalURL, resolved.callbackURL)
		assert.Equal(t, "partial-secret", resolved.secret)
	})

	t.Run("priority ordering", func(t *testing.T) {
		cfg := operation_setting.GetPaymentSetting()
		cfg.ConsumeCallbackRoutingRules = []operation_setting.ConsumeCallbackRoutingRule{
			{
				Enabled:       true,
				PrefixPattern: "ima_",
				CallbackURL:   "https://low.example.com/callback",
				Secret:        "low-secret",
				Priority:      1,
			},
			{
				Enabled:       true,
				PrefixPattern: "ima_",
				CallbackURL:   "https://high.example.com/callback",
				Secret:        "high-secret",
				Priority:      9,
			},
		}
		resolved := resolveConsumeCallbackRouting("ima_1", globalURL, globalSecret)
		assert.Equal(t, "https://high.example.com/callback", resolved.callbackURL)
		assert.Equal(t, "high-secret", resolved.secret)
	})
}

func TestBuildEffectiveConsumeCallbackPrefixFilter(t *testing.T) {
	t.Run("global only", func(t *testing.T) {
		got := buildEffectiveConsumeCallbackPrefixFilter("ima_,vip_", nil)
		assert.Equal(t, "ima_,vip_", got)
	})

	t.Run("global + enabled rules", func(t *testing.T) {
		rules := []operation_setting.ConsumeCallbackRoutingRule{
			{Enabled: true, PrefixPattern: "team_,ops_"},
			{Enabled: true, PrefixPattern: "biz_"},
		}
		got := buildEffectiveConsumeCallbackPrefixFilter("ima_", rules)
		assert.Equal(t, "ima_,team_,ops_,biz_", got)
	})

	t.Run("disabled rules ignored", func(t *testing.T) {
		rules := []operation_setting.ConsumeCallbackRoutingRule{
			{Enabled: false, PrefixPattern: "team_"},
		}
		got := buildEffectiveConsumeCallbackPrefixFilter("ima_", rules)
		assert.Equal(t, "ima_", got)
	})

	t.Run("empty all", func(t *testing.T) {
		got := buildEffectiveConsumeCallbackPrefixFilter("", nil)
		assert.Equal(t, "", got)
	})
}
