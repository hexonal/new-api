package service_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/archiver"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type e2eImageAdaptor struct {
	doRequest func(requestBody io.Reader) (any, error)
}

type testArchiverDownloader struct{}

func (d *testArchiverDownloader) Fetch(
	_ context.Context,
	src archiver.Source,
	_ int64,
) (archiver.Blob, error) {
	return archiver.Blob{
		Data:     append([]byte(nil), src.Bytes...),
		MimeType: "image/png",
	}, nil
}

type testArchiverUploader struct{}

func (u *testArchiverUploader) Upload(
	_ context.Context,
	_ string,
	_ archiver.Blob,
) (string, error) {
	return "https://archive.example/input.png", nil
}

func (a *e2eImageAdaptor) Init(_ *relaycommon.RelayInfo) {}

func (a *e2eImageAdaptor) ConvertImageRequest(
	_ *gin.Context,
	_ *relaycommon.RelayInfo,
	request dto.ImageRequest,
) (any, error) {
	return request, nil
}

func (a *e2eImageAdaptor) DoRequest(
	_ *gin.Context,
	_ *relaycommon.RelayInfo,
	requestBody io.Reader,
) (any, error) {
	return a.doRequest(requestBody)
}

func truncateAll(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM generation_records")
		model.DB.Exec("DELETE FROM tasks")
		model.DB.Exec("DELETE FROM users")
		model.DB.Exec("DELETE FROM tokens")
		model.DB.Exec("DELETE FROM logs")
		model.DB.Exec("DELETE FROM channels")
		model.DB.Exec("DELETE FROM user_subscriptions")
	})
}

func seedUserRecord(t *testing.T, id int, quota int) {
	t.Helper()
	user := &model.User{
		Id:       id,
		Username: "e2e_user",
		Quota:    quota,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, model.DB.Create(user).Error)
}

func seedTokenRecord(t *testing.T, id int, userID int, key string, remainQuota int) {
	t.Helper()
	token := &model.Token{
		Id:          id,
		UserId:      userID,
		Key:         key,
		Name:        "e2e_token",
		Status:      common.TokenStatusEnabled,
		RemainQuota: remainQuota,
		UsedQuota:   0,
	}
	require.NoError(t, model.DB.Create(token).Error)
}

func seedOpenAIChannelRecord(t *testing.T, id int, key string) {
	t.Helper()
	baseURL := "https://example.invalid"
	channel := &model.Channel{
		Id:          id,
		Type:        constant.ChannelTypeOpenAI,
		Key:         key,
		Name:        "e2e-openai",
		Status:      common.ChannelStatusEnabled,
		BaseURL:     &baseURL,
		CreatedTime: time.Now().Unix(),
	}
	require.NoError(t, model.DB.Create(channel).Error)
}

func getUserQuotaForTest(t *testing.T, id int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", id).First(&user).Error)
	return user.Quota
}

func getUserUsedQuotaForTest(t *testing.T, id int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", id).First(&user).Error)
	return user.UsedQuota
}

func getTokenRemainQuotaForTest(t *testing.T, id int) int {
	t.Helper()
	var token model.Token
	require.NoError(t, model.DB.Select("remain_quota").Where("id = ?", id).First(&token).Error)
	return token.RemainQuota
}

func getChannelUsedQuotaForTest(t *testing.T, id int) int64 {
	t.Helper()
	var ch model.Channel
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", id).First(&ch).Error)
	return ch.UsedQuota
}

func getGenerationRecordByTaskID(t *testing.T, taskID string) model.GenerationRecord {
	t.Helper()
	var record model.GenerationRecord
	require.NoError(t, model.DB.Where("external_task_id = ?", taskID).First(&record).Error)
	return record
}

