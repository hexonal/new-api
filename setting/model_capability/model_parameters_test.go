package model_capability

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetDefaultParametersForGPTModel(t *testing.T) {
	params := GetDefaultParameters("gpt-4o")

	require.Contains(t, params, "temperature")
	require.Contains(t, params, "max_tokens")
	require.Contains(t, params, "tools")
	require.Contains(t, params, "response_format")
	require.Contains(t, params, "vision")
	require.Contains(t, params, "stream")

	temperature := params["temperature"]
	require.Equal(t, "number", temperature.Type)
	require.NotNil(t, temperature.Min)
	require.NotNil(t, temperature.Max)
	require.Equal(t, 0.0, *temperature.Min)
	require.Equal(t, 2.0, *temperature.Max)
}

func TestGetDefaultParametersReturnsIndependentCopy(t *testing.T) {
	first := GetDefaultParameters("dall-e-3")
	first["size"] = ModelParameterDef{Type: "string", Enum: []string{"custom"}}

	second := GetDefaultParameters("dall-e-3")
	require.Equal(t, []string{"1024x1024", "1792x1024", "1024x1792"}, second["size"].Enum)
}

func TestGetDefaultParametersUnknownModel(t *testing.T) {
	require.Empty(t, GetDefaultParameters("unknown-model"))
}

func TestGetDefaultParametersForKlingModel(t *testing.T) {
	params := GetDefaultParameters("kling-v2-master")

	require.Contains(t, params, "duration")
	require.Contains(t, params, "size")
	require.Contains(t, params, "mode")
}

func TestGetDefaultParametersForJimengModel(t *testing.T) {
	params := GetDefaultParameters("jimeng_high_aes_general_v21_L")

	require.Contains(t, params, "response_format")
	require.Contains(t, params, "width")
	require.Contains(t, params, "height")
}

func TestMergeParametersOverrideWins(t *testing.T) {
	baseMin := 0.0
	baseMax := 2.0
	base := map[string]ModelParameterDef{
		"temperature": {
			Type:    "number",
			Min:     &baseMin,
			Max:     &baseMax,
			Default: 1.0,
		},
		"stream": {Type: "boolean", Default: false},
	}
	override := map[string]ModelParameterDef{
		"temperature": {Type: "number", Default: 0.3},
		"custom":      {Type: "string", Enum: []string{"fast", "safe"}},
	}

	merged := MergeParameters(base, override)

	require.Equal(t, 0.3, merged["temperature"].Default)
	require.Contains(t, merged, "stream")
	require.Contains(t, merged, "custom")
	require.Equal(t, 1.0, base["temperature"].Default)
}
