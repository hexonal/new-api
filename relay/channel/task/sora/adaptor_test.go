package sora

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
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
	if payload.UserID != "sk-current-user" {
		t.Fatalf("UserID = %q, want sk-current-user", payload.UserID)
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
