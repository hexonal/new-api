package dto

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestImageRequest_MarshalJSON_PreservesExtra(t *testing.T) {
	req := ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "preserve extra fields",
		Extra: map[string]json.RawMessage{
			"custom_param": json.RawMessage(`{"foo":"bar"}`),
			"custom_bool":  json.RawMessage(`false`),
		},
	}

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	require.True(t, gjson.GetBytes(encoded, "custom_param").Exists())
	require.Equal(t, "bar", gjson.GetBytes(encoded, "custom_param.foo").String())
	require.True(t, gjson.GetBytes(encoded, "custom_bool").Exists())
	require.False(t, gjson.GetBytes(encoded, "custom_bool").Bool())

	var decoded ImageRequest
	require.NoError(t, common.Unmarshal(encoded, &decoded))
	require.Contains(t, decoded.Extra, "custom_param")
	require.Contains(t, decoded.Extra, "custom_bool")
	require.JSONEq(t, `{"foo":"bar"}`, string(decoded.Extra["custom_param"]))
	require.JSONEq(t, `false`, string(decoded.Extra["custom_bool"]))
}