func submitImageTask(
	t *testing.T,
	body string,
	userQuota int,
	tokenKey string,
) *model.Task {
	t.Helper()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	ctx.Request = request

	common.SetContextKey(ctx, constant.ContextKeyRequestStartTime, time.Now())
	common.SetContextKey(ctx, constant.ContextKeyUserId, 1)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUserQuota, userQuota)
	common.SetContextKey(ctx, constant.ContextKeyUserSetting, dto.UserSetting{
		BillingPreference: "wallet_only",
	})
	common.SetContextKey(ctx, constant.ContextKeyTokenId, 1)
	common.SetContextKey(ctx, constant.ContextKeyTokenKey, tokenKey)
	common.SetContextKey(ctx, constant.ContextKeyTokenUnlimited, false)
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyChannelId, 1)
	common.SetContextKey(ctx, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(ctx, constant.ContextKeyChannelName, "e2e-openai")
	common.SetContextKey(ctx, constant.ContextKeyChannelKey, "sk-channel")
	common.SetContextKey(ctx, constant.ContextKeyChannelBaseUrl, "https://example.invalid")

	controller.RelayImageTaskSubmit(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	var task model.Task
	require.NoError(t, model.DB.Order("id DESC").First(&task).Error)
	return &task
}

func submitImageTaskMultipart(
	t *testing.T,
	fields map[string]string,
	imageName string,
	imageBytes []byte,
	maskName string,
	maskBytes []byte,
	userQuota int,
	tokenKey string,
) *model.Task {
	t.Helper()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		require.NoError(t, writer.WriteField(key, value))
	}
	part, err := writer.CreateFormFile("image", imageName)
	require.NoError(t, err)
	_, err = part.Write(imageBytes)
	require.NoError(t, err)
	if len(maskBytes) > 0 {
		maskPart, maskErr := writer.CreateFormFile("mask", maskName)
		require.NoError(t, maskErr)
		_, maskErr = maskPart.Write(maskBytes)
		require.NoError(t, maskErr)
	}
	require.NoError(t, writer.Close())

	request := httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body.Bytes()))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request = request

	common.SetContextKey(ctx, constant.ContextKeyRequestStartTime, time.Now())
	common.SetContextKey(ctx, constant.ContextKeyUserId, 1)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUserQuota, userQuota)
	common.SetContextKey(ctx, constant.ContextKeyUserSetting, dto.UserSetting{
		BillingPreference: "wallet_only",
	})
	common.SetContextKey(ctx, constant.ContextKeyTokenId, 1)
	common.SetContextKey(ctx, constant.ContextKeyTokenKey, tokenKey)
	common.SetContextKey(ctx, constant.ContextKeyTokenUnlimited, false)
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyChannelId, 1)
	common.SetContextKey(ctx, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(ctx, constant.ContextKeyChannelName, "e2e-openai")
	common.SetContextKey(ctx, constant.ContextKeyChannelKey, "sk-channel")
	common.SetContextKey(ctx, constant.ContextKeyChannelBaseUrl, "https://example.invalid")

	controller.RelayImageTaskSubmit(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	var task model.Task
	require.NoError(t, model.DB.Order("id DESC").First(&task).Error)
	return &task
}

func loadTaskPrivateDataMap(t *testing.T, taskID int64) map[string]any {
	t.Helper()

	var raw string
	require.NoError(t, model.DB.Raw("SELECT private_data FROM tasks WHERE id = ?", taskID).Scan(&raw).Error)

	result := make(map[string]any)
	require.NoError(t, common.Unmarshal([]byte(raw), &result))
	return result
}

func decodeTinyPNGForE2E(t *testing.T) []byte {
	t.Helper()

	imageBytes, err := base64.StdEncoding.DecodeString(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0XkAAAAASUVORK5CYII=",
	)
	require.NoError(t, err)
	return imageBytes
}

func claimTaskForWorker(t *testing.T, taskID int64, workerID string) *model.Task {
	t.Helper()

	require.NoError(t, model.DB.Model(&model.Task{}).
		Where("id = ?", taskID).
		Updates(map[string]any{
			"status":       model.TaskStatusInProgress,
			"worker_id":    workerID,
			"heartbeat_at": time.Now().Unix(),
		}).Error)

	var task model.Task
	require.NoError(t, model.DB.First(&task, taskID).Error)
	return &task
}

func expectedImageQuota(t *testing.T, imageReq *dto.ImageRequest) int {
	t.Helper()

	price, ok := ratio_setting.GetModelPrice(imageReq.Model, true)
	if !ok {
		price, ok = ratio_setting.GetDefaultModelPriceMap()[imageReq.Model]
	}
	require.True(t, ok)
	meta := imageReq.GetTokenCountMeta()
	require.NotNil(t, meta)
	return int(price * meta.ImagePriceRatio * common.QuotaPerUnit)
}

func TestE2E_ImageTaskBilling_SuccessSettles(t *testing.T) {
	truncateAll(t)
	previousEnabled := common.GenerationRecordEnabled.Load()
	common.GenerationRecordEnabled.Store(true)
	t.Cleanup(func() {
		common.GenerationRecordEnabled.Store(previousEnabled)
	})

	const (
		userQuota = 100000
		tokenKey  = "sk-e2e-success"
		workerID  = "e2e-worker-success"
	)

	imageReq := &dto.ImageRequest{
		Model:   "dall-e-3",
		Prompt:  "test success",
		Size:    "1792x1024",
		Quality: "hd",
		N:       common.GetPointer(uint(1)),
	}
	bodyBytes, err := common.Marshal(imageReq)
	require.NoError(t, err)

	seedUserRecord(t, 1, userQuota)
	seedTokenRecord(t, 1, 1, tokenKey, userQuota)
	seedOpenAIChannelRecord(t, 1, "sk-channel")

	submitted := submitImageTask(t, string(bodyBytes), userQuota, tokenKey)
	expectedQuota := expectedImageQuota(t, imageReq)
	privateData := loadTaskPrivateDataMap(t, submitted.ID)

	assert.Equal(t, expectedQuota, submitted.Quota)
	assert.Equal(t, imageReq.Model, submitted.Properties.OriginModelName)
	require.NotNil(t, submitted.PrivateData.BillingContext)
	assert.Equal(t, imageReq.Model, submitted.PrivateData.BillingContext.OriginModelName)
	assert.Equal(t, "generations", privateData["image_task_mode"])
	assert.NotEmpty(t, privateData["upstream_idempotency_key"])
	assert.Equal(t, userQuota-expectedQuota, getUserQuotaForTest(t, 1))
	assert.Equal(t, userQuota-expectedQuota, getTokenRemainQuotaForTest(t, 1))

	task := claimTaskForWorker(t, submitted.ID, workerID)

	previousFactory := service.GetChannelAdaptorFunc
	service.GetChannelAdaptorFunc = func(apiType int) service.ImageChannelAdaptor {
		require.Equal(t, constant.APITypeOpenAI, apiType)
		return &e2eImageAdaptor{
			doRequest: func(_ io.Reader) (any, error) {
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body: io.NopCloser(strings.NewReader(
						`{"created":1234,"data":[{"url":"https://result.example/img.png"}]}`,
					)),
				}, nil
			},
		}
	}
	t.Cleanup(func() {
		service.GetChannelAdaptorFunc = previousFactory
	})

	err = service.ExecuteLocalImageTask(context.Background(), workerID, task)
	require.NoError(t, err)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, submitted.ID).Error)
	assert.EqualValues(t, model.TaskStatusSuccess, updated.Status)
	assert.Equal(t, "https://result.example/img.png", updated.PrivateData.ResultURL)
	record := getGenerationRecordByTaskID(t, submitted.TaskID)
	assert.Equal(t, model.GenerationKindImage, record.Kind)
	assert.Equal(t, model.GenerationStatusSuccess, record.Status)
	assert.Equal(t, expectedQuota, record.Quota)
	assert.Equal(t, userQuota-expectedQuota, getUserQuotaForTest(t, 1))
	assert.Equal(t, userQuota-expectedQuota, getTokenRemainQuotaForTest(t, 1))
	assert.Equal(t, expectedQuota, getUserUsedQuotaForTest(t, 1))
	assert.EqualValues(t, expectedQuota, getChannelUsedQuotaForTest(t, 1))
}

