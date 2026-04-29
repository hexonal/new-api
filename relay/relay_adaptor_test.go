package relay

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	openai_image_task "github.com/QuantumNous/new-api/relay/channel/task/openai_image_task"
)

func TestGetTaskAdaptor_OpenAIImageTask(t *testing.T) {
	platform := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeOpenAIImageTask))
	got := GetTaskAdaptor(platform)
	if got == nil {
		t.Fatal("expected adapter for ChannelTypeOpenAIImageTask, got nil")
	}
	if got.GetChannelName() != openai_image_task.ChannelName {
		t.Fatalf("got channel name %s, want %s", got.GetChannelName(), openai_image_task.ChannelName)
	}
}
