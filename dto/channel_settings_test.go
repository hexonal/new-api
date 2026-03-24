package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestChannelOtherSettingsUnmarshalLegacyJSON(t *testing.T) {
	raw := []byte(`{"azure_responses_version":"2024-10-21","allow_service_tier":true}`)

	var settings ChannelOtherSettings
	err := common.Unmarshal(raw, &settings)
	require.NoError(t, err)

	require.Equal(t, "2024-10-21", settings.AzureResponsesVersion)
	require.True(t, settings.AllowServiceTier)
	require.Nil(t, settings.CallErrorAlertEnabled)
	require.Nil(t, settings.CallErrorThresholdCount)
	require.Nil(t, settings.CallErrorThresholdWindowMinutes)
	require.Nil(t, settings.CallErrorCooldownMinutes)
}

func TestChannelOtherSettingsUnmarshalCallErrorAlertFields(t *testing.T) {
	raw := []byte(`{
		"call_error_alert_enabled": true,
		"call_error_threshold_count": 5,
		"call_error_threshold_window_minutes": 15,
		"call_error_cooldown_minutes": 30
	}`)

	var settings ChannelOtherSettings
	err := common.Unmarshal(raw, &settings)
	require.NoError(t, err)

	require.NotNil(t, settings.CallErrorAlertEnabled)
	require.True(t, *settings.CallErrorAlertEnabled)
	require.NotNil(t, settings.CallErrorThresholdCount)
	require.Equal(t, 5, *settings.CallErrorThresholdCount)
	require.NotNil(t, settings.CallErrorThresholdWindowMinutes)
	require.Equal(t, 15, *settings.CallErrorThresholdWindowMinutes)
	require.NotNil(t, settings.CallErrorCooldownMinutes)
	require.Equal(t, 30, *settings.CallErrorCooldownMinutes)
}

func TestChannelOtherSettingsUnmarshalBreakerFields(t *testing.T) {
	raw := []byte(`{
		"breaker_enabled": true,
		"breaker_threshold_count": 3,
		"breaker_window_seconds": 45,
		"breaker_cooldown_seconds": 120,
		"breaker_half_open_probe_count": 2,
		"breaker_recovery_success_count": 2,
		"breaker_error_types": ["429", "5xx"]
	}`)

	var settings ChannelOtherSettings
	err := common.Unmarshal(raw, &settings)
	require.NoError(t, err)

	require.True(t, settings.BreakerEnabled)
	require.Equal(t, 3, settings.BreakerThresholdCount)
	require.Equal(t, 45, settings.BreakerWindowSeconds)
	require.Equal(t, 120, settings.BreakerCooldownSeconds)
	require.Equal(t, 2, settings.BreakerHalfOpenProbeCount)
	require.Equal(t, 2, settings.BreakerRecoverySuccessCount)
	require.Equal(t, []string{"429", "5xx"}, settings.BreakerErrorTypes)
}

func TestChannelOtherSettingsGetBreakerConfigDefaultsAndNormalization(t *testing.T) {
	settings := ChannelOtherSettings{
		BreakerEnabled:    true,
		BreakerErrorTypes: []string{"429", "5xx", "429", "unknown", ""},
	}

	cfg := settings.GetBreakerConfig()

	require.True(t, cfg.Enabled)
	require.Equal(t, 10, cfg.ThresholdCount)
	require.Equal(t, 60, cfg.WindowSeconds)
	require.Equal(t, 300, cfg.CooldownSeconds)
	require.Equal(t, 1, cfg.HalfOpenProbeCount)
	require.Equal(t, 1, cfg.RecoverySuccessCount)
	require.Equal(t, []string{"429", "5xx"}, cfg.ErrorTypes)
}
