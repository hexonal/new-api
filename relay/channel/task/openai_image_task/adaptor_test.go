package openai_image_task

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
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
