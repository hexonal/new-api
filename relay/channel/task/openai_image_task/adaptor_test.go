package openai_image_task

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
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
