package controller

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service/archiver"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type imageTaskSubmitResponse struct {
	ID        string `json:"id"`
	TaskID    string `json:"task_id,omitempty"`
	Object    string `json:"object"`
	Model     string `json:"model,omitempty"`
	Status    string `json:"status"`
	CreatedAt int64  `json:"created_at"`
}

func RelayImageTaskSubmit(c *gin.Context) {
	isMultipart := strings.HasPrefix(c.ContentType(), "multipart/form-data")
	c.Set("platform", string(constant.TaskPlatformImage))

	clientIdempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if clientIdempotencyKey != "" {
		userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
		existingTask, lookupErr := model.GetTaskByUserAndIdempotencyKey(userID, clientIdempotencyKey)
		if lookupErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": lookupErr.Error()})
			return
		}
		if existingTask != nil {
			c.JSON(http.StatusOK, buildImageTaskSubmitResponse(existingTask))
			return
		}
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatImageTask, nil, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, &dto.TaskError{
			Code:       "gen_relay_info_failed",
			Message:    err.Error(),
			StatusCode: http.StatusInternalServerError,
		})
		return
	}

	ensureImageTaskRelayInfo(relayInfo)
	relayInfo.TaskRelayInfo.ClientIdempotencyKey = clientIdempotencyKey
	imageReq, requestBytes, mode, err := prepareImageTaskReplayRequest(c, relayInfo, isMultipart)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Set("image_task_mode", mode)
	relayInfo.TaskRelayInfo.Mode = mode
	relayInfo.Action = defaultImageTaskAction(mode)
	relayInfo.TaskRelayInfo.InputRequest = string(requestBytes)
	if relayInfo.TaskRelayInfo.IdempotencyKey == "" {
		relayInfo.TaskRelayInfo.IdempotencyKey = common.GetUUID()
	}
	relayInfo.Request = imageReq
	relayInfo.OriginModelName = imageReq.Model
	if meta := imageReq.GetTokenCountMeta(); meta != nil {
		relayInfo.TokenCountMeta.ImagePriceRatio = meta.ImagePriceRatio
	}

	runTaskRelaySubmit(c, relayInfo)
}

func defaultImageTaskAction(_ string) string {
	return constant.TaskActionImageGenerate
}

func ensureImageTaskRelayInfo(relayInfo *relaycommon.RelayInfo) {
	if relayInfo.TaskRelayInfo == nil {
		relayInfo.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}
	if relayInfo.TaskRelayInfo.PublicTaskID == "" {
		relayInfo.TaskRelayInfo.PublicTaskID = model.GenerateTaskID()
	}
}

func prepareImageTaskReplayRequest(
	c *gin.Context,
	relayInfo *relaycommon.RelayInfo,
	isMultipart bool,
) (*dto.ImageRequest, []byte, string, error) {
	parseRelayMode := relayInfo.RelayMode
	if isMultipart {
		parseRelayMode = relayconstant.RelayModeImagesEdits
	}
	imageReq, err := helper.GetAndValidOpenAIImageRequest(c, parseRelayMode)
	if err != nil {
		return nil, nil, "", err
	}
	relayInfo.OriginModelName = imageReq.Model
	mode, err := normalizeImageTaskReplayRequest(c, relayInfo, imageReq, isMultipart)
	if err != nil {
		return nil, nil, "", err
	}
	requestBytes, err := common.Marshal(imageReq)
	if err != nil {
		return nil, nil, "", err
	}
	return imageReq, requestBytes, mode, nil
}

func normalizeImageTaskReplayRequest(
	c *gin.Context,
	info *relaycommon.RelayInfo,
	imageReq *dto.ImageRequest,
	isMultipart bool,
) (string, error) {
	if isMultipart {
		if err := persistImageEditsInput(c, info); err != nil {
			return "", err
		}
		if err := attachArchivedImageTaskInputs(imageReq, info); err != nil {
			return "", err
		}
		return "edits", nil
	}
	if err := normalizeImageTaskJSONInputs(imageReq, info); err != nil {
		return "", err
	}
	if hasImageTaskInput(imageReq) {
		return "edits", nil
	}
	return "generations", nil
}

