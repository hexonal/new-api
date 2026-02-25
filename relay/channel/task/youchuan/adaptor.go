package youchuan

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const (
	ChannelName       = "youchuan"
	DiffusionEndpoint = "/v1/tob/diffusion"
	TaskQueryEndpoint = "/v1/tob/task"
	DefaultVersion    = "v6.1"
)

var ModelList = []string{
	"yc_imagine",
	"yc_variation",
	"yc_upscale",
}


type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	appKey      string // x-youchuan-app
	secret      string // x-youchuan-secret
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl

	// apiKey format: "appKey|secret"
	parts := strings.SplitN(info.ApiKey, "|", 2)
	if len(parts) == 2 {
		a.appKey = strings.TrimSpace(parts[0])
		a.secret = strings.TrimSpace(parts[1])
	} else {
		a.appKey = info.ApiKey
	}
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionTextGenerate)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s%s", a.baseURL, DiffusionEndpoint), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-youchuan-app", a.appKey)
	req.Header.Set("x-youchuan-secret", a.secret)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req, ok := v.(relaycommon.TaskSubmitReq)
	if !ok {
		return nil, fmt.Errorf("invalid request type in context")
	}

	body, err := a.convertToRequestPayload(&req, info)
	if err != nil {
		return nil, err
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var ycResp YouchuanResponse
	if err := common.Unmarshal(responseBody, &ycResp); err != nil {
		taskErr = service.TaskErrorWrapper(err, "unmarshal_response_failed", http.StatusInternalServerError)
		return
	}
	if ycResp.Code != 0 {
		taskErr = service.TaskErrorWrapperLocal(
			fmt.Errorf("youchuan error: %s (code=%d)", ycResp.Message, ycResp.Code),
			"task_failed", http.StatusBadRequest,
		)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)

	return ycResp.Data.ID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	url := fmt.Sprintf("%s%s/%s", baseUrl, TaskQueryEndpoint, taskID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	// Parse appKey|secret from key
	parts := strings.SplitN(key, "|", 2)
	if len(parts) == 2 {
		req.Header.Set("x-youchuan-app", strings.TrimSpace(parts[0]))
		req.Header.Set("x-youchuan-secret", strings.TrimSpace(parts[1]))
	} else {
		req.Header.Set("x-youchuan-app", key)
	}
	req.Header.Set("Accept", "application/json")

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var result YouchuanResponse
	if err := common.Unmarshal(respBody, &result); err != nil {
		return nil, errors.Wrap(err, "unmarshal youchuan task result failed")
	}
	if result.Code != 0 {
		return &relaycommon.TaskInfo{
			Code:   result.Code,
			Reason: result.Message,
			Status: model.TaskStatusFailure,
		}, nil
	}

	ti := &relaycommon.TaskInfo{
		TaskID: result.Data.ID,
	}
	switch result.Data.Status {
	case StatusQueued:
		ti.Status = model.TaskStatusQueued
		ti.Progress = taskcommon.ProgressQueued
	case StatusProcessing:
		ti.Status = model.TaskStatusInProgress
		ti.Progress = taskcommon.ProgressInProgress
	case StatusSuccess:
		ti.Status = model.TaskStatusSuccess
		ti.Progress = taskcommon.ProgressComplete
		if len(result.Data.URLs) > 0 {
			ti.Url = result.Data.URLs[0]
		}
	case StatusFailed:
		ti.Status = model.TaskStatusFailure
		ti.Progress = taskcommon.ProgressComplete
		ti.Reason = "generation failed"
	case StatusAuditFail:
		ti.Status = model.TaskStatusFailure
		ti.Progress = taskcommon.ProgressComplete
		ti.Reason = "content audit failed"
	default:
		ti.Status = model.TaskStatusInProgress
		ti.Progress = taskcommon.ProgressQueued
	}
	return ti, nil
}

// ── helpers ──────────────────────────────────────────────────────

// convertToRequestPayload converts the generic TaskSubmitReq to a Youchuan DiffusionRequest.
// Parses MJ-style parameters from the prompt (--v, --ar, etc.).
func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (any, error) {
	prompt := req.Prompt
	version := DefaultVersion
	aspectRatio := ""

	// Parse MJ-style parameters from prompt
	prompt, params := parseMJParams(prompt)

	if v, ok := params["v"]; ok {
		version = "v" + v
	}
	if v, ok := params["version"]; ok {
		version = "v" + v
	}
	if ar, ok := params["ar"]; ok {
		aspectRatio = ar
	}
	if ar, ok := params["aspect"]; ok {
		aspectRatio = ar
	}

	// Pass through size field as aspect_ratio if not already set from prompt params
	if req.Size != "" && aspectRatio == "" {
		aspectRatio = req.Size
	}

	dr := &DiffusionRequest{
		Text:        strings.TrimSpace(prompt),
		Version:     version,
		AspectRatio: aspectRatio,
	}
	if err := taskcommon.UnmarshalMetadata(req.Metadata, dr); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	return dr, nil
}

// parseMJParams extracts --key value parameters from a MJ-style prompt.
// Returns the cleaned prompt and a map of extracted parameters.
var mjParamRegex = regexp.MustCompile(`--(\w+)\s+(\S+)`)

func parseMJParams(prompt string) (string, map[string]string) {
	params := make(map[string]string)
	matches := mjParamRegex.FindAllStringSubmatch(prompt, -1)
	for _, m := range matches {
		params[m[1]] = m[2]
	}
	cleaned := mjParamRegex.ReplaceAllString(prompt, "")
	return strings.TrimSpace(cleaned), params
}

