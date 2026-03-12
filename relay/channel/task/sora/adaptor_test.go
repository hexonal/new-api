package sora

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func TestExtractTotalTokensFromResponse(t *testing.T) {
	tests := []struct {
		name string
		body string
		want int
	}{
		{
			name: "top_level_usage",
			body: `{"usage":{"total_tokens":123}}`,
			want: 123,
		},
		{
			name: "wrapped_response_usage",
			body: `{"response":{"usage":{"total_tokens":456}}}`,
			want: 456,
		},
		{
			name: "metadata_usage_string",
			body: `{"metadata":{"usage":{"total_tokens":"789"}}}`,
			want: 789,
		},
		{
			name: "absent_usage",
			body: `{"status":"completed"}`,
			want: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractTotalTokensFromResponse([]byte(tt.body))
			if got != tt.want {
				t.Fatalf("extractTotalTokensFromResponse() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestBuildImaProPayload_MapsOpenAIStyleRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("username", "ima_foo")

	req := &relaycommon.TaskSubmitReq{
		Prompt:   "make a cinematic shot",
		Image:    "https://example.com/frame.png",
		Size:     "1280x720",
		Duration: 6,
		Metadata: map[string]any{
			"tenant_id": "tenant-1",
			"app_id":    "app-1",
			"app_kind":  "imagent",
			"audio":     true,
			"mcp_list": []any{
				map[string]any{"tool_name": "web_search"},
			},
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action: constant.TaskActionGenerate,
		},
	}

	payload, err := buildImaProPayload(ctx, req, info)
	if err != nil {
		t.Fatalf("buildImaProPayload returned error: %v", err)
	}

	if payload.TenantID != "tenant-1" {
		t.Fatalf("TenantID = %q, want tenant-1", payload.TenantID)
	}
	if payload.UserID != "ima_foo" {
		t.Fatalf("UserID = %q, want ima_foo", payload.UserID)
	}
	if payload.ModelVersion != "ima-pro" {
		t.Fatalf("ModelVersion = %q, want ima-pro", payload.ModelVersion)
	}
	if payload.AigcCategory != "image_to_video" {
		t.Fatalf("AigcCategory = %q, want image_to_video", payload.AigcCategory)
	}
	if payload.Parameters.Resolution != "720p" {
		t.Fatalf("Resolution = %q, want 720p", payload.Parameters.Resolution)
	}
	if payload.Parameters.AspectRatio != "16:9" {
		t.Fatalf("AspectRatio = %q, want 16:9", payload.Parameters.AspectRatio)
	}
	if payload.Parameters.Duration != 6 {
		t.Fatalf("Duration = %d, want 6", payload.Parameters.Duration)
	}
	if payload.Parameters.Audio != "true" {
		t.Fatalf("Audio = %q, want true", payload.Parameters.Audio)
	}
	if len(payload.Parameters.ElementList) < 2 {
		t.Fatalf("ElementList length = %d, want >= 2", len(payload.Parameters.ElementList))
	}
	if payload.Parameters.ElementList[0].ReferenceType != "text" {
		t.Fatalf("first element type = %q, want text", payload.Parameters.ElementList[0].ReferenceType)
	}
	if payload.Parameters.ElementList[1].ReferenceType != "image" {
		t.Fatalf("second element type = %q, want image", payload.Parameters.ElementList[1].ReferenceType)
	}
	if payload.Parameters.ElementList[1].Image == nil || payload.Parameters.ElementList[1].Image.URL != "https://example.com/frame.png" {
		t.Fatalf("image element mapping is invalid: %#v", payload.Parameters.ElementList[1].Image)
	}
}

func TestBuildRequestHeader_ImaProForcesJSONContentType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	ctx.Request.Header.Set("Content-Type", "multipart/form-data; boundary=test")

	adaptor := &TaskAdaptor{
		ChannelType: constant.ChannelTypeImaPro,
		apiKey:      "test-key",
	}

	req, err := http.NewRequest(http.MethodPost, "http://upstream/v1/videos", nil)
	if err != nil {
		t.Fatalf("new request failed: %v", err)
	}
	if err := adaptor.BuildRequestHeader(ctx, req, &relaycommon.RelayInfo{}); err != nil {
		t.Fatalf("BuildRequestHeader returned error: %v", err)
	}

	if got := req.Header.Get("Authorization"); got != "Bearer test-key" {
		t.Fatalf("Authorization = %q, want Bearer test-key", got)
	}
	if got := req.Header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", got)
	}
}
