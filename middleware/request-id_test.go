package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRequestID_UseIncomingTraceID(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/health", nil)
	ctx.Request.Header.Set(common.TraceIdKey, "trace-abc-001")

	handler := RequestId()
	handler(ctx)

	require.Equal(t, "trace-abc-001", ctx.GetString(common.RequestIdKey))
	require.Equal(t, "trace-abc-001", recorder.Header().Get(common.RequestIdKey))
	require.Equal(t, "trace-abc-001", recorder.Header().Get(common.TraceIdKey))
	require.Equal(t, "trace-abc-001", ctx.Request.Header.Get(common.TraceIdKey))
}

func TestRequestID_InvalidTraceIDFallback(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/health", nil)
	ctx.Request.Header.Set(common.TraceIdKey, "bad trace with spaces")

	handler := RequestId()
	handler(ctx)

	id := ctx.GetString(common.RequestIdKey)
	require.NotEmpty(t, id)
	require.NotEqual(t, "bad trace with spaces", id)
	require.Equal(t, id, recorder.Header().Get(common.RequestIdKey))
	require.Equal(t, id, recorder.Header().Get(common.TraceIdKey))
}

func TestRequestID_NoTraceIDFallback(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/health", nil)

	handler := RequestId()
	handler(ctx)

	id := ctx.GetString(common.RequestIdKey)
	require.NotEmpty(t, id)
	require.Equal(t, id, recorder.Header().Get(common.RequestIdKey))
	require.Equal(t, id, recorder.Header().Get(common.TraceIdKey))
}
