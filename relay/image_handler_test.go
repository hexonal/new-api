package relay

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestBuildSyncImageGenerationReqIncludesInputAndResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	imageReq := &dto.ImageRequest{
		Model:  "doubao-seedream-4-5-251128",
		Prompt: "a small cat under warm light",
		Size:   "1024x1024",
	}
	info := &relaycommon.RelayInfo{
		OriginModelName:       imageReq.Model,
		Request:               imageReq,
		FinalPreConsumedQuota: 120,
	}
	responseBody := `{"data":[{"url":"https://example.com/cat.png","revised_prompt":"cat"}],"created":1776260350}`
	service.SetLogOutputBody(c, responseBody)

	req := buildSyncImageGenerationReq(c, info, imageReq, &dto.Usage{
		PromptTokens:     1,
		CompletionTokens: 0,
		TotalTokens:      1,
	})

	assert.Equal(t, "image", req.Kind)
	assert.Equal(t, imageReq.Model, req.Model)
	assert.Contains(t, req.RequestBody, imageReq.Prompt)
	assert.Equal(t, responseBody, req.ResponseBody)
	assert.Equal(t, 120, req.Quota)
	assert.Equal(t, 1, req.TotalTokens)
}
