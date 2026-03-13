package common

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newTaskTestContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx
}

func TestValidateMultipartDirect_AllowPromptlessImaProWithReferenceMedia(t *testing.T) {
	ctx := newTaskTestContext(`{
		"model":"ima-pro",
		"images":["https://example.com/a.jpg"],
		"duration":10
	}`)
	info := &RelayInfo{TaskRelayInfo: &TaskRelayInfo{}}

	taskErr := ValidateMultipartDirect(ctx, info)
	require.Nil(t, taskErr)
	require.Equal(t, constant.TaskActionGenerate, info.Action)

	req, err := GetTaskRequest(ctx)
	require.NoError(t, err)
	require.Equal(t, "ima-pro", req.Model)
	require.Empty(t, req.Prompt)
}

func TestValidateMultipartDirect_AllowPromptlessImaProFastWithReferenceMetadata(t *testing.T) {
	ctx := newTaskTestContext(`{
		"model":"ima-pro-fast",
		"duration":10,
		"metadata":{"reference_video_urls":["https://example.com/v.mp4"]}
	}`)
	info := &RelayInfo{TaskRelayInfo: &TaskRelayInfo{}}

	taskErr := ValidateMultipartDirect(ctx, info)
	require.Nil(t, taskErr)
	require.Equal(t, constant.TaskActionGenerate, info.Action)
}

func TestValidateMultipartDirect_KeepPromptRequiredForGenericModel(t *testing.T) {
	ctx := newTaskTestContext(`{
		"model":"kling-v1",
		"images":["https://example.com/a.jpg"],
		"duration":10
	}`)
	info := &RelayInfo{TaskRelayInfo: &TaskRelayInfo{}}

	taskErr := ValidateMultipartDirect(ctx, info)
	require.NotNil(t, taskErr)
	require.Equal(t, "invalid_request", taskErr.Code)
	require.Equal(t, "prompt is required", taskErr.Message)
}

func TestValidateMultipartDirect_ImaProWithoutPromptAndWithoutReferenceStillFails(t *testing.T) {
	ctx := newTaskTestContext(`{
		"model":"ima-pro",
		"duration":10
	}`)
	info := &RelayInfo{TaskRelayInfo: &TaskRelayInfo{}}

	taskErr := ValidateMultipartDirect(ctx, info)
	require.NotNil(t, taskErr)
	require.Equal(t, "invalid_request", taskErr.Code)
	require.Equal(t, "prompt is required", taskErr.Message)
}
