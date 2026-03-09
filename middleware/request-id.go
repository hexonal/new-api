package middleware

import (
	"context"
	"strings"
	"unicode"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const (
	maxTraceIDLength = 128
)

func isAllowedTraceIDChar(r rune) bool {
	if unicode.IsLetter(r) || unicode.IsDigit(r) {
		return true
	}
	switch r {
	case '-', '_', '.', ':', '/':
		return true
	default:
		return false
	}
}

func normalizeTraceID(raw string) string {
	traceID := strings.TrimSpace(raw)
	if traceID == "" || len(traceID) > maxTraceIDLength {
		return ""
	}
	for _, r := range traceID {
		if !isAllowedTraceIDChar(r) {
			return ""
		}
	}
	return traceID
}

func RequestId() func(c *gin.Context) {
	return func(c *gin.Context) {
		id := normalizeTraceID(c.GetHeader(common.TraceIdKey))
		if id == "" {
			id = common.GetTimeString() + common.GetRandomString(8)
		}
		c.Set(common.RequestIdKey, id)
		c.Set(common.TraceIdKey, id)
		ctx := context.WithValue(c.Request.Context(), common.RequestIdKey, id)
		ctx = context.WithValue(ctx, common.TraceIdKey, id)
		c.Request = c.Request.WithContext(ctx)
		c.Request.Header.Set(common.TraceIdKey, id)
		c.Header(common.RequestIdKey, id)
		c.Header(common.TraceIdKey, id)
		c.Next()
	}
}
