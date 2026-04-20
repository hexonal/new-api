package local_image

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdaptor_DoRequest_ReturnsFakeResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/images/generations",
		strings.NewReader(`{"prompt":"test image"}`),
	)

	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task_public_123",
		},
	}

	resp, err := adaptor.DoRequest(
		ctx,
		info,
		strings.NewReader(`{"prompt":"test image"}`),
	)
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.JSONEq(
		t,
		`{"code":0,"task_id":"local_task_public_123","status":"SUBMITTED"}`,
		string(body),
	)

	storedBody, exists := ctx.Get("image_input_request")
	require.True(t, exists)
	reqBytes, ok := storedBody.([]byte)
	require.True(t, ok)
	assert.JSONEq(t, `{"prompt":"test image"}`, string(reqBytes))
}

func TestAdaptor_DoResponse_ExtractsTaskID(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task_public_456",
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(
			`{"code":0,"task_id":"local_task_public_456","status":"SUBMITTED"}`,
		)),
	}

	taskID, taskData, taskErr := adaptor.DoResponse(nil, resp, info)
	require.Nil(t, taskErr)
	assert.Equal(t, "local_task_public_456", taskID)
	assert.JSONEq(
		t,
		`{"code":0,"task_id":"local_task_public_456","status":"SUBMITTED"}`,
		string(taskData),
	)
}

func TestAdaptor_ParseTaskResult_MapsFields(t *testing.T) {
	adaptor := &TaskAdaptor{}
	respBody, err := common.Marshal(taskResponse{
		Code:    0,
		TaskID:  "local_task_public_789",
		Status:  string(model.TaskStatusSuccess),
		URL:     "https://example.com/result.png",
		Message: "done",
	})
	require.NoError(t, err)

	taskInfo, err := adaptor.ParseTaskResult(respBody)
	require.NoError(t, err)
	require.NotNil(t, taskInfo)
	assert.Equal(t, 0, taskInfo.Code)
	assert.Equal(t, "local_task_public_789", taskInfo.TaskID)
	assert.Equal(t, string(model.TaskStatusSuccess), taskInfo.Status)
	assert.Equal(t, "https://example.com/result.png", taskInfo.Url)
	assert.Equal(t, "done", taskInfo.Reason)
}
