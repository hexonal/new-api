package openai_image_task

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// TaskAdaptor 处理 OpenAI 兼容异步图片和视频任务。
type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL         string
	apiKey          string
	upstreamBaseURL string
}

const (
	aiRouterUpstreamBaseURLHeader = "X-Upstream-Base-URL"
	aiRouterUpstreamBaseURLKey    = "ai_router_upstream_base_url"
)

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	if info == nil || info.ChannelMeta == nil {
		return
	}
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
	a.apiKey = info.ApiKey
	a.upstreamBaseURL = normalizeOptionalURL(info.ChannelOtherSettings.AIRouterUpstreamBaseURL)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	return nil
}

func (a *TaskAdaptor) AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64 {
	return nil
}

func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	return 0
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if a.baseURL == "" {
		return "", fmt.Errorf("base url is empty")
	}
	rawPath := ""
	if info != nil {
		rawPath = info.RequestURLPath
	}
	return a.baseURL + resolveUpstreamPath(rawPath), nil
}

// resolveUpstreamPath 从请求路径提取 ai-router 上游路径。
func resolveUpstreamPath(rawPath string) string {
	pathOnly := rawPath
	if idx := strings.Index(rawPath, "?"); idx >= 0 {
		pathOnly = rawPath[:idx]
	}
	if strings.HasPrefix(pathOnly, "/v1/videos") {
		return "/v1/videos"
	}
	return "/v1/images"
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	if auth := formatBearerAuthorization(a.apiKey); auth != "" {
		req.Header.Set("Authorization", auth)
	}
	setAIRouterUpstreamBaseURLHeader(req, a.upstreamBaseURL)
	if c != nil && c.Request != nil {
		if contentType := c.Request.Header.Get("Content-Type"); contentType != "" {
			req.Header.Set("Content-Type", contentType)
		}
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	return common.ReaderOnly(storage), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *dto.TaskError) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var parsed submitResponse
	if err := common.Unmarshal(body, &parsed); err != nil {
		return "", nil, service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", body), "unmarshal_response_body_failed", http.StatusInternalServerError)
	}

	upstreamID := strings.TrimSpace(parsed.TaskID)
	if upstreamID == "" {
		upstreamID = strings.TrimSpace(parsed.ID)
	}
	if upstreamID == "" {
		return "", nil, service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
	}

	if info != nil && info.TaskRelayInfo != nil && strings.TrimSpace(info.TaskRelayInfo.PublicTaskID) != "" {
		publicID := strings.TrimSpace(info.TaskRelayInfo.PublicTaskID)
		parsed.ID = publicID
		parsed.TaskID = publicID
	}
	c.JSON(http.StatusOK, parsed)
	return upstreamID, body, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	upstreamPath := resolveFetchPath(body)
	uri := fmt.Sprintf("%s%s/%s", strings.TrimRight(baseUrl, "/"), upstreamPath, strings.TrimSpace(taskID))
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	if auth := formatBearerAuthorization(key); auth != "" {
		req.Header.Set("Authorization", auth)
	}
	setAIRouterUpstreamBaseURLHeader(req, aiRouterUpstreamBaseURLFromBody(body))

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func formatBearerAuthorization(key string) string {
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(key), "bearer ") {
		return key
	}
	return "Bearer " + key
}

func normalizeOptionalURL(value string) string {
	return strings.TrimRight(strings.TrimSpace(value), "/")
}

func setAIRouterUpstreamBaseURLHeader(req *http.Request, value string) {
	value = normalizeOptionalURL(value)
	if req == nil || value == "" {
		return
	}
	req.Header.Set(aiRouterUpstreamBaseURLHeader, value)
}

func aiRouterUpstreamBaseURLFromBody(body map[string]any) string {
	if body == nil {
		return ""
	}
	if value, ok := body[aiRouterUpstreamBaseURLKey].(string); ok {
		return value
	}
	return ""
}

