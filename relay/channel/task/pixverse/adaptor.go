package pixverse

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
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
	ChannelName          = "pixverse"
	TextToVideoEndpoint  = "/openapi/v2/video/text/generate"
	ImageToVideoEndpoint = "/openapi/v2/video/img/generate"
	VideoResultEndpoint  = "/openapi/v2/video/result"
	DefaultModel         = "v5.5"
	DefaultDuration      = 5
	DefaultQuality       = "720p"
	DefaultAspectRatio   = "16:9"
)

var ModelList = []string{
	"pixverse-v3.5",
	"pixverse-v4",
	"pixverse-v4.5",
	"pixverse-v5",
	"pixverse-v5.5",
	"pixverse-v5.6",
	"pixverse-c1",
	"pixverse-v6",
}

var officialDynamicBillingModels = map[string]pixVersePriceMatrix{
	"pixverse-c1": {
		BaseCreditsPerSecond: 6,
		ResolutionCredits: map[string]float64{
			"360p":  6,
			"540p":  8,
			"720p":  10,
			"1080p": 19,
		},
		AudioCredits: map[string]float64{
			"360p":  8,
			"540p":  10,
			"720p":  13,
			"1080p": 24,
		},
	},
	"pixverse-v6": {
		BaseCreditsPerSecond: 5,
		ResolutionCredits: map[string]float64{
			"360p":  5,
			"540p":  7,
			"720p":  9,
			"1080p": 18,
		},
		AudioCredits: map[string]float64{
			"360p":  7,
			"540p":  9,
			"720p":  12,
			"1080p": 23,
		},
	},
}

