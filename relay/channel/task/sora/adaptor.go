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
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/tidwall/gjson"
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
	TenantID string `json:"tenant_id"`
	UserID   string `json:"user_id"`
	AppID    string `json:"app_id"`
	AppKind  string `json:"app_kind"`
	// IDTask mirrors New API public task_id for upstream traceability.
	IDTask string `json:"id_task,omitempty"`
	// TaskID is the New API public task_id, passed through for upstream troubleshooting traceability.
	TaskID       string             `json:"task_id,omitempty"`
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

const (
	imaProCreatePath      = "/api/v1/aigc/task/create"
	imaProQueryPath       = "/api/v1/aigc/task/query"
	imaProLegacyFetchPath = "/v1/videos/%s"
)

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) isImaProFamily() bool {
	return constant.IsImaProChannelType(a.ChannelType)
}

func isImaImageGenerationModel(model string) bool {
	switch strings.ToLower(strings.TrimSpace(model)) {
	case "gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview":
		return true
	default:
		return false
	}
}

func validateRemixRequest(c *gin.Context, validateCallback bool) *dto.TaskError {
	var req relaycommon.TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("field prompt is required"), "invalid_request", http.StatusBadRequest)
	}
	if validateCallback {
		if callbackURL := req.GetCallbackURL(); callbackURL != "" {
			if err := service.ValidateVideoTaskCallbackURL(callbackURL); err != nil {
				return service.TaskErrorWrapperLocal(err, "invalid_callback_url", http.StatusBadRequest)
			}
		}
	}
	// 存储原始请求到 context，与 ValidateMultipartDirect 路径保持一致
	c.Set("task_request", req)
	return nil
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	if info.Action == constant.TaskActionRemix {
		return validateRemixRequest(c, !a.isImaProFamily())
	}
	if taskErr = relaycommon.ValidateMultipartDirect(c, info); taskErr != nil {
		return taskErr
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if !a.isImaProFamily() {
		if callbackURL := req.GetCallbackURL(); callbackURL != "" {
			if err := service.ValidateVideoTaskCallbackURL(callbackURL); err != nil {
				return service.TaskErrorWrapperLocal(err, "invalid_callback_url", http.StatusBadRequest)
			}
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
	if info != nil && info.TaskRelayInfo != nil && info.Action == constant.TaskActionRemix {
		if a.isImaProFamily() {
			return "", fmt.Errorf("ima-pro does not support remix")
		}
		return fmt.Sprintf("%s/v1/videos/%s/remix", a.baseURL, info.OriginTaskID), nil
	}
	if a.isImaProFamily() {
		return fmt.Sprintf("%s%s", a.baseURL, imaProCreatePath), nil
	}
	return fmt.Sprintf("%s/v1/videos", a.baseURL), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	if info != nil && info.TaskRelayInfo != nil {
		if publicTaskID := strings.TrimSpace(info.TaskRelayInfo.PublicTaskID); publicTaskID != "" {
			// Pass public task id downstream for traceability without exposing upstream IDs.
			req.Header.Set("X-New-Api-Task-Id", publicTaskID)
		}
	}
	// ima-pro receives internally converted JSON payload; force JSON content type
	// regardless of the client-side OpenAI-style upload format.
	if a.isImaProFamily() {
		req.Header.Set("Content-Type", "application/json")
		return nil
	}
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	if a.isImaProFamily() {
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
	elements, err := buildImaProElementList(req, metadata)
	if err != nil {
		return nil, err
	}
	if len(elements) == 0 {
		return nil, fmt.Errorf("element_list is empty")
	}

	requestPath := ""
	if c != nil && c.Request != nil && c.Request.URL != nil {
		requestPath = c.Request.URL.Path
	}
	upstreamModelVersion := strings.TrimSpace(info.UpstreamModelName)
	if upstreamModelVersion == "" {
		upstreamModelVersion = strings.TrimSpace(info.OriginModelName)
	}
	if strings.HasPrefix(requestPath, "/v1/images/generations") && !isImaImageGenerationModel(upstreamModelVersion) {
		return nil, fmt.Errorf("model must use upstream id: gemini-3-pro-image-preview or gemini-3.1-flash-image-preview")
	}
	callbackURL, err := resolveImaProUpstreamCallbackURL(info)
	if err != nil {
		return nil, err
	}
	payload := &imaProPayload{
		IDTask:       resolveImaProTraceTaskID(info),
		TenantID:     resolveImaProTenantID(info, metadata),
		UserID:       resolveImaProUserID(c, info, metadata),
		AppID:        resolveImaProAppID(info, metadata),
		AppKind:      resolveImaProAppKind(info, metadata),
		TaskID:       resolveImaProTraceTaskID(info),
		AigcCategory: pickStringWithDefault(
			metadata,
			resolveImaProCategory(req, upstreamModelVersion),
			"aigc_category",
			"aigcCategory",
		),
		// callback_url is disabled for domestic IMA Pro contract and enabled for overseas channel.
		// Clients can still poll task status via /v1/videos/{task_id}.
		CallbackURL:  callbackURL,
		Watermark:    resolveImaProWatermark(metadata),
		WatermarkImg: "",
		ModelVersion: upstreamModelVersion,
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
	if payload.ModelVersion == "" && !strings.HasPrefix(requestPath, "/v1/images/generations") {
		payload.ModelVersion = "ima-pro"
	}
	return payload, nil
}

func resolveImaProUpstreamCallbackURL(info *relaycommon.RelayInfo) (string, error) {
	if info == nil || info.ChannelType != constant.ChannelTypeImaProOverseas {
		return "", nil
	}
	serverAddr := strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/")
	if serverAddr == "" {
		return "", fmt.Errorf("ima-pro-overseas requires non-empty server address for callback_url")
	}
	callbackURL := serverAddr + "/ima-pro-overseas/notify"
	if err := service.ValidateVideoTaskCallbackURL(callbackURL); err != nil {
		return "", fmt.Errorf("invalid ima-pro-overseas callback_url: %w", err)
	}
	return callbackURL, nil
}

func buildImaProElementList(req *relaycommon.TaskSubmitReq, metadata map[string]any) ([]imaProElement, error) {
	elements := make([]imaProElement, 0, 4)
	if prompt := strings.TrimSpace(req.Prompt); prompt != "" {
		elements = append(elements, imaProElement{
			ReferenceType: "text",
			Prompt:        prompt,
		})
	}

	videoURLs := collectImaProMediaURLs(
		metadata,
		"reference_video_urls",
		"video_urls",
		"reference_video_url",
		"video_url",
	)
	audioURLs := collectImaProMediaURLs(
		metadata,
		"reference_audio_urls",
		"audio_urls",
		"reference_audio_url",
		"audio_url",
	)
	imageRoleMode := strings.ToLower(strings.TrimSpace(
		pickString(metadata, "role_mode", "roleMode", "image_role_mode", "imageRoleMode"),
	))
	if imageRoleMode == "" {
		imageRoleMode = "reference"
	}
	if imageRoleMode != "reference" && imageRoleMode != "frame" {
		return nil, fmt.Errorf("metadata.role_mode must be one of [reference, frame]")
	}

	imageURLs := collectImaProImageURLs(req)
	hasReferenceMedia := len(videoURLs) > 0 || len(audioURLs) > 0
	if imageRoleMode == "frame" {
		if len(imageURLs) == 0 {
			return nil, fmt.Errorf("frame mode requires at least one image")
		}
		if len(imageURLs) > 2 {
			return nil, fmt.Errorf("frame mode supports up to 2 images")
		}
		if hasReferenceMedia {
			return nil, fmt.Errorf("frame mode cannot be mixed with reference video/audio")
		}
	}

	for i, imageURL := range imageURLs {
		role := "reference_image"
		if imageRoleMode == "frame" {
			if len(imageURLs) == 1 || i == 0 {
				role = "first_frame"
			} else if i == len(imageURLs)-1 {
				role = "last_frame"
			}
		}
		elements = append(elements, imaProElement{
			ReferenceType: "image",
			ReferenceRole: role,
			Image:         &imaProResourceURL{URL: imageURL},
		})
	}

	for _, videoURL := range videoURLs {
		elements = append(elements, imaProElement{
			ReferenceType: "video",
			ReferenceRole: "reference_video",
			Video:         &imaProResourceURL{URL: videoURL},
		})
	}

	for _, audioURL := range audioURLs {
		elements = append(elements, imaProElement{
			ReferenceType: "audio",
			ReferenceRole: "reference_audio",
			Audio:         &imaProResourceURL{URL: audioURL},
		})
	}
	return elements, nil
}

func resolveImaProTraceTaskID(info *relaycommon.RelayInfo) string {
	if info == nil || info.TaskRelayInfo == nil {
		return ""
	}
	return strings.TrimSpace(info.TaskRelayInfo.PublicTaskID)
}

func collectImaProImageURLs(req *relaycommon.TaskSubmitReq) []string {
	urls := make([]string, 0, len(req.Images))
	for _, image := range req.Images {
		urls = appendUniqueURL(urls, image)
	}
	// Backward-compatible fallbacks: only used when images is empty.
	if len(urls) == 0 {
		urls = appendUniqueURL(urls, req.Image)
	}
	if len(urls) == 0 {
		urls = appendUniqueURL(urls, req.InputReference)
	}
	return urls
}

func collectImaProMediaURLs(metadata map[string]any, keys ...string) []string {
	urls := make([]string, 0, 4)
	for _, key := range keys {
		raw, ok := metadata[key]
		if !ok || raw == nil {
			continue
		}
		switch list := raw.(type) {
		case []string:
			for _, item := range list {
				urls = appendUniqueURL(urls, item)
			}
		case []any:
			for _, item := range list {
				urls = appendUniqueURL(urls, parseResourceURL(item))
			}
		default:
			// Be tolerant for incorrectly sent single values.
			urls = appendUniqueURL(urls, parseResourceURL(list))
		}
	}
	return urls
}

func parseResourceURL(raw any) string {
	switch v := raw.(type) {
	case string:
		return strings.TrimSpace(v)
	case map[string]any:
		if url, ok := v["url"].(string); ok {
			return strings.TrimSpace(url)
		}
	case map[string]string:
		if url, ok := v["url"]; ok {
			return strings.TrimSpace(url)
		}
	}
	return ""
}

func appendUniqueURL(dst []string, candidate string) []string {
	candidate = strings.TrimSpace(candidate)
	if candidate == "" {
		return dst
	}
	for _, existed := range dst {
		if existed == candidate {
			return dst
		}
	}
	return append(dst, candidate)
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
	aspectRatio := strings.TrimSpace(req.AspectRatio)
	if aspectRatio == "" {
		aspectRatio = pickStringWithDefault(metadata, "16:9", "aspect_ratio", "aspectRatio")
	}
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

func resolveImaProCategory(req *relaycommon.TaskSubmitReq, modelName string) string {
	if isImaImageGenerationModel(modelName) {
		if req != nil && (req.HasImage() || strings.TrimSpace(req.Image) != "" || strings.TrimSpace(req.InputReference) != "") {
			return "image_to_image"
		}
		return "text_to_image"
	}
	if req != nil && (req.HasImage() || strings.TrimSpace(req.Image) != "" || strings.TrimSpace(req.InputReference) != "") {
		return "image_to_video"
	}
	return "text_to_video"
}

func resolveImaProTenantID(info *relaycommon.RelayInfo, metadata map[string]any) string {
	if info != nil {
		if v := strings.TrimSpace(info.ChannelSetting.ImaProTenantID); v != "" {
			return v
		}
	}
	return pickStringWithDefault(metadata, "test", "tenant_id", "tenantId")
}

func resolveImaProAppID(info *relaycommon.RelayInfo, metadata map[string]any) string {
	if info != nil {
		if v := strings.TrimSpace(info.ChannelSetting.ImaProAppID); v != "" {
			return v
		}
	}
	return pickStringWithDefault(metadata, "new-api", "app_id", "appId")
}

func resolveImaProAppKind(info *relaycommon.RelayInfo, metadata map[string]any) string {
	if info != nil {
		if v := strings.TrimSpace(info.ChannelSetting.ImaProAppKind); v != "" {
			return v
		}
	}
	return pickStringWithDefault(metadata, "imagent", "app_kind", "appKind")
}

func resolveImaProUserID(c *gin.Context, info *relaycommon.RelayInfo, metadata map[string]any) string {
	if info != nil && info.TaskRelayInfo != nil {
		// user_id is intentionally bound to New API public task_id for upstream traceability.
		if v := strings.TrimSpace(info.TaskRelayInfo.PublicTaskID); v != "" {
			return v
		}
	}
	if info != nil {
		// Fallback for legacy flows without pre-generated public task id.
		if v := strings.TrimSpace(info.TokenKey); v != "" {
			return v
		}
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

	// Parse upstream response and support both:
	// 1) OpenAI-style top-level {id/task_id/...}
	// 2) IMA wrapped submit response {code,data:{id_task,...},...}
	var dResp responseTask
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	if upstreamErr := parseImaSubmitError(responseBody, resp.StatusCode); upstreamErr != nil {
		taskErr = upstreamErr
		return
	}

	upstreamID := firstNonEmptyValue(
		strings.TrimSpace(dResp.ID),
		strings.TrimSpace(dResp.TaskID),
		strings.TrimSpace(gjson.GetBytes(responseBody, "data.id_task").String()),
		strings.TrimSpace(gjson.GetBytes(responseBody, "id_task").String()),
		strings.TrimSpace(gjson.GetBytes(responseBody, "data.task_id").String()),
		strings.TrimSpace(gjson.GetBytes(responseBody, "task_id").String()),
	)
	if upstreamID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	// 使用公开 task_xxxx ID 返回给客户端
	dResp.ID = info.PublicTaskID
	dResp.TaskID = info.PublicTaskID
	if strings.TrimSpace(dResp.Object) == "" {
		if isImaImageGenerationModel(strings.TrimSpace(info.UpstreamModelName)) {
			dResp.Object = "image"
		} else {
			dResp.Object = "video"
		}
	}
	if strings.TrimSpace(dResp.Model) == "" && strings.TrimSpace(info.UpstreamModelName) != "" {
		dResp.Model = strings.TrimSpace(info.UpstreamModelName)
	}
	if dResp.CreatedAt == 0 {
		dResp.CreatedAt = time.Now().Unix()
	}
	c.JSON(http.StatusOK, dResp)
	return upstreamID, responseBody, nil
}

func parseImaSubmitError(body []byte, upstreamStatus int) *dto.TaskError {
	errorValue := gjson.GetBytes(body, "error")
	msg := ""
	if errorValue.Exists() {
		if errorValue.Type == gjson.String {
			msg = strings.TrimSpace(errorValue.String())
		}
		if msg == "" {
			msg = strings.TrimSpace(gjson.GetBytes(body, "error.message").String())
		}
		if msg == "" {
			msg = strings.TrimSpace(gjson.GetBytes(body, "error.msg").String())
		}
	}

	codeVal := gjson.GetBytes(body, "code")
	topCode, hasTopCode := parseResponseCode(codeVal)
	topMessage := strings.TrimSpace(gjson.GetBytes(body, "message").String())
	if msg == "" && hasTopCode && topCode != 0 && topCode != 200 {
		msg = topMessage
		if msg == "" {
			msg = "upstream request failed"
		}
	}
	if msg == "" {
		return nil
	}

	errorCode := strings.TrimSpace(gjson.GetBytes(body, "error.code").String())
	errorType := strings.ToLower(strings.TrimSpace(gjson.GetBytes(body, "error.type").String()))
	if errorCode == "" && hasTopCode && topCode != 0 && topCode != 200 {
		errorCode = strconv.Itoa(topCode)
	}
	if errorCode == "" {
		errorCode = "upstream_error"
	}

	statusCode := upstreamStatus
	if statusCode < http.StatusBadRequest {
		statusCode = deriveSubmitErrorHTTPStatus(errorCode, errorType, topCode)
	}
	if statusCode < http.StatusBadRequest {
		statusCode = http.StatusBadRequest
	}
	return service.TaskErrorWrapperLocal(fmt.Errorf("%s", msg), errorCode, statusCode)
}

func parseResponseCode(v gjson.Result) (int, bool) {
	if !v.Exists() {
		return 0, false
	}
	if v.Type == gjson.Number {
		return int(v.Int()), true
	}
	raw := strings.TrimSpace(v.String())
	if raw == "" {
		return 0, false
	}
	if n, err := strconv.Atoi(raw); err == nil {
		return n, true
	}
	switch strings.ToLower(raw) {
	case "ok", "success", "succeeded", "completed":
		return 200, true
	}
	return 0, false
}

func deriveSubmitErrorHTTPStatus(errorCode string, errorType string, topCode int) int {
	if topCode >= 400 && topCode < 600 {
		return topCode
	}
	normalized := strings.ToLower(strings.TrimSpace(errorCode + " " + errorType))
	switch {
	case strings.Contains(normalized, "badrequest"), strings.Contains(normalized, "invalid"):
		return http.StatusBadRequest
	case strings.Contains(normalized, "unauthorized"), strings.Contains(normalized, "auth"):
		return http.StatusUnauthorized
	case strings.Contains(normalized, "forbidden"):
		return http.StatusForbidden
	case strings.Contains(normalized, "notfound"), strings.Contains(normalized, "not_found"):
		return http.StatusNotFound
	case strings.Contains(normalized, "ratelimit"), strings.Contains(normalized, "too_many"):
		return http.StatusTooManyRequests
	default:
		return http.StatusBadRequest
	}
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	if client == nil {
		// Keep fetch path resilient in unit tests and minimal-runtime setups
		// where proxy client may not be initialized.
		client = http.DefaultClient
	}

	if a.isImaProFamily() {
		// Prefer provider-native query endpoint; fallback to legacy OpenAI-style path
		// for backward compatibility with older IMA bridge deployments.
		resp, err := a.fetchImaProTaskByPost(baseUrl, key, taskID, client)
		if err == nil && (resp.StatusCode < http.StatusBadRequest || !isEndpointNotFound(resp.StatusCode)) {
			return resp, nil
		}
		if resp != nil && isEndpointNotFound(resp.StatusCode) {
			_ = resp.Body.Close()
			resp = nil
		}
		resp, err = a.fetchImaProTaskByGet(baseUrl, key, taskID, client)
		if err == nil && (resp.StatusCode < http.StatusBadRequest || !isEndpointNotFound(resp.StatusCode)) {
			return resp, nil
		}
		if resp != nil && isEndpointNotFound(resp.StatusCode) {
			_ = resp.Body.Close()
		}
		return a.fetchLegacyVideoTask(baseUrl, key, taskID, client)
	}

	return a.fetchLegacyVideoTask(baseUrl, key, taskID, client)
}

func (a *TaskAdaptor) fetchImaProTaskByPost(baseURL, key, taskID string, client *http.Client) (*http.Response, error) {
	body := map[string]any{
		"id_task": taskID,
		"task_id": taskID,
	}
	payload, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	uri := fmt.Sprintf("%s%s", baseURL, imaProQueryPath)
	req, err := http.NewRequest(http.MethodPost, uri, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	return client.Do(req)
}

func (a *TaskAdaptor) fetchImaProTaskByGet(baseURL, key, taskID string, client *http.Client) (*http.Response, error) {
	uri := fmt.Sprintf("%s%s?id_task=%s", baseURL, imaProQueryPath, taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	return client.Do(req)
}

func (a *TaskAdaptor) fetchLegacyVideoTask(baseURL, key, taskID string, client *http.Client) (*http.Response, error) {
	uri := fmt.Sprintf("%s"+imaProLegacyFetchPath, baseURL, taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	return client.Do(req)
}

func isEndpointNotFound(statusCode int) bool {
	return statusCode == http.StatusNotFound || statusCode == http.StatusMethodNotAllowed
}

func (a *TaskAdaptor) GetModelList() []string {
	if a.isImaProFamily() {
		return IMAProModelList
	}
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	if a.isImaProFamily() {
		return "ima_pro"
	}
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
	taskCode := extractSoraTaskCode(respBody)

	statusRaw := strings.TrimSpace(resTask.Status)
	if statusRaw == "" {
		statusRaw = extractFirstNonEmptyString(respBody,
			"task_status",
			"data.task_status",
			"response.task_status",
		)
	}
	taskResult.Status = normalizeSoraTaskStatus(statusRaw)

	// ima-pro callback may return provider-specific task_code.
	// Treat non-zero / non-success task_code as terminal failure, even when
	// task_status is missing or incorrectly set to completed by upstream.
	if IsTaskCodeFailure(taskCode) {
		taskResult.Status = model.TaskStatusFailure
	}

	if taskResult.Status == model.TaskStatusSuccess {
		// Support callback/query payloads that carry direct result URL.
		for _, path := range []string{
			"results.0.url",
			"data.results.0.url",
			"response.results.0.url",
			"url",
		} {
			if v := strings.TrimSpace(gjson.GetBytes(respBody, path).String()); v != "" {
				taskResult.Url = v
				break
			}
		}
	}

	if taskResult.Status == model.TaskStatusFailure {
		taskResult.Reason = extractImaFailureReason(respBody, resTask.Error, taskCode)
	}

	taskResult.TaskID = strings.TrimSpace(resTask.ID)
	if taskResult.TaskID == "" {
		taskResult.TaskID = strings.TrimSpace(resTask.TaskID)
	}
	if taskResult.TaskID == "" {
		taskResult.TaskID = extractFirstNonEmptyString(respBody,
			"id_task",
			"data.id_task",
			"response.id_task",
			"task_id",
			"data.task_id",
			"response.task_id",
		)
	}

	if resTask.Progress > 0 && resTask.Progress < 100 {
		taskResult.Progress = fmt.Sprintf("%d%%", resTask.Progress)
	} else {
		progress := gjson.GetBytes(respBody, "progress")
		if progress.Exists() && progress.Int() > 0 && progress.Int() < 100 {
			taskResult.Progress = fmt.Sprintf("%d%%", progress.Int())
		}
	}
	if taskResult.Progress == "" &&
		(taskResult.Status == model.TaskStatusSuccess || taskResult.Status == model.TaskStatusFailure) &&
		hasSoraFinishAt(respBody) {
		taskResult.Progress = taskcommon.ProgressComplete
	}
	taskResult.TotalTokens = extractTotalTokensFromResponse(respBody)

	return &taskResult, nil
}

func extractSoraTaskCode(respBody []byte) string {
	for _, path := range []string{
		"task_code",
		"data.task_code",
		"response.task_code",
	} {
		taskCode := gjson.GetBytes(respBody, path)
		if !taskCode.Exists() {
			continue
		}
		if taskCode.Type == gjson.String {
			return strings.TrimSpace(taskCode.String())
		}
		if taskCode.Type == gjson.Number {
			return strconv.FormatInt(taskCode.Int(), 10)
		}
		if v := strings.TrimSpace(taskCode.String()); v != "" {
			return v
		}
	}
	return ""
}

// IsTaskCodeFailure returns true when provider task_code explicitly indicates
// terminal failure. Empty / zero / success-like markers are treated as non-fail.
func IsTaskCodeFailure(taskCode string) bool {
	normalized := strings.ToLower(strings.TrimSpace(taskCode))
	switch normalized {
	case "", "0", "ok", "success", "succeeded", "completed":
		return false
	}
	if n, err := strconv.ParseInt(normalized, 10, 64); err == nil {
		return n != 0
	}
	return true
}

func extractImaFailureReason(respBody []byte, respErr *struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}, taskCode string) string {
	primaryPaths := []string{
		"error.message",
		"error.detail",
		"error.msg",
		"task_msg",
		"data.task_msg",
		"response.task_msg",
		"reason",
		"fail_reason",
		"failure_reason",
		"data.reason",
		"response.reason",
	}
	for _, path := range primaryPaths {
		if v := strings.TrimSpace(gjson.GetBytes(respBody, path).String()); v != "" && !isSuccessLikeMessage(v) {
			return v
		}
	}

	if respErr != nil {
		if v := strings.TrimSpace(respErr.Message); v != "" && !isSuccessLikeMessage(v) {
			return v
		}
		if code := strings.TrimSpace(respErr.Code); code != "" {
			return code
		}
	}

	// message/msg are often generic "Success" wrappers from provider; only use when not success-like.
	for _, path := range []string{"message", "msg", "data.message", "response.message"} {
		if v := strings.TrimSpace(gjson.GetBytes(respBody, path).String()); v != "" && !isSuccessLikeMessage(v) {
			return v
		}
	}

	if IsTaskCodeFailure(taskCode) {
		return taskCode
	}
	return "task failed"
}

func isSuccessLikeMessage(raw string) bool {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	switch normalized {
	case "ok", "success", "succeeded", "done", "completed":
		return true
	}
	return false
}

func hasSoraFinishAt(respBody []byte) bool {
	finishAt := gjson.GetBytes(respBody, "finish_at")
	if !finishAt.Exists() {
		return false
	}
	switch finishAt.Type {
	case gjson.Number:
		return finishAt.Int() > 0
	case gjson.String:
		return strings.TrimSpace(finishAt.String()) != ""
	default:
		return strings.TrimSpace(finishAt.String()) != ""
	}
}

func extractFirstNonEmptyString(respBody []byte, paths ...string) string {
	for _, path := range paths {
		if v := strings.TrimSpace(gjson.GetBytes(respBody, path).String()); v != "" {
			return v
		}
	}
	return ""
}

func firstNonEmptyValue(values ...string) string {
	for _, value := range values {
		if v := strings.TrimSpace(value); v != "" {
			return v
		}
	}
	return ""
}

func normalizeSoraTaskStatus(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "queued", "pending", "submitted":
		return model.TaskStatusQueued
	case "processing", "in_progress", "running":
		return model.TaskStatusInProgress
	case "completed", "success", "succeeded", "done":
		return model.TaskStatusSuccess
	case "failed", "cancelled", "canceled", "error":
		return model.TaskStatusFailure
	default:
		return ""
	}
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
	if task == nil {
		return nil, errors.New("task is nil")
	}

	// Build stable OpenAI-style video response from task state first,
	// then enrich with provider-specific extensions (usage/results) from raw task data.
	base := task.ToOpenAIVideo()
	base.TaskID = task.TaskID
	if strings.TrimSpace(base.Model) == "" {
		base.Model = taskcommon.DefaultString(task.Properties.OriginModelName, task.Properties.UpstreamModelName)
	}

	outBytes, err := common.Marshal(base)
	if err != nil {
		return nil, errors.Wrap(err, "marshal openai video base failed")
	}
	var out map[string]any
	if err := common.Unmarshal(outBytes, &out); err != nil {
		return nil, errors.Wrap(err, "unmarshal openai video base failed")
	}

	usage := extractFirstJSONObject(task.Data,
		"usage",
		"data.usage",
		"response.usage",
		"metadata.usage",
	)
	if len(usage) > 0 {
		out["usage"] = usage
	}

	results := extractFirstJSONArray(task.Data,
		"results",
		"data.results",
		"response.results",
	)
	if len(results) > 0 {
		out["results"] = results
	}

	return common.Marshal(out)
}

func extractFirstJSONObject(respBody []byte, paths ...string) map[string]any {
	for _, path := range paths {
		v := gjson.GetBytes(respBody, path)
		if !v.Exists() || !v.IsObject() {
			continue
		}
		m := make(map[string]any)
		if err := common.Unmarshal([]byte(v.Raw), &m); err == nil && len(m) > 0 {
			return m
		}
	}
	return nil
}

func extractFirstJSONArray(respBody []byte, paths ...string) []any {
	for _, path := range paths {
		v := gjson.GetBytes(respBody, path)
		if !v.Exists() || !v.IsArray() {
			continue
		}
		arr := make([]any, 0)
		if err := common.Unmarshal([]byte(v.Raw), &arr); err == nil && len(arr) > 0 {
			return arr
		}
	}
	return nil
}
