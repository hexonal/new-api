package sora

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func TestConvertToOpenAIVideo_ExposeUsageAndResults(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := &model.Task{
		TaskID:   "task_public_001",
		Status:   model.TaskStatusSuccess,
		Progress: "100%",
		Properties: model.Properties{
			OriginModelName: "ima-pro",
		},
		Data: json.RawMessage(`{
			"id_task":"tk_upstream_001",
			"task_status":"completed",
			"results":[{"url":"https://cdn.example.com/final.mp4","size":123,"content_type":"video"}],
			"usage":{"completion_tokens":324900,"total_tokens":324900}
		}`),
	}
	task.PrivateData.ResultURL = "https://cdn.example.com/final.mp4"

	body, err := adaptor.ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo returned error: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}

	if got["id"] != "task_public_001" {
		t.Fatalf("id = %v, want task_public_001", got["id"])
	}
	if got["task_id"] != "task_public_001" {
		t.Fatalf("task_id = %v, want task_public_001", got["task_id"])
	}
	if got["status"] != "completed" {
		t.Fatalf("status = %v, want completed", got["status"])
	}

	usage, ok := got["usage"].(map[string]any)
	if !ok {
		t.Fatalf("usage missing or invalid: %#v", got["usage"])
	}
	if usage["total_tokens"] != float64(324900) {
		t.Fatalf("usage.total_tokens = %v, want 324900", usage["total_tokens"])
	}

	results, ok := got["results"].([]any)
	if !ok || len(results) != 1 {
		t.Fatalf("results missing or invalid: %#v", got["results"])
	}
	r0, ok := results[0].(map[string]any)
	if !ok {
		t.Fatalf("results[0] invalid: %#v", results[0])
	}
	if r0["url"] != "https://cdn.example.com/final.mp4" {
		t.Fatalf("results[0].url = %v, want https://cdn.example.com/final.mp4", r0["url"])
	}
}

func TestConvertToOpenAIVideo_UsageAndResultsPathFallback(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := &model.Task{
		TaskID:   "task_public_002",
		Status:   model.TaskStatusInProgress,
		Progress: "42%",
		Properties: model.Properties{
			OriginModelName: "ima-pro-fast",
		},
		Data: json.RawMessage(`{
			"data":{
				"results":[{"url":"https://cdn.example.com/from_data.mp4"}],
				"usage":{"total_tokens":111}
			}
		}`),
	}

	body, err := adaptor.ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo returned error: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}

	usage, ok := got["usage"].(map[string]any)
	if !ok || usage["total_tokens"] != float64(111) {
		t.Fatalf("usage fallback invalid: %#v", got["usage"])
	}
	results, ok := got["results"].([]any)
	if !ok || len(results) != 1 {
		t.Fatalf("results fallback invalid: %#v", got["results"])
	}
}

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