func RelayImageTaskFetch(c *gin.Context) {
	c.Set("platform", string(constant.TaskPlatformImage))

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatImageTask, nil, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, &dto.TaskError{
			Code:       "gen_relay_info_failed",
			Message:    err.Error(),
			StatusCode: http.StatusInternalServerError,
		})
		return
	}
	if taskErr := relay.RelayTaskFetch(c, relayInfo.RelayMode); taskErr != nil {
		respondTaskError(c, taskErr)
	}
}

func persistImageEditsInput(c *gin.Context, info *relaycommon.RelayInfo) error {
	file, _, err := c.Request.FormFile("image")
	if err != nil {
		return err
	}
	defer file.Close()

	buf := new(bytes.Buffer)
	if _, err = io.Copy(buf, file); err != nil {
		return err
	}

	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	if info.ChannelMeta != nil {
		channelID = info.ChannelId
	}
	taskID := ""
	if info.TaskRelayInfo != nil {
		taskID = info.TaskRelayInfo.PublicTaskID
	}

	url, err := archiver.GetDefault().Archive(c.Request.Context(), archiver.Source{
		Bytes: buf.Bytes(),
	}, archiver.Meta{
		Kind:      archiver.KindImage,
		Model:     strings.TrimSpace(info.OriginModelName),
		ChannelID: channelID,
		UserID:    info.UserId,
		RequestID: info.RequestId,
		TaskID:    taskID,
	})
	if err != nil {
		return err
	}
	info.TaskRelayInfo.InputImageURL = url

	maskURL, err := archiveImageTaskFormFile(c, info, "mask", 1)
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			return nil
		}
		return err
	}
	info.TaskRelayInfo.InputMaskURL = maskURL
	return nil
}

func normalizeImageTaskJSONInputs(imageReq *dto.ImageRequest, info *relaycommon.RelayInfo) error {
	if imageReq == nil {
		return nil
	}
	normalizeImageTaskMaskField(imageReq)
	urls, found, err := consumeImageTaskURLs(imageReq)
	if err != nil {
		return err
	}
	if found {
		if err = setImageTaskURLs(imageReq, urls); err != nil {
			return err
		}
		recordImageTaskInputURL(info, urls)
	}
	return attachArchivedImageTaskInputs(imageReq, info)
}

func attachArchivedImageTaskInputs(imageReq *dto.ImageRequest, info *relaycommon.RelayInfo) error {
	if imageReq == nil || info == nil || info.TaskRelayInfo == nil {
		return nil
	}

	inputImageURL := strings.TrimSpace(info.TaskRelayInfo.InputImageURL)
	if inputImageURL != "" {
		if err := setImageTaskURLs(imageReq, []string{inputImageURL}); err != nil {
			return err
		}
	}
	return setImageTaskExtraField(imageReq, "mask", strings.TrimSpace(info.TaskRelayInfo.InputMaskURL))
}

func normalizeImageTaskMaskField(imageReq *dto.ImageRequest) {
	if imageReq == nil || len(imageReq.Extra) == 0 {
		return
	}
	rawMask, ok := imageReq.Extra["mask_input"]
	if !ok {
		return
	}
	delete(imageReq.Extra, "mask_input")
	if len(bytes.TrimSpace(imageReq.Extra["mask"])) == 0 {
		imageReq.Extra["mask"] = rawMask
	}
}

func consumeImageTaskURLs(imageReq *dto.ImageRequest) ([]string, bool, error) {
	if imageReq == nil {
		return nil, false, nil
	}

	var extraURLs json.RawMessage
	if imageReq.Extra != nil {
		extraURLs = imageReq.Extra["image_input"]
		delete(imageReq.Extra, "image_input")
	}

	urls, err := parseImageTaskURLs(imageReq.Image)
	if err != nil || len(urls) > 0 {
		return urls, len(urls) > 0, err
	}
	if len(bytes.TrimSpace(extraURLs)) == 0 {
		return nil, false, nil
	}
	urls, err = parseImageTaskURLs(extraURLs)
	return urls, len(urls) > 0, err
}

