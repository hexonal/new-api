package common

import "strings"

// StripBearerPrefix removes the Bearer token prefix.
func StripBearerPrefix(token string) string {
	token = strings.TrimSpace(token)
	if len(token) >= 7 && strings.EqualFold(token[:7], "Bearer ") {
		return strings.TrimSpace(token[7:])
	}
	return token
}