func TestParseTaskResult_ImaCallbackCompleted(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"id_task":"tk-123",
		"task_status":"completed",
		"task_code":0,
		"results":[{"url":"https://file.example.com/video.mp4"}]
	}`)

	result, err := adaptor.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult error: %v", err)
	}
	if result.Status != "SUCCESS" {
		t.Fatalf("Status = %q, want SUCCESS", result.Status)
	}
	if result.Url != "https://file.example.com/video.mp4" {
		t.Fatalf("Url = %q, want callback result url", result.Url)
	}
	if result.TaskID != "tk-123" {
		t.Fatalf("TaskID = %q, want tk-123", result.TaskID)
	}
}

func TestParseTaskResult_ImaCallbackFailedByTaskCode(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"id_task":"tk-456",
		"task_status":"failed",
		"task_code":1234
	}`)

	result, err := adaptor.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult error: %v", err)
	}
	if result.Status != "FAILURE" {
		t.Fatalf("Status = %q, want FAILURE", result.Status)
	}
	if result.Reason == "" {
		t.Fatalf("Reason should not be empty")
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
		TokenKey: "sk-current-user",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:       constant.TaskActionGenerate,
			PublicTaskID: "task_public_123",
		},
	}

	payload, err := buildImaProPayload(ctx, req, info)
	if err != nil {
		t.Fatalf("buildImaProPayload returned error: %v", err)
	}

	if payload.TenantID != "tenant-1" {
		t.Fatalf("TenantID = %q, want tenant-1", payload.TenantID)
	}
	if payload.UserID != "task_public_123" {
		t.Fatalf("UserID = %q, want task_public_123", payload.UserID)
	}
	if payload.IDTask != "task_public_123" {
		t.Fatalf("IDTask = %q, want task_public_123", payload.IDTask)
	}
	if payload.ModelVersion != "ima-pro" {
		t.Fatalf("ModelVersion = %q, want ima-pro", payload.ModelVersion)
	}
	if payload.TaskID != "task_public_123" {
		t.Fatalf("TaskID = %q, want task_public_123", payload.TaskID)
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
	if payload.Parameters.ElementList[1].ReferenceRole != "reference_image" {
		t.Fatalf("second element role = %q, want reference_image", payload.Parameters.ElementList[1].ReferenceRole)
	}
	if payload.Parameters.ElementList[1].Image == nil || payload.Parameters.ElementList[1].Image.URL != "https://example.com/frame.png" {
		t.Fatalf("image element mapping is invalid: %#v", payload.Parameters.ElementList[1].Image)
	}
	if payload.CallbackURL != "" {
		t.Fatalf("CallbackURL = %q, want empty", payload.CallbackURL)
	}
}

func TestBuildImaProPayload_ChannelSettingOverridesTenantApp(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("username", "ima_foo")

	req := &relaycommon.TaskSubmitReq{
		Prompt: "make a cinematic shot",
		Image:  "https://example.com/frame.png",
		Metadata: map[string]any{
			"tenant_id": "tenant-from-metadata",
			"app_id":    "app-from-metadata",
			"app_kind":  "kind-from-metadata",
		},
	}
	info := &relaycommon.RelayInfo{
		TokenKey: "sk-current-user",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro-fast",
		},
	}
	info.ChannelSetting.ImaProTenantID = "arena"
	info.ChannelSetting.ImaProAppID = "arena"
	info.ChannelSetting.ImaProAppKind = "imagent"

	payload, err := buildImaProPayload(ctx, req, info)
	if err != nil {
		t.Fatalf("buildImaProPayload returned error: %v", err)
	}
	if payload.TenantID != "arena" {
		t.Fatalf("TenantID = %q, want arena", payload.TenantID)
	}
	if payload.AppID != "arena" {
		t.Fatalf("AppID = %q, want arena", payload.AppID)
	}
	if payload.AppKind != "imagent" {
		t.Fatalf("AppKind = %q, want imagent", payload.AppKind)
	}
	if payload.UserID != "sk-current-user" {
		t.Fatalf("UserID = %q, want sk-current-user", payload.UserID)
	}
}

