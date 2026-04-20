package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type submitReadBarrier struct {
	target  int32
	arrived atomic.Int32
	ready   chan struct{}
	release chan struct{}
}

func newSubmitReadBarrier(target int32) *submitReadBarrier {
	return &submitReadBarrier{
		target:  target,
		ready:   make(chan struct{}),
		release: make(chan struct{}),
	}
}

func (b *submitReadBarrier) WaitUntilReady(t *testing.T) {
	t.Helper()
	select {
	case <-b.ready:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for concurrent submit barrier")
	}
}

func (b *submitReadBarrier) Release() {
	close(b.release)
}

func (b *submitReadBarrier) BlockOnce() {
	if b.arrived.Add(1) == b.target {
		close(b.ready)
	}
	<-b.release
}

type blockingReadCloser struct {
	reader  *bytes.Reader
	barrier *submitReadBarrier
	once    sync.Once
}

func newBlockingReadCloser(body []byte, barrier *submitReadBarrier) io.ReadCloser {
	return &blockingReadCloser{
		reader:  bytes.NewReader(body),
		barrier: barrier,
	}
}

func (r *blockingReadCloser) Read(p []byte) (int, error) {
	r.once.Do(func() {
		r.barrier.BlockOnce()
	})
	return r.reader.Read(p)
}

func (r *blockingReadCloser) Close() error {
	return nil
}

func getControllerTestUserQuota(t *testing.T, userID int) int {
	t.Helper()

	var user model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", userID).First(&user).Error)
	return user.Quota
}

func countControllerTestLogs(t *testing.T, userID int) int64 {
	t.Helper()

	var count int64
	require.NoError(t, model.DB.Model(&model.Log{}).Where("user_id = ?", userID).Count(&count).Error)
	return count
}

func submitImageTaskWithCustomBody(
	t *testing.T,
	idempotencyKey string,
	body io.ReadCloser,
	contentLength int64,
) (*httptest.ResponseRecorder, imageTaskSubmitResponseBody, error) {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	request.Body = body
	request.ContentLength = contentLength
	request.Header.Set("Content-Type", "application/json")
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	ctx.Request = request

	common.SetContextKey(ctx, constant.ContextKeyRequestStartTime, time.Now())
	common.SetContextKey(ctx, constant.ContextKeyUserId, 1)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUserQuota, 100000)
	common.SetContextKey(ctx, constant.ContextKeyUserSetting, dto.UserSetting{
		BillingPreference: "wallet_only",
	})
	common.SetContextKey(ctx, constant.ContextKeyTokenId, 1)
	common.SetContextKey(ctx, constant.ContextKeyTokenKey, "sk-image-task")
	common.SetContextKey(ctx, constant.ContextKeyTokenUnlimited, false)
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyChannelId, 1)
	common.SetContextKey(ctx, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(ctx, constant.ContextKeyChannelName, "image-task-channel")
	common.SetContextKey(ctx, constant.ContextKeyChannelKey, "sk-channel")
	common.SetContextKey(ctx, constant.ContextKeyChannelBaseUrl, "https://example.invalid")

	RelayImageTaskSubmit(ctx)

	if recorder.Code != http.StatusOK {
		return recorder, imageTaskSubmitResponseBody{}, fmt.Errorf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	var response imageTaskSubmitResponseBody
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		return recorder, imageTaskSubmitResponseBody{}, err
	}
	return recorder, response, nil
}

func TestImageTaskSubmit_IdempotencyKey_ExpiredTaskStillReturnsExistingTask(t *testing.T) {
	db := setupImageTaskControllerTestDB(t)
	seedImageTaskSubmitFixtures(t, db)

	oldTimestamp := time.Now().Add(-48 * time.Hour).Unix()
	existingTask := &model.Task{
		TaskID:         "task_existing_idempotent",
		UserId:         1,
		Group:          "default",
		ChannelId:      1,
		Platform:       constant.TaskPlatformImage,
		Action:         "generate",
		Status:         model.TaskStatusSuccess,
		IdempotencyKey: "expired-key",
		SubmitTime:     oldTimestamp,
		CreatedAt:      oldTimestamp,
		UpdatedAt:      oldTimestamp,
		Progress:       "100%",
		Quota:          321,
		Properties: model.Properties{
			OriginModelName: "dall-e-3",
		},
		Data: json.RawMessage(`{"data":[{"url":"https://example.com/existing.png"}]}`),
	}
	require.NoError(t, db.Create(existingTask).Error)

	beforeQuota := getControllerTestUserQuota(t, 1)

	_, response := submitImageTaskForControllerTest(t, "expired-key")

	assert.Equal(t, existingTask.TaskID, response.ID)
	assert.Equal(t, existingTask.TaskID, response.TaskID)
	assert.Equal(t, beforeQuota, getControllerTestUserQuota(t, 1))

	var taskCount int64
	require.NoError(t, db.Model(&model.Task{}).
		Where("user_id = ? AND idempotency_key = ?", 1, "expired-key").
		Count(&taskCount).Error)
	assert.EqualValues(t, 1, taskCount)
}

