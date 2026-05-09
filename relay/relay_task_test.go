package relay

import (
	"encoding/json"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func TestGetTaskSubmitPlatform_OpenAIImageTaskOverridesImagePlatform(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	c.Set("platform", string(constant.TaskPlatformImage))
	c.Set("channel_type", constant.ChannelTypeOpenAIImageTask)

	got := getTaskSubmitPlatform(c)
	want := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeOpenAIImageTask))
	if got != want {
		t.Fatalf("got platform %q, want %q", got, want)
	}
}

func TestGetTaskSubmitPlatform_ImagePlatformPreservedForOtherChannelTypes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	c.Set("platform", string(constant.TaskPlatformImage))
	c.Set("channel_type", constant.ChannelTypeOpenAI)

	got := getTaskSubmitPlatform(c)
	want := constant.TaskPlatform(constant.TaskPlatformImage)
	if got != want {
		t.Fatalf("got platform %q, want %q", got, want)
	}
}

func TestBuildImageTaskResultItemsUsesAiRouterEnvelopeURL(t *testing.T) {
	task := &model.Task{
		Data: json.RawMessage(`{"code":"success","message":"","data":{"url":"https://oss.example.com/real.png","status":"succeeded","task_id":"task_123","format":"png","amount_usd":0.04}}`),
		PrivateData: model.TaskPrivateData{
			ResultURL: "/v1/videos/task_123/content",
		},
	}

	items := buildImageTaskResultItems(task)
	if len(items) != 1 {
		t.Fatalf("got %d items, want 1", len(items))
	}

	want := "https://oss.example.com/real.png"
	if items[0].URL != want {
		t.Fatalf("got URL %q, want %q", items[0].URL, want)
	}
}