func TestBuildImaProPayload_MultiModalArrays_MapToElementList(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("username", "ima_user")

	req := &relaycommon.TaskSubmitReq{
		Prompt: "multi media prompt",
		Images: []string{
			"https://file.fashionlabs.cn/doc_image/1.png",
			"https://file.fashionlabs.cn/doc_image/2.png",
		},
		Metadata: map[string]any{
			"reference_video_urls": []any{
				"https://file.fashionlabs.cn/doc_video/v1.mp4",
				map[string]any{"url": "https://file.fashionlabs.cn/doc_video/v2.mp4"},
			},
			"reference_audio_urls": []string{
				"https://file.fashionlabs.cn/doc_audio/a1.mp3",
				"https://file.fashionlabs.cn/doc_audio/a2.mp3",
			},
		},
	}
	info := &relaycommon.RelayInfo{
		TokenKey: "sk-current-user",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:       constant.TaskActionGenerate,
			PublicTaskID: "task_public_123",
		},
	}

	payload, err := buildImaProPayload(ctx, req, info)
	if err != nil {
		t.Fatalf("buildImaProPayload returned error: %v", err)
	}
	got := payload.Parameters.ElementList
	if len(got) != 7 {
		t.Fatalf("element_list len = %d, want 7", len(got))
	}
	// text -> images -> videos -> audios
	if got[0].ReferenceType != "text" {
		t.Fatalf("got[0].ReferenceType = %q, want text", got[0].ReferenceType)
	}
	if got[1].ReferenceType != "image" || got[1].ReferenceRole != "reference_image" {
		t.Fatalf("got[1] invalid image role under reference media: %+v", got[1])
	}
	if got[2].ReferenceType != "image" || got[2].ReferenceRole != "reference_image" {
		t.Fatalf("got[2] invalid image role: %+v", got[2])
	}
	if got[3].ReferenceType != "video" || got[3].ReferenceRole != "reference_video" {
		t.Fatalf("got[3] invalid video role: %+v", got[3])
	}
	if got[4].ReferenceType != "video" || got[4].ReferenceRole != "reference_video" {
		t.Fatalf("got[4] invalid video role: %+v", got[4])
	}
	if got[5].ReferenceType != "audio" || got[5].ReferenceRole != "reference_audio" {
		t.Fatalf("got[5] invalid audio role: %+v", got[5])
	}
	if got[6].ReferenceType != "audio" || got[6].ReferenceRole != "reference_audio" {
		t.Fatalf("got[6] invalid audio role: %+v", got[6])
	}
}

func TestBuildImaProPayload_TwoImagesUseReferenceImageRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("username", "ima_user")

	req := &relaycommon.TaskSubmitReq{
		Prompt: "two frame prompt",
		Images: []string{
			"https://file.fashionlabs.cn/doc_image/first.png",
			"https://file.fashionlabs.cn/doc_image/last.png",
		},
	}
	info := &relaycommon.RelayInfo{
		TokenKey: "sk-current-user",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:       constant.TaskActionGenerate,
			PublicTaskID: "task_public_456",
		},
	}

	payload, err := buildImaProPayload(ctx, req, info)
	if err != nil {
		t.Fatalf("buildImaProPayload returned error: %v", err)
	}

	got := payload.Parameters.ElementList
	if len(got) < 3 {
		t.Fatalf("element_list len = %d, want >= 3", len(got))
	}
	if got[1].ReferenceType != "image" || got[1].ReferenceRole != "reference_image" {
		t.Fatalf("got[1] invalid role: %+v", got[1])
	}
	if got[2].ReferenceType != "image" || got[2].ReferenceRole != "reference_image" {
		t.Fatalf("got[2] invalid role: %+v", got[2])
	}
}

func TestBuildImaProPayload_SingleImageFrameModeUsesFirstFrame(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	req := &relaycommon.TaskSubmitReq{
		Prompt: "single image frame mode",
		Images: []string{"https://file.fashionlabs.cn/doc_image/first.png"},
		Metadata: map[string]any{
			"role_mode": "frame",
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro",
		},
	}

	payload, err := buildImaProPayload(ctx, req, info)
	if err != nil {
		t.Fatalf("buildImaProPayload returned error: %v", err)
	}
	got := payload.Parameters.ElementList
	if len(got) < 2 {
		t.Fatalf("element_list len = %d, want >= 2", len(got))
	}
	if got[1].ReferenceType != "image" || got[1].ReferenceRole != "first_frame" {
		t.Fatalf("got[1] invalid frame role: %+v", got[1])
	}
}

func TestBuildImaProPayload_TwoImagesFrameModeUsesFirstLastFrame(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	req := &relaycommon.TaskSubmitReq{
		Prompt: "two images frame mode",
		Images: []string{
			"https://file.fashionlabs.cn/doc_image/first.png",
			"https://file.fashionlabs.cn/doc_image/last.png",
		},
		Metadata: map[string]any{
			"image_role_mode": "frame",
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro",
		},
	}

	payload, err := buildImaProPayload(ctx, req, info)
	if err != nil {
		t.Fatalf("buildImaProPayload returned error: %v", err)
	}
	got := payload.Parameters.ElementList
	if len(got) < 3 {
		t.Fatalf("element_list len = %d, want >= 3", len(got))
	}
	if got[1].ReferenceType != "image" || got[1].ReferenceRole != "first_frame" {
		t.Fatalf("got[1] invalid frame role: %+v", got[1])
	}
	if got[2].ReferenceType != "image" || got[2].ReferenceRole != "last_frame" {
		t.Fatalf("got[2] invalid frame role: %+v", got[2])
	}
}