func TestImageTaskSubmit_IdempotencyConcurrentSubmit_OnlyOneCharges(t *testing.T) {
	db := setupImageTaskControllerTestDB(t)
	seedImageTaskSubmitFixtures(t, db)

	const requestBody = `{"model":"dall-e-3","prompt":"concurrent idempotency test"}`
	barrier := newSubmitReadBarrier(2)

	type submitResult struct {
		response imageTaskSubmitResponseBody
		err      error
	}
	resultCh := make(chan submitResult, 2)
	var wg sync.WaitGroup

	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, response, err := submitImageTaskWithCustomBody(
				t,
				"concurrent-key",
				newBlockingReadCloser([]byte(requestBody), barrier),
				int64(len(requestBody)),
			)
			resultCh <- submitResult{response: response, err: err}
		}()
	}

	barrier.WaitUntilReady(t)
	barrier.Release()

	wg.Wait()
	close(resultCh)

	var responses []imageTaskSubmitResponseBody
	for result := range resultCh {
		require.NoError(t, result.err)
		responses = append(responses, result.response)
	}
	require.Len(t, responses, 2)
	assert.Equal(t, responses[0].TaskID, responses[1].TaskID)
	assert.Equal(t, responses[0].ID, responses[1].ID)

	var task model.Task
	require.NoError(t, db.Where("user_id = ? AND idempotency_key = ?", 1, "concurrent-key").First(&task).Error)

	var taskCount int64
	require.NoError(t, db.Model(&model.Task{}).
		Where("user_id = ? AND idempotency_key = ?", 1, "concurrent-key").
		Count(&taskCount).Error)
	assert.EqualValues(t, 1, taskCount)

	assert.Equal(t, 100000-task.Quota, getControllerTestUserQuota(t, 1))
	assert.EqualValues(t, 1, countControllerTestLogs(t, 1))
}

func TestImageTaskFetch_DoesNotLeakInternalFields(t *testing.T) {
	db := setupImageTaskControllerTestDB(t)
	seedImageTaskSubmitFixtures(t, db)

	task := &model.Task{
		TaskID:      "task_image_fetch_public",
		UserId:      1,
		Group:       "default",
		ChannelId:   1,
		Platform:    constant.TaskPlatformImage,
		Quota:       777,
		Action:      "generate",
		Status:      model.TaskStatusSuccess,
		SubmitTime:  time.Now().Add(-time.Minute).Unix(),
		FinishTime:  time.Now().Unix(),
		CreatedAt:   time.Now().Add(-time.Minute).Unix(),
		UpdatedAt:   time.Now().Unix(),
		Progress:    "100%",
		Properties:  model.Properties{OriginModelName: "gpt-image-1"},
		PrivateData: model.TaskPrivateData{ResultURL: "https://example.com/result.png"},
		Data:        json.RawMessage(`{"data":[{"url":"https://example.com/result.png"}]}`),
	}
	require.NoError(t, db.Create(task).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(http.MethodGet, "/v1/images/"+task.TaskID, nil)
	ctx.Request = request
	ctx.Params = gin.Params{{Key: "task_id", Value: task.TaskID}}
	ctx.Set("id", 1)
	common.SetContextKey(ctx, constant.ContextKeyUserId, 1)

	RelayImageTaskFetch(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	body := recorder.Body.String()
	assert.NotContains(t, body, "\"user_id\"")
	assert.NotContains(t, body, "\"channel_id\"")
	assert.NotContains(t, body, "\"quota\"")
	assert.NotContains(t, body, "\"group\"")

	var response map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, task.TaskID, response["id"])
	assert.Equal(t, "image", response["object"])
	assert.Equal(t, "completed", response["status"])
}