func TestE2E_ImageTaskBilling_SubmitEditsPersistsReplayFields(t *testing.T) {
	truncateAll(t)

	const (
		userQuota = 100000
		tokenKey  = "sk-e2e-edits"
	)

	seedUserRecord(t, 1, userQuota)
	seedTokenRecord(t, 1, 1, tokenKey, userQuota)
	seedOpenAIChannelRecord(t, 1, "sk-channel")
	archiver.SetDefaultForTest(archiver.New(
		&testArchiverDownloader{},
		&testArchiverUploader{},
		1<<20,
		"test",
	))
	t.Cleanup(func() {
		archiver.ResetDefaultForTest()
	})

	submitted := submitImageTaskMultipart(
		t,
		map[string]string{
			"model":   "dall-e-3",
			"prompt":  "add a red border",
			"n":       "2",
			"size":    "1024x1024",
			"quality": "hd",
		},
		"input.png",
		decodeTinyPNGForE2E(t),
		"",
		nil,
		userQuota,
		tokenKey,
	)

	privateData := loadTaskPrivateDataMap(t, submitted.ID)
	assert.Equal(t, "edits", privateData["image_task_mode"])
	assert.NotEmpty(t, privateData["input_image_url"])
	assert.NotEmpty(t, privateData["upstream_idempotency_key"])

	inputRequestRaw, ok := privateData["input_request"].(string)
	require.True(t, ok)

	var imageReq dto.ImageRequest
	require.NoError(t, common.Unmarshal([]byte(inputRequestRaw), &imageReq))
	assert.Equal(t, "dall-e-3", imageReq.Model)
	assert.Equal(t, "add a red border", imageReq.Prompt)
	require.NotNil(t, imageReq.N)
	assert.EqualValues(t, 2, *imageReq.N)
	assert.Empty(t, imageReq.Image)
}