func TestBuildImaProPayload_FrameModeConflictWithReferenceMedia(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	req := &relaycommon.TaskSubmitReq{
		Prompt: "frame mode with reference video",
		Images: []string{"https://file.fashionlabs.cn/doc_image/first.png"},
		Metadata: map[string]any{
			"image_role_mode":      "frame",
			"reference_video_urls": []string{"https://file.fashionlabs.cn/doc_video/v1.mp4"},
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro",
		},
	}

	_, err := buildImaProPayload(ctx, req, info)
	if err == nil {
		t.Fatalf("expected error for frame mode mixed with reference media")
	}
	if !strings.Contains(err.Error(), "frame mode cannot be mixed") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildImaProPayload_ImagesPriorityOverInputReference(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("username", "ima_user")

	req := &relaycommon.TaskSubmitReq{
		Prompt:         "image priority",
		Images:         []string{"https://file.fashionlabs.cn/doc_image/priority.png"},
		InputReference: "https://file.fashionlabs.cn/doc_image/fallback.png",
	}
	info := &relaycommon.RelayInfo{
		TokenKey: "sk-current-user",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro",
		},
	}

	payload, err := buildImaProPayload(ctx, req, info)
	if err != nil {
		t.Fatalf("buildImaProPayload returned error: %v", err)
	}

	var imageURLs []string
	for _, item := range payload.Parameters.ElementList {
		if item.ReferenceType == "image" && item.Image != nil {
			imageURLs = append(imageURLs, item.Image.URL)
		}
	}
	if len(imageURLs) != 1 {
		t.Fatalf("image url len = %d, want 1", len(imageURLs))
	}
	if imageURLs[0] != "https://file.fashionlabs.cn/doc_image/priority.png" {
		t.Fatalf("image url = %q, want priority image", imageURLs[0])
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
	if err := adaptor.BuildRequestHeader(ctx, req, &relaycommon.RelayInfo{
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task_public_123",
		},
	}); err != nil {
		t.Fatalf("BuildRequestHeader returned error: %v", err)
	}

	if got := req.Header.Get("Authorization"); got != "Bearer test-key" {
		t.Fatalf("Authorization = %q, want Bearer test-key", got)
	}
	if got := req.Header.Get("X-New-Api-Task-Id"); got != "task_public_123" {
		t.Fatalf("X-New-Api-Task-Id = %q, want task_public_123", got)
	}
	if got := req.Header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", got)
	}
}

func TestBuildRequestURL_ImaProUsesAIGCTaskCreate(t *testing.T) {
	adaptor := &TaskAdaptor{
		ChannelType: constant.ChannelTypeImaPro,
		baseURL:     "http://upstream.example.com",
	}

	got, err := adaptor.BuildRequestURL(&relaycommon.RelayInfo{})
	if err != nil {
		t.Fatalf("BuildRequestURL returned error: %v", err)
	}
	if got != "http://upstream.example.com/api/v1/aigc/task/create" {
		t.Fatalf("BuildRequestURL = %q, want /api/v1/aigc/task/create", got)
	}
}

