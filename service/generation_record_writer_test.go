package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMapTaskPlatformToKind(t *testing.T) {
	assert.Equal(t, model.GenerationKindMusic, mapTaskPlatformToKind(constant.TaskPlatformSuno))
	assert.Equal(t, model.GenerationKindImage, mapTaskPlatformToKind(constant.TaskPlatformMidjourney))
	assert.Equal(t, model.GenerationKindVideo, mapTaskPlatformToKind("kling"))
}

func TestConvertMsToSec(t *testing.T) {
	assert.EqualValues(t, 1710000000, convertMsToSec(1710000000))
	assert.EqualValues(t, 1710000000, convertMsToSec(1710000000123))
}

func TestBuildMjOutputURLs(t *testing.T) {
	mj := &model.Midjourney{
		ImageUrl:  "https://example.com/fallback-image.png",
		ImageUrls: `["https://example.com/1.png","https://example.com/2.png"]`,
		VideoUrl:  "https://example.com/fallback-video.mp4",
		VideoUrls: `[{"url":"https://example.com/1.mp4"},{"url":"https://example.com/2.mp4"}]`,
	}

	assert.Equal(t, []generationOutputRecord{
		{Type: "image", URL: "https://example.com/1.png", Index: 0},
		{Type: "image", URL: "https://example.com/2.png", Index: 1},
		{Type: "video", URL: "https://example.com/1.mp4", Index: 2},
		{Type: "video", URL: "https://example.com/2.mp4", Index: 3},
	}, buildMjOutputURLs(mj))
}

func TestBuildTaskOutputJSON(t *testing.T) {
	task := &model.Task{
		Platform: constant.TaskPlatformSuno,
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://example.com/result.mp3",
		},
	}

	assert.JSONEq(t, `[{"type":"audio","url":"https://example.com/result.mp3","index":0}]`, BuildTaskOutputJSON(task))
}

func TestBuildTaskFallbackRecordStoresRawResponse(t *testing.T) {
	task := &model.Task{
		TaskID:    "task_raw_response",
		UserId:    30,
		ChannelId: 9,
		Platform:  constant.TaskPlatform("kling"),
		Properties: model.Properties{
			Input: `{"prompt":"cat"}`,
		},
		Data: []byte(`{"status":"completed","url":"https://example.com/cat.mp4"}`),
	}

	rec := buildTaskFallbackRecord(task)

	assert.Equal(t, task.Properties.Input, rec.RequestBody)
	assert.Equal(t, string(task.Data), rec.ResponseBody)
}

func TestWriteSyncSuccessStoresTokenAndRawBodies(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousEnabled := common.GenerationRecordEnabled.Load()
	common.GenerationRecordEnabled.Store(true)
	t.Cleanup(func() {
		common.GenerationRecordEnabled.Store(previousEnabled)
	})

	var err error
	model.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, model.DB.AutoMigrate(&model.GenerationRecord{}))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("token_name", "dev_vid-craft_30")

	info := &relaycommon.RelayInfo{
		TokenId: 27,
		UserId:  30,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 9,
		},
	}
	req := SyncGenerationReq{
		Kind:         model.GenerationKindImage,
		Model:        "doubao-seedream-4-5-251128",
		RequestBody:  `{"prompt":"cat"}`,
		ResponseBody: `{"data":[{"url":"https://example.com/cat.png"}]}`,
		TotalTokens:  1,
	}

	WriteSyncSuccess(c, info, req)

	var found model.GenerationRecord
	require.NoError(t, model.DB.First(&found).Error)
	assert.Equal(t, "dev_vid-craft_30", found.TokenName)
	assert.Equal(t, req.RequestBody, found.RequestBody)
	assert.Equal(t, req.ResponseBody, found.ResponseBody)
}

func TestBuildMjFallbackRecord(t *testing.T) {
	mj := &model.Midjourney{
		UserId:      11,
		ChannelId:   22,
		MjId:        "mj_task_1",
		Action:      "IMAGINE",
		Prompt:      "test prompt",
		Description: "desc",
		Quota:       99,
		SubmitTime:  1710000000123,
	}

	rec := buildMjFallbackRecord(mj)
	assert.Equal(t, 0, rec.TokenID)
	assert.Equal(t, 11, rec.UserID)
	assert.Equal(t, 22, rec.ChannelID)
	assert.Equal(t, model.GenerationKindImage, rec.Kind)
	assert.Equal(t, string(constant.TaskPlatformMidjourney), rec.Platform)
	assert.Equal(t, "mj_task_1", rec.ExternalTaskID)
	assert.Equal(t, "test prompt", rec.RequestBody)
	assert.Equal(t, 99, rec.Quota)
	assert.EqualValues(t, 1710000000, rec.SubmitTime)
}
