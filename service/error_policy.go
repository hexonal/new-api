package service

import (
	"strings"

	"github.com/QuantumNous/new-api/types"
)

// IsExpectedFallbackError marks non-fatal capability mismatches that should
// trigger downstream fallback but must not affect breaker/auto-ban/alert signals.
func IsExpectedFallbackError(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	return IsExpectedFallbackErrorCode(string(err.GetErrorCode()))
}

func IsExpectedFallbackErrorCode(code string) bool {
	switch strings.TrimSpace(strings.ToLower(code)) {
	case strings.ToLower(string(types.ErrorCodeImageURLNotSupported)):
		return true
	default:
		return false
	}
}