func TestBuildImaProPayload_MediaAliasKeyFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("username", "ima_user")

	req := &relaycommon.TaskSubmitReq{
		Prompt: "alias media keys",
		Metadata: map[string]any{
			"video_urls":          []string{"https://file.fashionlabs.cn/doc_video/alias_v1.mp4"},
			"reference_audio_url": "https://file.fashionlabs.cn/doc_audio/alias_a1.mp3",
		},
	}
	info := &relaycommon.RelayInfo{
		TokenKey: "sk-current-user",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro",
		},
	}

	payload, err := buildImaProPayload(ctx, req, info)
	if err != nil {
		t.Fatalf("buildImaProPayload returned error: %v", err)
	}
	got := payload.Parameters.ElementList
	if len(got) != 3 {
		t.Fatalf("element_list len = %d, want 3", len(got))
	}
	if got[1].ReferenceType != "video" || got[1].Video == nil || got[1].Video.URL != "https://file.fashionlabs.cn/doc_video/alias_v1.mp4" {
		t.Fatalf("video mapping invalid: %+v", got[1])
	}
	if got[2].ReferenceType != "audio" || got[2].Audio == nil || got[2].Audio.URL != "https://file.fashionlabs.cn/doc_audio/alias_a1.mp3" {
		t.Fatalf("audio mapping invalid: %+v", got[2])
	}
}

func TestFetchTask_ImaProQueryFallbackChain(t *testing.T) {
	visited := make([]string, 0, 3)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		visited = append(visited, r.Method+" "+r.URL.Path)
		switch len(visited) {
		case 1:
			// Force fallback from POST /api/v1/aigc/task/query
			w.WriteHeader(http.StatusMethodNotAllowed)
			_, _ = w.Write([]byte(`{"code":405}`))
		case 2:
			// GET /api/v1/aigc/task/query?id_task=... should be used next.
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"task_status":"completed","results":[{"url":"https://file.fashionlabs.cn/out.mp4"}]}`))
		default:
			t.Fatalf("unexpected extra request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer server.Close()

	adaptor := &TaskAdaptor{ChannelType: constant.ChannelTypeImaPro}
	resp, err := adaptor.FetchTask(server.URL, "sk-test", map[string]any{
		"task_id": "tk_123",
	}, "")
	if err != nil {
		t.Fatalf("FetchTask returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status code = %d, want 200", resp.StatusCode)
	}
	if len(visited) != 2 {
		t.Fatalf("request count = %d, want 2", len(visited))
	}
	if visited[0] != "POST /api/v1/aigc/task/query" {
		t.Fatalf("first request = %q, want POST /api/v1/aigc/task/query", visited[0])
	}
	if visited[1] != "GET /api/v1/aigc/task/query" {
		t.Fatalf("second request = %q, want GET /api/v1/aigc/task/query", visited[1])
	}
}

func TestDoResponse_WrappedCreateResponseExtractsDataIDTask(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)

	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"code": 200,
		"data": {
			"id_task": "tk-202603131631387ETKUBM91MTD72X9",
			"estimated_time_seconds": 150
		},
		"log_id": "20260313163138A5WI3LABWETA3RNU",
		"message": "Success"
	}`)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     make(http.Header),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "ima-pro",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task_public_123",
		},
	}

	upstreamID, _, taskErr := adaptor.DoResponse(ctx, resp, info)
	if taskErr != nil {
		t.Fatalf("DoResponse returned error: %+v", taskErr)
	}
	if upstreamID != "tk-202603131631387ETKUBM91MTD72X9" {
		t.Fatalf("upstreamID = %q, want tk-202603131631387ETKUBM91MTD72X9", upstreamID)
	}

	var got responseTask
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal response body failed: %v", err)
	}
	if got.ID != "task_public_123" || got.TaskID != "task_public_123" {
		t.Fatalf("public task id mapping invalid: id=%q task_id=%q", got.ID, got.TaskID)
	}
	if got.Object != "video" {
		t.Fatalf("Object = %q, want video", got.Object)
	}
	if got.Model != "ima-pro" {
		t.Fatalf("Model = %q, want ima-pro", got.Model)
	}
}

