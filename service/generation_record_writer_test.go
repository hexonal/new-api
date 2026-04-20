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
	assert.Equal(t, model.GenerationKindImage, mapTaskPlatformToKind(constant.TaskPlatformImage))
	assert.Equal(t, model.GenerationKindVideo, mapTaskPlatformToKind("kling"))
}

func TestConvertMsToSec(t *testing.T) {
	assert.EqualValues(t, 1710000000, convertMsToSec(1710000000))
	assert.EqualValues(t, 1710000000, convertMsToSec(1710000000123))
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
	previousDB := model.DB
	common.GenerationRecordEnabled.Store(true)
	t.Cleanup(func() {
		common.GenerationRecordEnabled.Store(previousEnabled)
		model.DB = previousDB
	})

	var err error
	model.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := model.DB.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})
	require.NoError(t, model.DB.AutoMigrate(&model.GenerationRecord{}))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("token_key", "dev_vid-craft_30")

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
	assert.Equal(t, "dev_vid-craft_30", found.Token)
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
