package model_capability

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUpdateModelNSFWByJSONString(t *testing.T) {
	t.Cleanup(func() {
		require.NoError(t, UpdateModelNSFWByJSONString(""))
	})

	err := UpdateModelNSFWByJSONString(`{"K2.6":true," bad ":"x","":true,"safe-model":false}`)
	require.NoError(t, err)

	value, ok := GetModelNSFW("k2.6")
	require.True(t, ok)
	require.True(t, value)

	value, ok = GetModelNSFW("SAFE-MODEL")
	require.True(t, ok)
	require.False(t, value)

	_, ok = GetModelNSFW("bad")
	require.False(t, ok)
}

func TestUpdateModelNSFWByJSONStringEmptyResetsState(t *testing.T) {
	require.NoError(t, UpdateModelNSFWByJSONString(`{"k2.6":true}`))
	require.NoError(t, UpdateModelNSFWByJSONString(""))

	_, ok := GetModelNSFW("k2.6")
	require.False(t, ok)
}