func TestDoResponse_ErrorPayloadWithoutTaskIDPreservesUpstreamMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)

	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"error": {
			"code": "InvalidParameter",
			"message": "The parameter content specified in the request is not valid",
			"param": "content",
			"type": "BadRequest"
		}
	}`)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     make(http.Header),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "ima-pro-fast",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ima-pro-fast",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task_public_789",
		},
	}

	_, _, taskErr := adaptor.DoResponse(ctx, resp, info)
	if taskErr == nil {
		t.Fatalf("DoResponse should return task error")
	}
	if taskErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("taskErr.StatusCode = %d, want %d", taskErr.StatusCode, http.StatusBadRequest)
	}
	if !strings.Contains(taskErr.Message, "content") {
		t.Fatalf("taskErr.Message = %q, want upstream content error", taskErr.Message)
	}
}

func TestGetModelList_ImaProContainsFastModel(t *testing.T) {
	adaptor := &TaskAdaptor{ChannelType: constant.ChannelTypeImaPro}
	models := adaptor.GetModelList()
	expected := map[string]bool{
		"ima-pro":      false,
		"ima-pro-fast": false,
	}
	for _, modelName := range models {
		if _, ok := expected[modelName]; ok {
			expected[modelName] = true
		}
	}
	for modelName, found := range expected {
		if !found {
			t.Fatalf("missing model %q in model list: %#v", modelName, models)
		}
	}
}

func TestParseTaskResult_CompatCompletedWithResultsURL(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"id_task":"ima_task_123",
		"task_status":"completed",
		"task_code":"ok",
		"finish_at":"2026-03-13T10:00:00Z",
		"results":[{"url":"https://cdn.example.com/ima/video.mp4"}]
	}`)

	got, err := adaptor.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult returned error: %v", err)
	}
	if got.Status != model.TaskStatusSuccess {
		t.Fatalf("Status = %q, want %q", got.Status, model.TaskStatusSuccess)
	}
	if got.TaskID != "ima_task_123" {
		t.Fatalf("TaskID = %q, want ima_task_123", got.TaskID)
	}
	if got.Url != "https://cdn.example.com/ima/video.mp4" {
		t.Fatalf("Url = %q, want https://cdn.example.com/ima/video.mp4", got.Url)
	}
}

func TestParseTaskResult_CompatFailedWithTaskCode(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"id_task":"ima_task_456",
		"task_status":"failed",
		"task_code":"E_TASK_TIMEOUT",
		"finish_at":1710000000
	}`)

	got, err := adaptor.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult returned error: %v", err)
	}
	if got.Status != model.TaskStatusFailure {
		t.Fatalf("Status = %q, want %q", got.Status, model.TaskStatusFailure)
	}
	if got.TaskID != "ima_task_456" {
		t.Fatalf("TaskID = %q, want ima_task_456", got.TaskID)
	}
	if got.Reason != "E_TASK_TIMEOUT" {
		t.Fatalf("Reason = %q, want E_TASK_TIMEOUT", got.Reason)
	}
}

func TestParseTaskResult_CompatTaskCodeForcesFailureWhenStatusCompleted(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"id_task":"ima_task_789",
		"task_status":"completed",
		"task_code":"E_TASK_TIMEOUT",
		"results":[{"url":"https://cdn.example.com/ima/video.mp4"}]
	}`)

	got, err := adaptor.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult returned error: %v", err)
	}
	if got.Status != model.TaskStatusFailure {
		t.Fatalf("Status = %q, want %q", got.Status, model.TaskStatusFailure)
	}
	if got.Reason != "E_TASK_TIMEOUT" {
		t.Fatalf("Reason = %q, want E_TASK_TIMEOUT", got.Reason)
	}
}