type pixVersePriceMatrix struct {
	BaseCreditsPerSecond float64
	ResolutionCredits    map[string]float64
	AudioCredits         map[string]float64
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType   int
	apiKey        string
	baseURL       string
	hasImageInput bool
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) PerCallRatiosEnabled() bool { return true }

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if !shouldUseOfficialPixVerseDynamicBilling(info) {
		return nil
	}

	v, ok := c.Get("task_request")
	if !ok {
		return nil
	}
	req, ok := v.(relaycommon.TaskSubmitReq)
	if !ok {
		return nil
	}

	rawPayload, err := a.convertToRequestPayload(&req, info)
	if err != nil {
		return nil
	}
	payload, ok := rawPayload.(*TextToVideoRequest)
	if !ok || payload == nil {
		return nil
	}

	if len(info.ParamOverride) > 0 {
		payload = applyPixVerseParamOverride(payload, info)
	}

	matrix := officialDynamicBillingModels[strings.ToLower(strings.TrimSpace(info.OriginModelName))]
	quality := normalizePixVerseQuality(payload.Quality)
	silentCredits, ok := matrix.ResolutionCredits[quality]
	if !ok {
		return nil
	}

	ratios := map[string]float64{
		"duration":   float64(taskcommon.DefaultInt(payload.Duration, DefaultDuration)),
		"resolution": silentCredits / matrix.BaseCreditsPerSecond,
	}

	if hasAudio := resolvePixVerseAudioEnabled(payload, req.Metadata); hasAudio {
		audioCredits, ok := matrix.AudioCredits[quality]
		if !ok || silentCredits == 0 {
			return nil
		}
		ratios["audio"] = audioCredits / silentCredits
	}

	return ratios
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	taskErr := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
	if taskErr != nil {
		return taskErr
	}
	// Detect image-to-video: check Image field or img_id in metadata
	if v, exists := c.Get("task_request"); exists {
		if req, ok := v.(relaycommon.TaskSubmitReq); ok {
			if req.Image != "" || len(req.Images) > 0 {
				a.hasImageInput = true
			}
			if imgID, ok := req.Metadata["img_id"]; ok && imgID != nil {
				a.hasImageInput = true
			}
		}
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	// 默认走文生视频；有图片引用时走图生视频
	endpoint := TextToVideoEndpoint
	if a.hasImageInput {
		endpoint = ImageToVideoEndpoint
	}
	return fmt.Sprintf("%s%s", a.baseURL, endpoint), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Api-Key", a.apiKey)
	req.Header.Set("Ai-trace-id", uuid.New().String())
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

	var pvResp PixVerseResponse
	if err := common.Unmarshal(responseBody, &pvResp); err != nil {
		taskErr = service.TaskErrorWrapper(err, "unmarshal_response_failed", http.StatusInternalServerError)
		return
	}
	if pvResp.ErrCode != 0 {
		taskErr = service.TaskErrorWrapperLocal(fmt.Errorf("pixverse error: %s (code=%d)", pvResp.ErrMsg, pvResp.ErrCode), "task_failed", http.StatusBadRequest)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)

	return strconv.FormatInt(pvResp.Resp.VideoID, 10), responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	url := fmt.Sprintf("%s%s/%s", baseUrl, VideoResultEndpoint, taskID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Api-Key", key)
	req.Header.Set("Ai-trace-id", uuid.New().String())

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
	var result VideoResultResponse
	if err := common.Unmarshal(respBody, &result); err != nil {
		return nil, errors.Wrap(err, "unmarshal pixverse result failed")
	}
	if result.ErrCode != 0 {
		return &relaycommon.TaskInfo{
			Code:   result.ErrCode,
			Reason: result.ErrMsg,
			Status: model.TaskStatusFailure,
		}, nil
	}

	ti := &relaycommon.TaskInfo{
		TaskID: strconv.FormatInt(result.Resp.ID, 10),
	}
	switch result.Resp.Status {
	case StatusSuccess:
		ti.Status = model.TaskStatusSuccess
		ti.Progress = taskcommon.ProgressComplete
		ti.Url = result.Resp.URL
	case StatusProcessing:
		ti.Status = model.TaskStatusInProgress
		ti.Progress = taskcommon.ProgressInProgress
	case StatusModeration:
		ti.Status = model.TaskStatusFailure
		ti.Progress = taskcommon.ProgressComplete
		ti.Reason = "content moderation failure"
	case StatusFailed:
		ti.Status = model.TaskStatusFailure
		ti.Progress = taskcommon.ProgressComplete
		ti.Reason = "generation failed"
	default:
		ti.Status = model.TaskStatusInProgress
		ti.Progress = taskcommon.ProgressQueued
	}
	return ti, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var pvResult VideoResultResponse
	if err := common.Unmarshal(originTask.Data, &pvResult); err != nil {
		return nil, errors.Wrap(err, "unmarshal pixverse task data failed")
	}

	openAIVideo := originTask.ToOpenAIVideo()
	if pvResult.Resp.URL != "" {
		openAIVideo.SetMetadata("url", pvResult.Resp.URL)
	}
	if pvResult.ErrCode != 0 {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: pvResult.ErrMsg,
			Code:    strconv.Itoa(pvResult.ErrCode),
		}
	}
	return common.Marshal(openAIVideo)
}

// ── helpers ──────────────────────────────────────────────────────

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (any, error) {
	modelName := info.UpstreamModelName
	if modelName == "" {
		modelName = DefaultModel
	}

	aspectRatio := req.Size
	if aspectRatio == "" {
		aspectRatio = DefaultAspectRatio
	}

	t2v := &TextToVideoRequest{
		Prompt:      req.Prompt,
		Model:       modelName,
		AspectRatio: aspectRatio,
		Duration:    taskcommon.DefaultInt(req.Duration, DefaultDuration),
		Quality:     taskcommon.DefaultString(req.Quality, DefaultQuality),
	}
	// metadata 可覆盖所有字段（包括 img_id 走图生视频、quality、aspect_ratio 等）
	if err := taskcommon.UnmarshalMetadata(req.Metadata, t2v); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	if t2v.GenerateAudioSwitch == nil {
		if audioEnabled, ok := resolvePixVerseAudioPreference(req.Metadata); ok {
			t2v.GenerateAudioSwitch = &audioEnabled
		}
	}
	return t2v, nil
}

