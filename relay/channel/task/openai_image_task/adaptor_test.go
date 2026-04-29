package openai_image_task

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestChannelTypeOpenAIImageTaskExists(t *testing.T) {
	if constant.ChannelTypeOpenAIImageTask == 0 {
		t.Fatal("ChannelTypeOpenAIImageTask must be defined and non-zero")
	}
	if constant.ChannelTypeOpenAIImageTask != 60 {
		t.Fatalf("ChannelTypeOpenAIImageTask expected 60, got %d", constant.ChannelTypeOpenAIImageTask)
	}
}