func TestE2E_ImageTaskBilling_SubmitEditsPersistsMaskReplayField(t *testing.T) {
	truncateAll(t)

	const (
		userQuota = 100000
		tokenKey  = "sk-e2e-edits-mask"
	)

	seedUserRecord(t, 1, userQuota)
	seedTokenRecord(t, 1, 1, tokenKey, userQuota)
	seedOpenAIChannelRecord(t, 1, "sk-channel")
	archiver.SetDefaultForTest(archiver.New(
		&testArchiverDownloader{},
		&testArchiverUploader{},
		1<<20,
		"test",
	))
	t.Cleanup(func() {
		archiver.ResetDefaultForTest()
	})

	imageBytes := decodeTinyPNGForE2E(t)
	maskBytes := decodeTinyPNGForE2E(t)
	submitted := submitImageTaskMultipart(
		t,
		map[string]string{
			"model":  "dall-e-3",
			"prompt": "mask me",
		},
		"input.png",
		imageBytes,
		"mask.png",
		maskBytes,
		userQuota,
		tokenKey,
	)

	privateData := loadTaskPrivateDataMap(t, submitted.ID)
	assert.NotEmpty(t, privateData["input_image_url"])
	assert.NotEmpty(t, privateData["input_mask_url"])
}

func TestE2E_ImageTaskBilling_FailureRefunds(t *testing.T) {
	truncateAll(t)
	previousEnabled := common.GenerationRecordEnabled.Load()
	common.GenerationRecordEnabled.Store(true)
	t.Cleanup(func() {
		common.GenerationRecordEnabled.Store(previousEnabled)
	})

	const (
		userQuota = 100000
		tokenKey  = "sk-e2e-failure"
		workerID  = "e2e-worker-failure"
	)

	imageReq := &dto.ImageRequest{
		Model:   "dall-e-3",
		Prompt:  "test failure",
		Size:    "1792x1024",
		Quality: "hd",
		N:       common.GetPointer(uint(1)),
	}
	bodyBytes, err := common.Marshal(imageReq)
	require.NoError(t, err)

	seedUserRecord(t, 1, userQuota)
	seedTokenRecord(t, 1, 1, tokenKey, userQuota)
	seedOpenAIChannelRecord(t, 1, "sk-channel")

	submitted := submitImageTask(t, string(bodyBytes), userQuota, tokenKey)
	expectedQuota := expectedImageQuota(t, imageReq)

	assert.Equal(t, expectedQuota, submitted.Quota)
	assert.Equal(t, userQuota-expectedQuota, getUserQuotaForTest(t, 1))
	assert.Equal(t, userQuota-expectedQuota, getTokenRemainQuotaForTest(t, 1))

	task := claimTaskForWorker(t, submitted.ID, workerID)

	previousFactory := service.GetChannelAdaptorFunc
	service.GetChannelAdaptorFunc = func(apiType int) service.ImageChannelAdaptor {
		require.Equal(t, constant.APITypeOpenAI, apiType)
		return &e2eImageAdaptor{
			doRequest: func(_ io.Reader) (any, error) {
				return &http.Response{
					StatusCode: http.StatusBadRequest,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body:       io.NopCloser(strings.NewReader(`{"error":"bad request"}`)),
				}, nil
			},
		}
	}
	t.Cleanup(func() {
		service.GetChannelAdaptorFunc = previousFactory
	})

	err = service.ExecuteLocalImageTask(context.Background(), workerID, task)
	require.Error(t, err)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, submitted.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, updated.Status)
	assert.Contains(t, updated.FailReason, "upstream 400")
	record := getGenerationRecordByTaskID(t, submitted.TaskID)
	assert.Equal(t, model.GenerationKindImage, record.Kind)
	assert.Equal(t, model.GenerationStatusFailed, record.Status)
	assert.Equal(t, expectedQuota, record.Quota)
	assert.Equal(t, userQuota, getUserQuotaForTest(t, 1))
	assert.Equal(t, userQuota, getTokenRemainQuotaForTest(t, 1))
	assert.Equal(t, 0, getUserUsedQuotaForTest(t, 1))
	assert.EqualValues(t, 0, getChannelUsedQuotaForTest(t, 1))
}