// resolveFetchPath 根据任务上下文决定轮询上游 GET 路径。
func resolveFetchPath(body map[string]any) string {
	if requestPath, ok := body["request_path"].(string); ok && strings.TrimSpace(requestPath) != "" {
		return resolveUpstreamPath(requestPath)
	}
	if action, ok := body["action"].(string); ok && strings.Contains(strings.ToLower(action), "video") {
		return "/v1/videos"
	}
	return "/v1/images"
}

func convertToOpenAIVideoStatus(status string) string {
	switch status {
	case statusQueued:
		return statusQueued
	case statusProcessing, statusInProgress, statusRunning:
		return statusInProgress
	case statusSucceeded, statusCompleted:
		return statusCompleted
	case statusFailed, statusCancelled:
		return statusFailed
	default:
		return statusQueued
	}
}

func pickURL(candidates ...string) string {
	for _, u := range candidates {
		if v := strings.TrimSpace(u); v != "" {
			return v
		}
	}
	return ""
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	type openAIVideoEnvelope struct {
		Code string `json:"code"`
		Data struct {
			Status string `json:"status"`
			URL    string `json:"url"`
		} `json:"data"`
	}

	response := map[string]any{
		"id":     task.TaskID,
		"status": statusQueued,
	}
	if task.CreatedAt != 0 {
		response["created_at"] = task.CreatedAt
	}
	if modelName := strings.TrimSpace(task.Properties.OriginModelName); modelName != "" {
		response["model"] = modelName
	}

	var parsed openAIVideoEnvelope
	parseErr := common.Unmarshal(task.Data, &parsed)
	if parseErr == nil && parsed.Data.Status != "" {
		response["status"] = convertToOpenAIVideoStatus(parsed.Data.Status)
	} else {
		var flat fetchFlatResponse
		if err := common.Unmarshal(task.Data, &flat); err == nil && flat.Status != "" {
			response["status"] = convertToOpenAIVideoStatus(flat.Status)
			if url := pickURL(task.GetResultURL(), flat.VideoURL, flat.URL, flat.Metadata.URL, parsed.Data.URL); url != "" {
				response["video_url"] = url
			}
			return common.Marshal(response)
		}
	}

	if url := pickURL(task.GetResultURL(), parsed.Data.URL); url != "" {
		response["video_url"] = url
	}

	return common.Marshal(response)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var parsed fetchResponse
	if err := common.Unmarshal(respBody, &parsed); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	info := &relaycommon.TaskInfo{
		Code: 0,
	}
	if parsed.Data.Status == "" {
		var flat fetchFlatResponse
		if err := common.Unmarshal(respBody, &flat); err == nil && flat.Status != "" {
			switch flat.Status {
			case statusQueued:
				info.Status = string(model.TaskStatusQueued)
			case statusProcessing, statusInProgress, statusRunning:
				info.Status = string(model.TaskStatusInProgress)
			case statusSucceeded, statusCompleted:
				info.Status = string(model.TaskStatusSuccess)
				info.Url = pickURL(flat.URL, flat.VideoURL, flat.Metadata.URL)
			case statusFailed, statusCancelled:
				info.Status = string(model.TaskStatusFailure)
				if flat.Error != nil {
					info.Reason = strings.TrimSpace(*flat.Error)
				}
			default:
				info.Status = string(model.TaskStatusUnknown)
			}
			return info, nil
		}
	}

	switch parsed.Data.Status {
	case statusQueued:
		info.Status = string(model.TaskStatusQueued)
	case statusProcessing, statusInProgress, statusRunning:
		info.Status = string(model.TaskStatusInProgress)
	case statusSucceeded, statusCompleted:
		info.Status = string(model.TaskStatusSuccess)
		info.Url = pickURL(parsed.Data.URL)
	case statusFailed, statusCancelled:
		info.Status = string(model.TaskStatusFailure)
		if parsed.Data.Error != nil {
			info.Reason = strings.TrimSpace(*parsed.Data.Error)
		}
	default:
		info.Status = string(model.TaskStatusUnknown)
	}
	return info, nil
}

var _ channel.TaskAdaptor = (*TaskAdaptor)(nil)
var _ channel.OpenAIVideoConverter = (*TaskAdaptor)(nil)
