package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/model_capability"
	"github.com/stretchr/testify/require"
)

func TestModelGetParsedParameters(t *testing.T) {
	raw, err := common.Marshal(map[string]model_capability.ModelParameterDef{
		"temperature": {
			Type:        "number",
			Description: "Sampling temperature.",
			Default:     0.7,
		},
	})
	require.NoError(t, err)

	m := &Model{Parameters: string(raw)}
	parsed := m.GetParsedParameters()

	require.Len(t, parsed, 1)
	require.Equal(t, "number", parsed["temperature"].Type)
	require.Equal(t, 0.7, parsed["temperature"].Default)
}

func TestModelGetParsedParametersInvalidJSON(t *testing.T) {
	m := &Model{Parameters: "{"}
	require.Empty(t, m.GetParsedParameters())
}