func TestParseTaskResult_CompatFailureIgnoresGenericSuccessMessage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"id_task":"ima_task_901",
		"task_status":"failed",
		"task_code":"E_UPSTREAM_TIMEOUT",
		"message":"Success"
	}`)

	got, err := adaptor.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult returned error: %v", err)
	}
	if got.Status != model.TaskStatusFailure {
		t.Fatalf("Status = %q, want %q", got.Status, model.TaskStatusFailure)
	}
	if got.Reason != "E_UPSTREAM_TIMEOUT" {
		t.Fatalf("Reason = %q, want E_UPSTREAM_TIMEOUT", got.Reason)
	}
}

func TestParseTaskResult_CompatFailurePrefersReasonOverGenericMessage(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"id_task":"ima_task_902",
		"task_status":"failed",
		"task_code":"1",
		"message":"Success",
		"reason":"content policy blocked"
	}`)

	got, err := adaptor.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult returned error: %v", err)
	}
	if got.Status != model.TaskStatusFailure {
		t.Fatalf("Status = %q, want %q", got.Status, model.TaskStatusFailure)
	}
	if got.Reason != "content policy blocked" {
		t.Fatalf("Reason = %q, want content policy blocked", got.Reason)
	}
}

func TestParseTaskResult_CompatFailureUsesTaskMsg(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"code":200,
		"data":{
			"id_task":"ima_task_903",
			"task_status":"failed",
			"task_code":1001,
			"task_msg":"video generation failed: internal error: 601300"
		},
		"message":"Success"
	}`)

	got, err := adaptor.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult returned error: %v", err)
	}
	if got.Status != model.TaskStatusFailure {
		t.Fatalf("Status = %q, want %q", got.Status, model.TaskStatusFailure)
	}
	if got.Reason != "video generation failed: internal error: 601300" {
		t.Fatalf("Reason = %q, want task_msg", got.Reason)
	}
}

func TestParseTaskResult_CompatWrappedDataFields(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"data":{
			"id_task":"ima_task_data_1",
			"task_status":"completed",
			"task_code":"0",
			"results":[{"url":"https://cdn.example.com/ima/data.mp4"}]
		}
	}`)

	got, err := adaptor.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult returned error: %v", err)
	}
	if got.Status != model.TaskStatusSuccess {
		t.Fatalf("Status = %q, want %q", got.Status, model.TaskStatusSuccess)
	}
	if got.TaskID != "ima_task_data_1" {
		t.Fatalf("TaskID = %q, want ima_task_data_1", got.TaskID)
	}
	if got.Url != "https://cdn.example.com/ima/data.mp4" {
		t.Fatalf("Url = %q, want https://cdn.example.com/ima/data.mp4", got.Url)
	}
}

func TestParseTaskResult_CompatResultURLFallbackPaths(t *testing.T) {
	adaptor := &TaskAdaptor{}
	tests := []struct {
		name string
		body string
		want string
	}{
		{
			name: "data_results_url",
			body: `{"task_status":"completed","task_code":"0","data":{"results":[{"url":"https://cdn.example.com/a.mp4"}]}}`,
			want: "https://cdn.example.com/a.mp4",
		},
		{
			name: "response_results_url",
			body: `{"task_status":"completed","task_code":"0","response":{"results":[{"url":"https://cdn.example.com/b.mp4"}]}}`,
			want: "https://cdn.example.com/b.mp4",
		},
		{
			name: "top_level_url",
			body: `{"task_status":"completed","task_code":"0","url":"https://cdn.example.com/c.mp4"}`,
			want: "https://cdn.example.com/c.mp4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := adaptor.ParseTaskResult([]byte(tt.body))
			if err != nil {
				t.Fatalf("ParseTaskResult returned error: %v", err)
			}
			if got.Status != model.TaskStatusSuccess {
				t.Fatalf("Status = %q, want %q", got.Status, model.TaskStatusSuccess)
			}
			if got.Url != tt.want {
				t.Fatalf("Url = %q, want %q", got.Url, tt.want)
			}
		})
	}
}

func TestIsTaskCodeFailure(t *testing.T) {
	tests := []struct {
		code string
		want bool
	}{
		{code: "", want: false},
		{code: "0", want: false},
		{code: "ok", want: false},
		{code: "completed", want: false},
		{code: "12", want: true},
		{code: "E_TIMEOUT", want: true},
	}

	for _, tt := range tests {
		if got := IsTaskCodeFailure(tt.code); got != tt.want {
			t.Fatalf("IsTaskCodeFailure(%q) = %v, want %v", tt.code, got, tt.want)
		}
	}
}
