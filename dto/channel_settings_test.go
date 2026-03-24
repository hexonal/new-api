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
