package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type imageTaskSubmitResponseBody struct {
	ID        string `json:"id"`
	TaskID    string `json:"task_id"`
	Status    string `json:"status"`
	CreatedAt int64  `json:"created_at"`
	Model     string `json:"model"`
}

func setupImageTaskControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true
	model.InitColumnNames()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(
		&model.Task{},
		&model.User{},
		&model.Token{},
		&model.Log{},
		&model.Channel{},
		&model.UserSubscription{},
		&model.GenerationRecord{},
	))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func seedImageTaskSubmitFixtures(t *testing.T, db *gorm.DB) {
	t.Helper()

	user := &model.User{
		Id:       1,
		Username: "image-task-user",
		Quota:    100000,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, db.Create(user).Error)

	token := &model.Token{
		Id:          1,
		UserId:      1,
		Key:         "sk-image-task",
		Name:        "image-task-token",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 100000,
		UsedQuota:   0,
		Group:       "default",
	}
	require.NoError(t, db.Create(token).Error)

	baseURL := "https://example.invalid"
	channel := &model.Channel{
		Id:          1,
		Type:        constant.ChannelTypeOpenAI,
		Key:         "sk-channel",
		Name:        "image-task-channel",
		Status:      common.ChannelStatusEnabled,
		BaseURL:     &baseURL,
		CreatedTime: time.Now().Unix(),
	}
	require.NoError(t, db.Create(channel).Error)
}

func submitImageTaskForControllerTest(
	t *testing.T,
	idempotencyKey string,
) (*httptest.ResponseRecorder, imageTaskSubmitResponseBody) {
	return submitImageTaskForControllerTestWithHeaders(t, idempotencyKey, map[string]string{})
}

func submitImageTaskForControllerTestWithHeaders(
	t *testing.T,
	idempotencyKey string,
	headers map[string]string,
) (*httptest.ResponseRecorder, imageTaskSubmitResponseBody) {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/images/generations",
		strings.NewReader(`{"model":"dall-e-3","prompt":"idempotency test image"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	for key, value := range headers {
		request.Header.Set(key, value)
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
	for key, value := range headers {
		ctx.Set(key, value)
	}

	RelayImageTaskSubmit(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var response imageTaskSubmitResponseBody
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response), recorder.Body.String())
	return recorder, response
}

func TestImageTaskSubmit_IdempotencyKey_ReturnsSameTask(t *testing.T) {
	db := setupImageTaskControllerTestDB(t)
	seedImageTaskSubmitFixtures(t, db)

	_, first := submitImageTaskForControllerTest(t, "same-key")
	_, second := submitImageTaskForControllerTest(t, "same-key")
	_, other := submitImageTaskForControllerTest(t, "other-key")
	_, withoutHeaderA := submitImageTaskForControllerTest(t, "")
	_, withoutHeaderB := submitImageTaskForControllerTest(t, "")

	assert.NotEmpty(t, first.ID)
	assert.Equal(t, first.ID, second.ID)
	assert.Equal(t, first.TaskID, second.TaskID)
	assert.NotEqual(t, first.ID, other.ID)
	assert.NotEqual(t, withoutHeaderA.ID, withoutHeaderB.ID)

	var sameKeyCount int64
	require.NoError(t, db.Model(&model.Task{}).Where("user_id = ? AND idempotency_key = ?", 1, "same-key").Count(&sameKeyCount).Error)
	assert.EqualValues(t, 1, sameKeyCount)
}

func TestImageTaskSubmit_PersistsSubmittedStatus(t *testing.T) {
	db := setupImageTaskControllerTestDB(t)
	seedImageTaskSubmitFixtures(t, db)

	_, response := submitImageTaskForControllerTest(t, "submitted-key")

	var task model.Task
	require.NoError(t, db.Where("task_id = ?", response.TaskID).First(&task).Error)
	assert.EqualValues(t, model.TaskStatusSubmitted, task.Status)
	assert.Equal(t, "10%", task.Progress)
}

func TestImageTaskSubmit_PersistsImageAction(t *testing.T) {
	db := setupImageTaskControllerTestDB(t)
	seedImageTaskSubmitFixtures(t, db)

	_, response := submitImageTaskForControllerTest(t, "image-action-key")

	var task model.Task
	require.NoError(t, db.Where("task_id = ?", response.TaskID).First(&task).Error)
	assert.Equal(t, constant.TaskActionImageGenerate, task.Action)
}

func TestImageTaskSubmit_PersistsConsumeCallbackMetadata(t *testing.T) {
	db := setupImageTaskControllerTestDB(t)
	seedImageTaskSubmitFixtures(t, db)

	headers := map[string]string{
		"x-app-id":  "vid-craft",
		"x-env":     "dev",
		"x-user-id": "30",
	}

	_, response := submitImageTaskForControllerTestWithHeaders(t, "callback-meta-key", headers)

	var task model.Task
	require.NoError(t, db.Where("task_id = ?", response.TaskID).First(&task).Error)
	assert.Equal(t, "vid-craft", task.PrivateData.AppID)
	assert.Equal(t, "dev", task.PrivateData.Env)
	assert.Equal(t, "30", task.PrivateData.BusinessUserID)
}

func TestImageTaskFetch_NotStartReturnsQueuedStatus(t *testing.T) {
	db := setupImageTaskControllerTestDB(t)
	seedImageTaskSubmitFixtures(t, db)

	task := &model.Task{
		TaskID:     "task_image_fetch_not_start",
		UserId:     1,
		Group:      "default",
		ChannelId:  1,
		Platform:   constant.TaskPlatformImage,
		Status:     model.TaskStatusNotStart,
		SubmitTime: time.Now().Unix(),
		CreatedAt:  time.Now().Unix(),
		UpdatedAt:  time.Now().Unix(),
		Progress:   "0%",
		Properties: model.Properties{OriginModelName: "gpt-image-1"},
	}
	require.NoError(t, db.Create(task).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/images/"+task.TaskID, nil)
	ctx.Params = gin.Params{{Key: "task_id", Value: task.TaskID}}
	ctx.Set("id", 1)
	common.SetContextKey(ctx, constant.ContextKeyUserId, 1)

	RelayImageTaskFetch(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	var response map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, "queued", response["status"])
}
