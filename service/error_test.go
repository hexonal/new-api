package service

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestResetStatusCode(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name             string
		statusCode       int
		statusCodeConfig string
		expectedCode     int
	}{
		{
			name:             "map string value",
			statusCode:       429,
			statusCodeConfig: `{"429":"503"}`,
			expectedCode:     503,
		},
		{
			name:             "map int value",
			statusCode:       429,
			statusCodeConfig: `{"429":503}`,
			expectedCode:     503,
		},
		{
			name:             "skip invalid string value",
			statusCode:       429,
			statusCodeConfig: `{"429":"bad-code"}`,
			expectedCode:     429,
		},
		{
			name:             "skip status code 200",
			statusCode:       200,
			statusCodeConfig: `{"200":503}`,
			expectedCode:     200,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			newAPIError := &types.NewAPIError{
				StatusCode: tc.statusCode,
			}
			ResetStatusCode(newAPIError, tc.statusCodeConfig)
			require.Equal(t, tc.expectedCode, newAPIError.StatusCode)
		})
	}
}

func TestIsExpectedFallbackError(t *testing.T) {
	t.Parallel()

	err := types.NewErrorWithStatusCode(
		errors.New("image url is not supported by current channel and auto base64 conversion is disabled"),
		types.ErrorCodeImageURLNotSupported,
		422,
	)
	require.True(t, IsExpectedFallbackError(err))
	require.True(t, IsExpectedFallbackErrorCode("image_url_not_supported"))
	require.False(t, IsExpectedFallbackErrorCode("bad_response_status_code"))
}

func TestShouldDisableChannelSkipsExpectedFallbackError(t *testing.T) {
	originDisableRanges := operation_setting.AutomaticDisableStatusCodeRanges
	operation_setting.AutomaticDisableStatusCodeRanges = []operation_setting.StatusCodeRange{{Start: 422, End: 422}}
	defer func() {
		operation_setting.AutomaticDisableStatusCodeRanges = originDisableRanges
	}()

	err := types.NewErrorWithStatusCode(
		errors.New("image url is not supported by current channel and auto base64 conversion is disabled"),
		types.ErrorCodeImageURLNotSupported,
		422,
	)

	require.False(t, ShouldDisableChannel(0, err))
}
