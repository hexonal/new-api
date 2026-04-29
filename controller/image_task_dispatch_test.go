package controller

import (
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay"
	openai_image_task "github.com/QuantumNous/new-api/relay/channel/task/openai_image_task"

	"github.com/gin-gonic/gin"
)

func TestImageTask_RoutesToOpenAIImageTaskAdapterWhenChannelType60(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAIImageTask)
	c.Set("platform", string(constant.TaskPlatformImage))

	platform := relay.GetTaskPlatform(c)
	wantPlatform := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeOpenAIImageTask))
	if platform != wantPlatform {
		t.Fatalf("expected platform=%d, got %s", constant.ChannelTypeOpenAIImageTask, platform)
	}

	adapter := relay.GetTaskAdaptor(platform)
	if adapter == nil {
		t.Fatal("expected openai_image_task adapter, got nil")
	}
	if adapter.GetChannelName() != openai_image_task.ChannelName {
		t.Fatalf("got channel name %s, want %s", adapter.GetChannelName(), openai_image_task.ChannelName)
	}
}
