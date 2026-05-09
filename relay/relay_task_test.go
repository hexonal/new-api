package relay

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/constant"
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
