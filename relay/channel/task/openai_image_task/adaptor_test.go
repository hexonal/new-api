package openai_image_task

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
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

func TestBuildRequestURL_UsesIncomingVideosPath(t *testing.T) {
	a := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{RequestURLPath: "/v1/videos?model=wan2.6-t2v"}
	a.Init(info)
	a.baseURL = "http://ai-router.internal:8080"

	got, err := a.BuildRequestURL(info)
	if err != nil {
		t.Fatalf("BuildRequestURL err: %v", err)
	}

	want := "http://ai-router.internal:8080/v1/videos"
	if got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestBuildRequestHeaderSendsAIRouterUpstreamBaseURL(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey: "Bearer sk-dev",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				AIRouterUpstreamBaseURL: "https://dev-upstream.example.com/",
			},
		},
	}
	a := &TaskAdaptor{}
	a.Init(info)
	req := httptest.NewRequest(http.MethodPost, "/v1/images", nil)

	if err := a.BuildRequestHeader(nil, req, info); err != nil {
		t.Fatalf("BuildRequestHeader err: %v", err)
	}
	if got := req.Header.Get("Authorization"); got != "Bearer sk-dev" {
		t.Fatalf("Authorization got %q", got)
	}
	if got := req.Header.Get(aiRouterUpstreamBaseURLHeader); got != "https://dev-upstream.example.com" {
		t.Fatalf("%s got %q", aiRouterUpstreamBaseURLHeader, got)
	}
}

func TestFetchTaskSendsAIRouterUpstreamBaseURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/task_abc" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer sk-dev" {
			t.Fatalf("Authorization got %q", got)
		}
		if got := r.Header.Get(aiRouterUpstreamBaseURLHeader); got != "https://dev-upstream.example.com" {
			t.Fatalf("%s got %q", aiRouterUpstreamBaseURLHeader, got)
		}
		_, _ = w.Write([]byte(`{"code":"success","data":{"status":"succeeded"}}`))
	}))
	defer server.Close()

	resp, err := (&TaskAdaptor{}).FetchTask(server.URL, "sk-dev", map[string]any{
		"task_id":                  "task_abc",
		aiRouterUpstreamBaseURLKey: "https://dev-upstream.example.com/",
		"request_path":             "/v1/images",
	}, "")
	if err != nil {
		t.Fatalf("FetchTask err: %v", err)
	}
	_ = resp.Body.Close()
}

func TestResolveUpstreamPath(t *testing.T) {
	cases := []struct {
		name    string
		rawPath string
		want    string
	}{
		{name: "images", rawPath: "/v1/images", want: "/v1/images"},
		{name: "images with query", rawPath: "/v1/images?x=1", want: "/v1/images"},
		{name: "videos", rawPath: "/v1/videos", want: "/v1/videos"},
		{name: "videos with query", rawPath: "/v1/videos?x=1", want: "/v1/videos"},
		{name: "unknown", rawPath: "/foo", want: "/v1/images"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolveUpstreamPath(tc.rawPath); got != tc.want {
				t.Fatalf("resolveUpstreamPath(%q) = %q, want %q", tc.rawPath, got, tc.want)
			}
		})
	}
}

func TestResolveFetchPath(t *testing.T) {
	cases := []struct {
		name string
		body map[string]any
		want string
	}{
		{name: "image request path", body: map[string]any{"request_path": "/v1/images?x=1"}, want: "/v1/images"},
		{name: "video request path", body: map[string]any{"request_path": "/v1/videos"}, want: "/v1/videos"},
		{name: "video request path with query", body: map[string]any{"request_path": "/v1/videos?x=1", "action": "generate"}, want: "/v1/videos"},
		{name: "request path priority", body: map[string]any{"request_path": "/v1/images", "action": "videoGenerate"}, want: "/v1/images"},
		{name: "image action", body: map[string]any{"action": "imageGenerate"}, want: "/v1/images"},
		{name: "video action", body: map[string]any{"action": "videoGenerate"}, want: "/v1/videos"},
		{name: "default", body: map[string]any{}, want: "/v1/images"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolveFetchPath(tc.body); got != tc.want {
				t.Fatalf("resolveFetchPath(%v) = %q, want %q", tc.body, got, tc.want)
			}
		})
	}
}

