package controller

import (
	"bytes"
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
	isEdits := strings.HasPrefix(c.ContentType(), "multipart/form-data")
	mode := imageTaskModeFromEditsFlag(isEdits)
	c.Set("image_task_mode", mode)
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
	imageReq, requestBytes, err := prepareImageTaskReplayRequest(c, relayInfo, isEdits)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
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

func imageTaskModeFromEditsFlag(isEdits bool) string {
	if isEdits {
		return "edits"
	}
	return "generations"
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
	isEdits bool,
) (*dto.ImageRequest, []byte, error) {
	imageReq, err := helper.GetAndValidOpenAIImageRequest(c, relayInfo.RelayMode)
	if err != nil {
		return nil, nil, err
	}
	relayInfo.OriginModelName = imageReq.Model
	if isEdits {
		if err = persistImageEditsInput(c, relayInfo); err != nil {
			return nil, nil, err
		}
	}
	requestBytes, err := common.Marshal(imageReq)
	if err != nil {
		return nil, nil, err
	}
	return imageReq, requestBytes, nil
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
