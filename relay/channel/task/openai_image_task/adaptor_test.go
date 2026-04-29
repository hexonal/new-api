package openai_image_task

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestChannelTypeOpenAIImageTaskExists(t *testing.T) {
	if constant.ChannelTypeOpenAIImageTask == 0 {
		t.Fatal("ChannelTypeOpenAIImageTask must be defined and non-zero")
	}
	if constant.ChannelTypeOpenAIImageTask != 60 {
		t.Fatalf("ChannelTypeOpenAIImageTask expected 60, got %d", constant.ChannelTypeOpenAIImageTask)
	}
}

func TestBuildRequestURL_AppendsImagesPath(t *testing.T) {
	a := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{}
	a.Init(info)
	a.baseURL = "http://ai-router.internal:8080"

	got, err := a.BuildRequestURL(info)
	if err != nil {
		t.Fatalf("BuildRequestURL err: %v", err)
	}

	want := "http://ai-router.internal:8080/v1/images"
	if got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}