func shouldUseOfficialPixVerseDynamicBilling(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	if info.ChannelType != constant.ChannelTypePixVerse {
		return false
	}
	if _, ok := officialDynamicBillingModels[strings.ToLower(strings.TrimSpace(info.OriginModelName))]; !ok {
		return false
	}
	return normalizePixVerseHost(info.ChannelBaseUrl) == normalizePixVerseHost(constant.ChannelBaseURLs[constant.ChannelTypePixVerse])
}

func normalizePixVerseHost(raw string) string {
	trimmed := strings.TrimSpace(strings.ToLower(raw))
	if trimmed == "" {
		return ""
	}
	parsed, err := url.Parse(trimmed)
	if err == nil && parsed.Host != "" {
		return parsed.Host
	}
	if !strings.Contains(trimmed, "://") {
		if parsed, err = url.Parse("https://" + trimmed); err == nil {
			return parsed.Host
		}
	}
	return trimmed
}

func normalizePixVerseQuality(quality string) string {
	normalized := strings.ToLower(strings.TrimSpace(quality))
	if normalized == "" {
		return DefaultQuality
	}
	return normalized
}

func resolvePixVerseAudioEnabled(payload *TextToVideoRequest, metadata map[string]any) bool {
	if payload != nil && payload.GenerateAudioSwitch != nil {
		return *payload.GenerateAudioSwitch
	}
	if enabled, ok := resolvePixVerseAudioPreference(metadata); ok {
		return enabled
	}
	return false
}

func resolvePixVerseAudioPreference(metadata map[string]any) (bool, bool) {
	if metadata == nil {
		return false, false
	}
	for _, key := range []string{"generate_audio_switch", "audio", "enable_audio", "enableAudio", "with_audio", "withAudio"} {
		raw, ok := metadata[key]
		if !ok || raw == nil {
			continue
		}
		switch v := raw.(type) {
		case bool:
			return v, true
		case string:
			normalized := strings.ToLower(strings.TrimSpace(v))
			return normalized == "true" || normalized == "1" || normalized == "yes", true
		case float64:
			return v != 0, true
		case int:
			return v != 0, true
		case int64:
			return v != 0, true
		}
	}
	return false, false
}

func applyPixVerseParamOverride(payload *TextToVideoRequest, info *relaycommon.RelayInfo) *TextToVideoRequest {
	if payload == nil || info == nil || len(info.ParamOverride) == 0 {
		return payload
	}

	data, err := common.Marshal(payload)
	if err != nil {
		return payload
	}
	patched, err := relaycommon.ApplyParamOverride(data, info.ParamOverride, nil)
	if err != nil {
		return payload
	}

	var tolerant map[string]any
	if err := common.Unmarshal(patched, &tolerant); err != nil {
		return payload
	}
	if v, ok := tolerant["duration"]; ok {
		switch typed := v.(type) {
		case float64:
			payload.Duration = int(typed)
		case int:
			payload.Duration = typed
		case int64:
			payload.Duration = int(typed)
		case string:
			if parsed, err := strconv.Atoi(strings.TrimSpace(typed)); err == nil {
				payload.Duration = parsed
			}
		}
	}
	if v, ok := tolerant["quality"]; ok {
		payload.Quality = fmt.Sprintf("%v", v)
	}
	if v, ok := tolerant["generate_audio_switch"]; ok {
		if enabled, present := resolvePixVerseAudioPreference(map[string]any{"generate_audio_switch": v}); present {
			payload.GenerateAudioSwitch = &enabled
		}
	} else if v, ok := tolerant["audio"]; ok {
		if enabled, present := resolvePixVerseAudioPreference(map[string]any{"audio": v}); present {
			payload.GenerateAudioSwitch = &enabled
		}
	}
	return payload
}
