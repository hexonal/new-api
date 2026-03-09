package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestShouldRetryCallback(t *testing.T) {
	testCases := []struct {
		name       string
		statusCode int
		err        error
		expected   bool
	}{
		{
			name:       "network error",
			statusCode: 0,
			err:        errors.New("dial tcp: no such host"),
			expected:   true,
		},
		{
			name:       "http 404",
			statusCode: http.StatusNotFound,
			err:        nil,
			expected:   true,
		},
		{
			name:       "http 500",
			statusCode: http.StatusInternalServerError,
			err:        nil,
			expected:   true,
		},
		{
			name:       "http 200",
			statusCode: http.StatusOK,
			err:        nil,
			expected:   false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, shouldRetryCallback(tc.statusCode, tc.err))
		})
	}
}

func TestBuildCallbackErrorMessage(t *testing.T) {
	assert.Equal(
		t,
		"callback status=404, body: not found",
		buildCallbackErrorMessage(nil, http.StatusNotFound, "  not found  "),
	)

	assert.Equal(
		t,
		"callback status=404",
		buildCallbackErrorMessage(nil, http.StatusNotFound, "   "),
	)

	netErr := errors.New("dial tcp timeout")
	assert.Equal(
		t,
		netErr.Error(),
		buildCallbackErrorMessage(netErr, 0, ""),
	)
}
