package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
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

	assert.Equal(t, []dto.GenerationOutputDTO{
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
	assert.Equal(t, "test prompt", rec.InputPreview)
	assert.Equal(t, 99, rec.Quota)
	assert.EqualValues(t, 1710000000, rec.SubmitTime)
}