func TestDoResponse_ExtractsUpstreamTaskID(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"id":"task_abc","task_id":"task_abc","object":"image","model":"wan2.6-t2i","status":"queued","created_at":1}`)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     http.Header{},
	}

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images", nil)

	info := &relaycommon.RelayInfo{
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			PublicTaskID: "task_public",
		},
	}

	taskID, _, errResp := a.DoResponse(c, resp, info)
	if errResp != nil {
		t.Fatalf("DoResponse err: %+v", errResp)
	}
	if taskID != "task_abc" {
		t.Fatalf("got upstream id %q, want task_abc", taskID)
	}
}

func TestParseTaskResult_StatusMapping(t *testing.T) {
	a := &TaskAdaptor{}
	cases := []struct {
		name     string
		body     string
		wantStat model.TaskStatus
		wantURL  string
	}{
		{"queued", `{"code":"success","data":{"status":"queued"}}`, model.TaskStatusQueued, ""},
		{"running", `{"code":"success","data":{"status":"running"}}`, model.TaskStatusInProgress, ""},
		{"succeeded", `{"code":"success","data":{"status":"succeeded","url":"https://x/y.png"}}`, model.TaskStatusSuccess, "https://x/y.png"},
		{"failed", `{"code":"success","data":{"status":"failed","error":"upstream timeout"}}`, model.TaskStatusFailure, ""},
		{"cancelled", `{"code":"success","data":{"status":"cancelled","error":"cancelled by user"}}`, model.TaskStatusFailure, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			info, err := a.ParseTaskResult([]byte(tc.body))
			if err != nil {
				t.Fatalf("err: %v", err)
			}
			if info.Status != string(tc.wantStat) {
				t.Fatalf("status got %s, want %s", info.Status, tc.wantStat)
			}
			if info.Url != tc.wantURL {
				t.Fatalf("url got %q, want %q", info.Url, tc.wantURL)
			}
		})
	}
}

func TestParseTaskResultFlatShape(t *testing.T) {
	body := []byte(`{"id":"task_a","status":"completed","metadata":{"url":"https://x/y.mp4"},"completed_at":123}`)
	info, err := (&TaskAdaptor{}).ParseTaskResult(body)
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != string(model.TaskStatusSuccess) {
		t.Fatalf("status=%s", info.Status)
	}
	if info.Url != "https://x/y.mp4" {
		t.Fatalf("url=%s", info.Url)
	}
}

type openAIVideoResponseForTest struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	VideoURL  string `json:"video_url"`
	CreatedAt int64  `json:"created_at"`
	Model     string `json:"model"`
	Code      string `json:"code"`
	Data      *struct {
		Status string `json:"status"`
		URL    string `json:"url"`
	} `json:"data"`
}

func TestConvertToOpenAIVideo(t *testing.T) {
	task := &model.Task{
		TaskID:    "task_xxx",
		CreatedAt: 1731000000,
		Properties: model.Properties{
			OriginModelName: "wan2.6-t2v",
		},
		Data: []byte(`{"code":"success","data":{"url":"https://oss/abc.mp4","status":"succeeded","task_id":"task_xxx"}}`),
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://oss/preferred.mp4",
		},
	}
	body, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo err: %v", err)
	}
	var got openAIVideoResponseForTest
	if err := common.Unmarshal(body, &got); err != nil {
		t.Fatalf("unmarshal body err: %v, body=%s", err, string(body))
	}
	if got.ID != "task_xxx" {
		t.Fatalf("unexpected id, got=%s body=%s", got.ID, string(body))
	}
	if got.Status != statusCompleted {
		t.Fatalf("unexpected status, got=%s body=%s", got.Status, string(body))
	}
	if got.VideoURL != "https://oss/preferred.mp4" {
		t.Fatalf("unexpected video_url, got=%s body=%s", got.VideoURL, string(body))
	}
	if got.CreatedAt != 1731000000 {
		t.Fatalf("unexpected created_at, got=%d body=%s", got.CreatedAt, string(body))
	}
	if got.Model != "wan2.6-t2v" {
		t.Fatalf("unexpected model, got=%s body=%s", got.Model, string(body))
	}
	if got.Code != "" || got.Data != nil {
		t.Fatalf("response should not preserve ai-router envelope, body=%s", string(body))
	}
}

func TestConvertToOpenAIVideoFlatShape(t *testing.T) {
	task := &model.Task{
		TaskID: "task_xxx",
		Data:   []byte(`{"id":"task_a","status":"completed","metadata":{"url":"https://x/y.mp4"},"completed_at":123}`),
	}
	body, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatal(err)
	}
	var got openAIVideoResponseForTest
	if err := common.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	if got.Status != statusCompleted {
		t.Fatalf("status=%s", got.Status)
	}
	if got.VideoURL != "https://x/y.mp4" {
		t.Fatalf("url=%s", got.VideoURL)
	}
}

func TestConvertToOpenAIVideoFallbackOnInvalidEnvelope(t *testing.T) {
	task := &model.Task{
		TaskID: "task_bad",
		Data:   []byte(`{`),
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://oss/fallback.mp4",
		},
	}
	body, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo err: %v", err)
	}
	var got openAIVideoResponseForTest
	if err := common.Unmarshal(body, &got); err != nil {
		t.Fatalf("unmarshal body err: %v, body=%s", err, string(body))
	}
	if got.ID != "task_bad" {
		t.Fatalf("unexpected id, got=%s body=%s", got.ID, string(body))
	}
	if got.Status != statusQueued {
		t.Fatalf("unexpected fallback status, got=%s body=%s", got.Status, string(body))
	}
	if got.VideoURL != "https://oss/fallback.mp4" {
		t.Fatalf("unexpected fallback video_url, got=%s body=%s", got.VideoURL, string(body))
	}
	if got.Code != "" || got.Data != nil {
		t.Fatalf("fallback response should not preserve ai-router envelope, body=%s", string(body))
	}
}
