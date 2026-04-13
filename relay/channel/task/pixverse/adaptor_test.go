package pixverse

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func newPixVerseTestContext(req relaycommon.TaskSubmitReq) *gin.Context {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", req)
	return ctx
}

func newPixVerseJSONContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req, _ := http.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req
	return ctx
}

func newPixVerseRelayInfo(modelName, baseURL string, channelType int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: modelName,
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       channelType,
			ChannelBaseUrl:    baseURL,
			UpstreamModelName: modelName,
		},
	}
}

func TestTaskAdaptor_PerCallRatiosEnabled(t *testing.T) {
	adaptor := &TaskAdaptor{}
	opt, ok := any(adaptor).(interface{ PerCallRatiosEnabled() bool })
	if !ok {
		t.Fatalf("pixverse adaptor should opt in to per-call ratio application")
	}
	if !opt.PerCallRatiosEnabled() {
		t.Fatalf("pixverse adaptor should enable per-call ratio application")
	}
}

func TestEstimateBilling_OfficialPixVerseC1UsesDurationResolutionAndAudioRatios(t *testing.T) {
	adaptor := &TaskAdaptor{}
	ctx := newPixVerseTestContext(relaycommon.TaskSubmitReq{
		Prompt:   "make a video",
		Duration: 8,
		Metadata: map[string]any{
			"quality": "540p",
			"audio":   true,
		},
	})
	info := newPixVerseRelayInfo("pixverse-c1", "https://app-api.pixverse.ai", constant.ChannelTypePixVerse)

	got := adaptor.EstimateBilling(ctx, info)
	if got == nil {
		t.Fatalf("EstimateBilling returned nil for official PixVerse C1 request")
	}
	if got["duration"] != 8 {
		t.Fatalf("duration ratio = %v, want 8", got["duration"])
	}
	if got["resolution"] != 8.0/6.0 {
		t.Fatalf("resolution ratio = %v, want %v", got["resolution"], 8.0/6.0)
	}
	if got["audio"] != 10.0/8.0 {
		t.Fatalf("audio ratio = %v, want %v", got["audio"], 10.0/8.0)
	}
}

func TestEstimateBilling_NonOfficialPixVerseChannelFallsBackToLegacyPricing(t *testing.T) {
	adaptor := &TaskAdaptor{}
	ctx := newPixVerseTestContext(relaycommon.TaskSubmitReq{
		Prompt:   "make a video",
		Duration: 10,
		Metadata: map[string]any{
			"quality": "1080p",
			"audio":   true,
		},
	})
	info := newPixVerseRelayInfo("pixverse-c1", "https://proxy.example.com", constant.ChannelTypePixVerse)

	got := adaptor.EstimateBilling(ctx, info)
	if got != nil {
		t.Fatalf("EstimateBilling = %#v, want nil for non-official PixVerse channel", got)
	}
}

func TestEstimateBilling_LegacyPixVerseModelsDoNotUseOfficialDynamicBilling(t *testing.T) {
	adaptor := &TaskAdaptor{}
	ctx := newPixVerseTestContext(relaycommon.TaskSubmitReq{
		Prompt:   "make a video",
		Duration: 8,
		Metadata: map[string]any{
			"quality": "720p",
		},
	})
	info := newPixVerseRelayInfo("pixverse-v5.6", "https://app-api.pixverse.ai", constant.ChannelTypePixVerse)

	got := adaptor.EstimateBilling(ctx, info)
	if got != nil {
		t.Fatalf("EstimateBilling = %#v, want nil for legacy PixVerse model", got)
	}
}

func TestBuildRequestBody_MapsAudioAliasToOfficialGenerateAudioSwitch(t *testing.T) {
	adaptor := &TaskAdaptor{}
	ctx := newPixVerseTestContext(relaycommon.TaskSubmitReq{
		Prompt:   "make a video",
		Duration: 5,
		Metadata: map[string]any{
			"audio": true,
		},
	})
	info := newPixVerseRelayInfo("pixverse-c1", "https://app-api.pixverse.ai", constant.ChannelTypePixVerse)

	body, err := adaptor.BuildRequestBody(ctx, info)
	if err != nil {
		t.Fatalf("BuildRequestBody returned error: %v", err)
	}
	data, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("ReadAll returned error: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	got, ok := payload["generate_audio_switch"].(bool)
	if !ok || !got {
		t.Fatalf("generate_audio_switch = %#v, want true", payload["generate_audio_switch"])
	}
}

func TestBuildRequestBody_UsesTopLevelQualityFromJSONRequest(t *testing.T) {
	adaptor := &TaskAdaptor{}
	ctx := newPixVerseJSONContext(`{"model":"pixverse-c1","prompt":"make a video","duration":5,"quality":"540p","metadata":{"audio":true}}`)
	info := newPixVerseRelayInfo("pixverse-c1", "https://app-api.pixverse.ai", constant.ChannelTypePixVerse)

	if taskErr := adaptor.ValidateRequestAndSetAction(ctx, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction returned error: %v", taskErr)
	}
	body, err := adaptor.BuildRequestBody(ctx, info)
	if err != nil {
		t.Fatalf("BuildRequestBody returned error: %v", err)
	}
	data, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("ReadAll returned error: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	if payload["quality"] != "540p" {
		t.Fatalf("quality = %#v, want 540p", payload["quality"])
	}
}
