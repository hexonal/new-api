package sora

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type     string    `json:"type"`                // "text" or "image_url"
	Text     string    `json:"text,omitempty"`      // for text type
	ImageURL *ImageURL `json:"image_url,omitempty"` // for image_url type
}

type ImageURL struct {
	URL string `json:"url"`
}

type responseTask struct {
	ID                 string `json:"id"`
	TaskID             string `json:"task_id,omitempty"` //兼容旧接口
	Object             string `json:"object"`
	Model              string `json:"model"`
	Status             string `json:"status"`
	Progress           int    `json:"progress"`
	CreatedAt          int64  `json:"created_at"`
	CompletedAt        int64  `json:"completed_at,omitempty"`
	ExpiresAt          int64  `json:"expires_at,omitempty"`
	Seconds            string `json:"seconds,omitempty"`
	Size               string `json:"size,omitempty"`
	RemixedFromVideoID string `json:"remixed_from_video_id,omitempty"`
	Error              *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

type imaProPayload struct {
	TenantID     string             `json:"tenant_id"`
	UserID       string             `json:"user_id"`
	AppID        string             `json:"app_id"`
	AppKind      string             `json:"app_kind"`
	AigcCategory string             `json:"aigc_category"`
	CallbackURL  string             `json:"callback_url,omitempty"`
	Watermark    int                `json:"watermark"`
	WatermarkImg string             `json:"watermark_img,omitempty"`
	ModelVersion string             `json:"model_version_id"`
	Parameters   imaProPayloadParam `json:"parameters"`
}

type imaProPayloadParam struct {
	ElementList []imaProElement  `json:"element_list"`
	Audio       string           `json:"audio,omitempty"`
	MCPList     []map[string]any `json:"mcp_list,omitempty"`
	Resolution  string           `json:"resolution,omitempty"`
	AspectRatio string           `json:"aspect_ratio,omitempty"`
	Duration    int              `json:"duration,omitempty"`
}

type imaProElement struct {
	ReferenceType string             `json:"reference_type"`
	ReferenceRole string             `json:"reference_role,omitempty"`
	Prompt        string             `json:"prompt,omitempty"`
	Image         *imaProResourceURL `json:"image,omitempty"`
	Video         *imaProResourceURL `json:"video,omitempty"`
	Audio         *imaProResourceURL `json:"audio,omitempty"`
}

type imaProResourceURL struct {
	URL string `json:"url"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func validateRemixRequest(c *gin.Context) *dto.TaskError {
	var req relaycommon.TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("field prompt is required"), "invalid_request", http.StatusBadRequest)
	}
	if callbackURL := req.GetCallbackURL(); callbackURL != "" {
		if err := service.ValidateVideoTaskCallbackURL(callbackURL); err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_callback_url", http.StatusBadRequest)
		}
	}
	// 存储原始请求到 context，与 ValidateMultipartDirect 路径保持一致
	c.Set("task_request", req)
	return nil
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	if info.Action == constant.TaskActionRemix {
		return validateRemixRequest(c)
	}
	if taskErr = relaycommon.ValidateMultipartDirect(c, info); taskErr != nil {
		return taskErr
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if callbackURL := req.GetCallbackURL(); callbackURL != "" {
		if err := service.ValidateVideoTaskCallbackURL(callbackURL); err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_callback_url", http.StatusBadRequest)
		}
	}
	return nil
}

// EstimateBilling 根据用户请求的 seconds 和 size 计算 OtherRatios。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	// remix 路径的 OtherRatios 已在 ResolveOriginTask 中设置
	if info.Action == constant.TaskActionRemix {
		return nil
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}

	seconds, _ := strconv.Atoi(req.Seconds)
	if seconds == 0 {
		seconds = req.Duration
	}
	if seconds <= 0 {
		seconds = 4
	}

	size := req.Size
	if size == "" {
		size = "720x1280"
	}

	ratios := map[string]float64{
		"seconds": float64(seconds),
		"size":    1,
	}
	if size == "1792x1024" || size == "1024x1792" {
		ratios["size"] = 1.666667
	}
	return ratios
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.Action == constant.TaskActionRemix {
		return fmt.Sprintf("%s/v1/videos/%s/remix", a.baseURL, info.OriginTaskID), nil
	}
	return fmt.Sprintf("%s/v1/videos", a.baseURL), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	// ima-pro receives internally converted JSON payload; force JSON content type
	// regardless of the client-side OpenAI-style upload format.
	if a.ChannelType == constant.ChannelTypeImaPro {
		req.Header.Set("Content-Type", "application/json")
		return nil
	}
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	if a.ChannelType == constant.ChannelTypeImaPro {
		req, err := relaycommon.GetTaskRequest(c)
		if err != nil {
			return nil, errors.Wrap(err, "get_task_request_failed")
		}
		payload, err := buildImaProPayload(c, &req, info)
		if err != nil {
			return nil, errors.Wrap(err, "build_ima_pro_payload_failed")
		}
		data, err := common.Marshal(payload)
		if err != nil {
			return nil, errors.Wrap(err, "marshal_ima_pro_payload_failed")
		}
		return bytes.NewReader(data), nil
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_request_body_failed")
	}
	cachedBody, err := storage.Bytes()
	if err != nil {
		return nil, errors.Wrap(err, "read_body_bytes_failed")
	}
	contentType := c.GetHeader("Content-Type")

	if strings.HasPrefix(contentType, "application/json") {
		var bodyMap map[string]interface{}
		if err := common.Unmarshal(cachedBody, &bodyMap); err == nil {
			delete(bodyMap, "callback_url")
			delete(bodyMap, "notify_hook")
			bodyMap["model"] = info.UpstreamModelName
			if newBody, err := common.Marshal(bodyMap); err == nil {
				return bytes.NewReader(newBody), nil
			}
		}
		return bytes.NewReader(cachedBody), nil
	}

	if strings.Contains(contentType, "multipart/form-data") {
		formData, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return bytes.NewReader(cachedBody), nil
		}
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		writer.WriteField("model", info.UpstreamModelName)
		for key, values := range formData.Value {
			if key == "model" || key == "callback_url" || key == "notify_hook" {
				continue
			}
			for _, v := range values {
				writer.WriteField(key, v)
			}
		}
		for fieldName, fileHeaders := range formData.File {
			for _, fh := range fileHeaders {
				f, err := fh.Open()
				if err != nil {
					continue
				}
				ct := fh.Header.Get("Content-Type")
				if ct == "" || ct == "application/octet-stream" {
					buf512 := make([]byte, 512)
					n, _ := io.ReadFull(f, buf512)
					ct = http.DetectContentType(buf512[:n])
					// Re-open after sniffing so the full content is copied below
					f.Close()
					f, err = fh.Open()
					if err != nil {
						continue
					}
				}
				h := make(textproto.MIMEHeader)
				h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, fh.Filename))
				h.Set("Content-Type", ct)
				part, err := writer.CreatePart(h)
				if err != nil {
					f.Close()
					continue
				}
				io.Copy(part, f)
				f.Close()
			}
		}
		writer.Close()
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		return &buf, nil
	}

	return common.ReaderOnly(storage), nil
}

func buildImaProPayload(c *gin.Context, req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*imaProPayload, error) {
	if req == nil || info == nil {
		return nil, fmt.Errorf("invalid request context")
	}

	metadata := req.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}

	duration := resolveTaskDurationSeconds(req, metadata)
	resolution, aspectRatio := resolveResolutionAndAspectRatio(req, metadata)
	elements := buildImaProElementList(req, metadata)
	if len(elements) == 0 {
		return nil, fmt.Errorf("element_list is empty")
	}

	payload := &imaProPayload{
		TenantID:     pickStringWithDefault(metadata, "test", "tenant_id", "tenantId"),
		UserID:       resolveImaProUserID(c, metadata),
		AppID:        pickStringWithDefault(metadata, "new-api", "app_id", "appId"),
		AppKind:      pickStringWithDefault(metadata, "imagent", "app_kind", "appKind"),
		AigcCategory: pickStringWithDefault(metadata, resolveImaProCategory(req), "aigc_category", "aigcCategory"),
		CallbackURL:  req.GetCallbackURL(),
		Watermark:    resolveImaProWatermark(metadata),
		WatermarkImg: pickString(metadata, "watermark_img", "watermarkImg"),
		ModelVersion: taskcommon.DefaultString(info.UpstreamModelName, info.OriginModelName),
		Parameters: imaProPayloadParam{
			ElementList: elements,
			Audio:       resolveImaProAudioFlag(metadata),
			MCPList:     resolveImaProMCPList(metadata),
			Resolution:  resolution,
			AspectRatio: aspectRatio,
			Duration:    duration,
		},
	}

	if payload.UserID == "" {
		payload.UserID = "new-api-user"
	}
	if payload.ModelVersion == "" {
		payload.ModelVersion = "ima-pro"
	}
	return payload, nil
}

func buildImaProElementList(req *relaycommon.TaskSubmitReq, metadata map[string]any) []imaProElement {
	elements := make([]imaProElement, 0, 4)
	if prompt := strings.TrimSpace(req.Prompt); prompt != "" {
		elements = append(elements, imaProElement{
			ReferenceType: "text",
			Prompt:        prompt,
		})
	}

	imageURL := ""
	if len(req.Images) > 0 {
		imageURL = strings.TrimSpace(req.Images[0])
	}
	if imageURL == "" {
		imageURL = strings.TrimSpace(req.Image)
	}
	if imageURL == "" {
		imageURL = strings.TrimSpace(req.InputReference)
	}
	if imageURL != "" {
		elements = append(elements, imaProElement{
			ReferenceType: "image",
			ReferenceRole: "first_frame",
			Image:         &imaProResourceURL{URL: imageURL},
		})
	}

	videoURL := pickString(metadata, "reference_video_url", "referenceVideoUrl", "video_url", "videoUrl")
	if videoURL != "" {
		elements = append(elements, imaProElement{
			ReferenceType: "video",
			ReferenceRole: "reference_video",
			Video:         &imaProResourceURL{URL: videoURL},
		})
	}

	audioURL := pickString(metadata, "reference_audio_url", "referenceAudioUrl", "audio_url", "audioUrl")
	if audioURL != "" {
		elements = append(elements, imaProElement{
			ReferenceType: "audio",
			ReferenceRole: "reference_audio",
			Audio:         &imaProResourceURL{URL: audioURL},
		})
	}
	return elements
}

func resolveTaskDurationSeconds(req *relaycommon.TaskSubmitReq, metadata map[string]any) int {
	if req.Duration > 0 {
		return req.Duration
	}
	if n, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil && n > 0 {
		return n
	}
	if n := pickInt(metadata, "duration", "seconds"); n > 0 {
		return n
	}
	return 5
}

func resolveResolutionAndAspectRatio(req *relaycommon.TaskSubmitReq, metadata map[string]any) (string, string) {
	size := strings.TrimSpace(req.Size)
	if size == "" {
		size = pickString(metadata, "size")
	}
	if size != "" {
		if w, h, ok := parseWidthHeight(size); ok {
			return fmt.Sprintf("%dp", minInt(w, h)), toAspectRatio(w, h)
		}
	}

	resolution := pickStringWithDefault(metadata, "720p", "resolution")
	aspectRatio := pickStringWithDefault(metadata, "16:9", "aspect_ratio", "aspectRatio")
	return resolution, aspectRatio
}

func parseWidthHeight(size string) (int, int, bool) {
	parts := strings.Split(strings.TrimSpace(size), "x")
	if len(parts) != 2 {
		return 0, 0, false
	}
	w, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
	h, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return 0, 0, false
	}
	return w, h, true
}

func toAspectRatio(w int, h int) string {
	if w <= 0 || h <= 0 {
		return "16:9"
	}
	g := gcdInt(w, h)
	if g <= 0 {
		return "16:9"
	}
	return fmt.Sprintf("%d:%d", w/g, h/g)
}

func gcdInt(a int, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	if a < 0 {
		return -a
	}
	return a
}

func resolveImaProCategory(req *relaycommon.TaskSubmitReq) string {
	if req != nil && (req.HasImage() || strings.TrimSpace(req.Image) != "" || strings.TrimSpace(req.InputReference) != "") {
		return "image_to_video"
	}
	return "text_to_video"
}

func resolveImaProUserID(c *gin.Context, metadata map[string]any) string {
	if v := pickString(metadata, "user_id", "userId"); v != "" {
		return v
	}
	if c == nil {
		return ""
	}
	if username := strings.TrimSpace(c.GetString("username")); username != "" {
		return username
	}
	if uid := c.GetInt("id"); uid > 0 {
		return strconv.Itoa(uid)
	}
	return ""
}

func resolveImaProAudioFlag(metadata map[string]any) string {
	if v, ok := pickBool(metadata, "audio", "enable_audio", "enableAudio"); ok {
		if v {
			return "true"
		}
		return "false"
	}
	return ""
}

func resolveImaProMCPList(metadata map[string]any) []map[string]any {
	for _, key := range []string{"mcp_list", "mcpList"} {
		raw, ok := metadata[key]
		if !ok || raw == nil {
			continue
		}
		switch list := raw.(type) {
		case []map[string]any:
			return list
		case []any:
			out := make([]map[string]any, 0, len(list))
			for _, item := range list {
				m, ok := item.(map[string]any)
				if !ok {
					continue
				}
				out = append(out, m)
			}
			if len(out) > 0 {
				return out
			}
		}
	}
	return nil
}

func resolveImaProWatermark(metadata map[string]any) int {
	if n := pickInt(metadata, "watermark"); n > 0 {
		return 1
	}
	if v, ok := pickBool(metadata, "watermark", "watermark_enabled", "watermarkEnabled"); ok && v {
		return 1
	}
	return 0
}

func pickStringWithDefault(metadata map[string]any, defaultValue string, keys ...string) string {
	if v := pickString(metadata, keys...); v != "" {
		return v
	}
	return defaultValue
}

func pickString(metadata map[string]any, keys ...string) string {
	for _, key := range keys {
		raw, ok := metadata[key]
		if !ok || raw == nil {
			continue
		}
		switch v := raw.(type) {
		case string:
			if s := strings.TrimSpace(v); s != "" {
				return s
			}
		default:
			if s := strings.TrimSpace(fmt.Sprintf("%v", v)); s != "" && s != "<nil>" {
				return s
			}
		}
	}
	return ""
}

func pickInt(metadata map[string]any, keys ...string) int {
	for _, key := range keys {
		raw, ok := metadata[key]
		if !ok || raw == nil {
			continue
		}
		switch v := raw.(type) {
		case int:
			return v
		case int64:
			return int(v)
		case float64:
			return int(v)
		case string:
			if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
				return n
			}
		}
	}
	return 0
}

func pickBool(metadata map[string]any, keys ...string) (bool, bool) {
	for _, key := range keys {
		raw, ok := metadata[key]
		if !ok || raw == nil {
			continue
		}
		switch v := raw.(type) {
		case bool:
			return v, true
		case int:
			return v != 0, true
		case int64:
			return v != 0, true
		case float64:
			return v != 0, true
		case string:
			switch strings.ToLower(strings.TrimSpace(v)) {
			case "true", "1", "yes", "y":
				return true, true
			case "false", "0", "no", "n":
				return false, true
			}
		}
	}
	return false, false
}

func minInt(a int, b int) int {
	if a <= b {
		return a
	}
	return b
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	// Parse Sora response
	var dResp responseTask
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	upstreamID := dResp.ID
	if upstreamID == "" {
		upstreamID = dResp.TaskID
	}
	if upstreamID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	// 使用公开 task_xxxx ID 返回给客户端
	dResp.ID = info.PublicTaskID
	dResp.TaskID = info.PublicTaskID
	c.JSON(http.StatusOK, dResp)
	return upstreamID, responseBody, nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/v1/videos/%s", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+key)

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
	resTask := responseTask{}
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	switch resTask.Status {
	case "queued", "pending":
		taskResult.Status = model.TaskStatusQueued
	case "processing", "in_progress":
		taskResult.Status = model.TaskStatusInProgress
	case "completed":
		taskResult.Status = model.TaskStatusSuccess
		// Url intentionally left empty — the caller constructs the proxy URL using the public task ID
	case "failed", "cancelled":
		taskResult.Status = model.TaskStatusFailure
		if resTask.Error != nil {
			taskResult.Reason = resTask.Error.Message
		} else {
			taskResult.Reason = "task failed"
		}
	default:
	}
	if resTask.Progress > 0 && resTask.Progress < 100 {
		taskResult.Progress = fmt.Sprintf("%d%%", resTask.Progress)
	}
	taskResult.TotalTokens = extractTotalTokensFromResponse(respBody)

	return &taskResult, nil
}

// extractTotalTokensFromResponse reads optional token usage from known upstream response shapes.
// OpenAI-compatible providers are inconsistent for async video status payloads, so multiple paths are checked.
func extractTotalTokensFromResponse(respBody []byte) int {
	paths := []string{
		"usage.total_tokens",
		"response.usage.total_tokens",
		"data.usage.total_tokens",
		"metadata.total_tokens",
		"metadata.usage.total_tokens",
	}
	for _, path := range paths {
		v := gjson.GetBytes(respBody, path)
		if !v.Exists() {
			continue
		}
		if v.Type == gjson.Number {
			if n := int(v.Int()); n > 0 {
				return n
			}
			continue
		}
		if v.Type == gjson.String {
			if n, err := strconv.Atoi(strings.TrimSpace(v.String())); err == nil && n > 0 {
				return n
			}
		}
	}
	return 0
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	data := task.Data
	var err error
	if data, err = sjson.SetBytes(data, "id", task.TaskID); err != nil {
		return nil, errors.Wrap(err, "set id failed")
	}
	return data, nil
}