func parseImageTaskURLs(raw []byte) ([]string, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil, nil
	}

	var urls []string
	if trimmed[0] == '[' {
		if err := common.Unmarshal(trimmed, &urls); err != nil {
			return nil, err
		}
	} else {
		var singleURL string
		if err := common.Unmarshal(trimmed, &singleURL); err != nil {
			return nil, err
		}
		if singleURL != "" {
			urls = []string{singleURL}
		}
	}
	return compactImageTaskURLs(urls), nil
}

func compactImageTaskURLs(urls []string) []string {
	compacted := make([]string, 0, len(urls))
	for _, url := range urls {
		trimmed := strings.TrimSpace(url)
		if trimmed != "" {
			compacted = append(compacted, trimmed)
		}
	}
	return compacted
}

func setImageTaskURLs(imageReq *dto.ImageRequest, urls []string) error {
	if imageReq == nil {
		return nil
	}
	payload, err := common.Marshal(compactImageTaskURLs(urls))
	if err != nil {
		return err
	}
	imageReq.Image = payload
	return nil
}

func setImageTaskExtraField(imageReq *dto.ImageRequest, key string, value string) error {
	if imageReq == nil || strings.TrimSpace(value) == "" {
		return nil
	}
	if imageReq.Extra == nil {
		imageReq.Extra = make(map[string]json.RawMessage)
	}
	payload, err := common.Marshal(strings.TrimSpace(value))
	if err != nil {
		return err
	}
	imageReq.Extra[key] = payload
	return nil
}

func recordImageTaskInputURL(info *relaycommon.RelayInfo, urls []string) {
	if info == nil || info.TaskRelayInfo == nil || len(urls) == 0 {
		return
	}
	if strings.TrimSpace(info.TaskRelayInfo.InputImageURL) == "" {
		info.TaskRelayInfo.InputImageURL = urls[0]
	}
}

func hasImageTaskInput(imageReq *dto.ImageRequest) bool {
	if imageReq == nil {
		return false
	}
	urls, err := parseImageTaskURLs(imageReq.Image)
	if err == nil && len(urls) > 0 {
		return true
	}
	if imageReq.Extra == nil {
		return false
	}
	urls, err = parseImageTaskURLs(imageReq.Extra["image_input"])
	return err == nil && len(urls) > 0
}

func archiveImageTaskFormFile(c *gin.Context, info *relaycommon.RelayInfo, fieldName string, index int) (string, error) {
	file, _, err := c.Request.FormFile(fieldName)
	if err != nil {
		return "", err
	}
	defer file.Close()

	buf := new(bytes.Buffer)
	if _, err = io.Copy(buf, file); err != nil {
		return "", err
	}

	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	if info.ChannelMeta != nil {
		channelID = info.ChannelId
	}
	taskID := ""
	if info.TaskRelayInfo != nil {
		taskID = info.TaskRelayInfo.PublicTaskID
	}

	return archiver.GetDefault().Archive(c.Request.Context(), archiver.Source{
		Bytes: buf.Bytes(),
	}, archiver.Meta{
		Kind:      archiver.KindImage,
		Model:     strings.TrimSpace(info.OriginModelName),
		ChannelID: channelID,
		UserID:    info.UserId,
		RequestID: info.RequestId,
		TaskID:    taskID,
		Index:     index,
	})
}

func buildImageTaskSubmitResponse(task *model.Task) imageTaskSubmitResponse {
	modelName := strings.TrimSpace(task.Properties.OriginModelName)
	if modelName == "" {
		modelName = strings.TrimSpace(task.Properties.UpstreamModelName)
	}
	createdAt := task.CreatedAt
	if createdAt == 0 {
		createdAt = task.SubmitTime
	}
	return imageTaskSubmitResponse{
		ID:        task.TaskID,
		TaskID:    task.TaskID,
		Object:    "image",
		Model:     modelName,
		Status:    buildImageTaskSubmitStatus(task.Status),
		CreatedAt: createdAt,
	}
}

func buildImageTaskSubmitStatus(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusNotStart, model.TaskStatusSubmitted, model.TaskStatusQueued:
		return dto.VideoStatusQueued
	case model.TaskStatusInProgress:
		return dto.VideoStatusInProgress
	case model.TaskStatusSuccess:
		return dto.VideoStatusCompleted
	case model.TaskStatusFailure:
		return dto.VideoStatusFailed
	default:
		return dto.VideoStatusUnknown
	}
}
