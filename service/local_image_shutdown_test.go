package service

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLocalImageWorkerPool_Shutdown_PreservesInflightUntilCompletion(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 100)

	seedOpenAIChannelForExec(t, 31, "https://example.invalid")
	task := seedLocalImageExecTask(t, 31, 20, `{"model":"dall-e-3","prompt":"slow worker shutdown"}`)
	task.Status = model.TaskStatusSubmitted
	task.WorkerID = ""
	task.HeartbeatAt = 0
	task.Progress = "0%"
	task.Platform = constant.TaskPlatformImage
	require.NoError(t, model.DB.Save(task).Error)

	var attempts int32
	previousFactory := GetChannelAdaptorFunc
	GetChannelAdaptorFunc = func(apiType int) ImageChannelAdaptor {
		require.Equal(t, constant.APITypeOpenAI, apiType)
		return &mockImageChannelAdaptor{
			attempts: &attempts,
			doFunc: func(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
				time.Sleep(5 * time.Second)
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body: io.NopCloser(strings.NewReader(
						`{"created":1,"data":[{"url":"https://example.com/shutdown.png"}]}`,
					)),
				}, nil
			},
		}
	}
	t.Cleanup(func() {
		GetChannelAdaptorFunc = previousFactory
	})

	pool := NewLocalImageWorkerPool()
	pool.workerIDPrefix = "shutdown-test"
	pool.concurrency = 1
	pool.heartbeatSecs = 1
	pool.leaseSecs = 30

	pool.Start(context.Background())

	require.Eventually(t, func() bool {
		var current model.Task
		if err := model.DB.First(&current, task.ID).Error; err != nil {
			return false
		}
		return current.Status == model.TaskStatusInProgress && strings.HasPrefix(current.WorkerID, pool.workerIDPrefix)
	}, 3*time.Second, 50*time.Millisecond)

	shutdownCtx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	require.NoError(t, pool.Shutdown(shutdownCtx))

	var inFlight model.Task
	require.NoError(t, model.DB.First(&inFlight, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusInProgress, inFlight.Status)
	assert.NotEmpty(t, inFlight.WorkerID)

	require.Eventually(t, func() bool {
		var updated model.Task
		if err := model.DB.First(&updated, task.ID).Error; err != nil {
			return false
		}
		return updated.Status == model.TaskStatusSuccess &&
			updated.PrivateData.ResultURL == "http://localhost:3000/v1/videos/"+task.TaskID+"/content"
	}, 7*time.Second, 100*time.Millisecond)

	assert.EqualValues(t, 1, atomic.LoadInt32(&attempts))
}
