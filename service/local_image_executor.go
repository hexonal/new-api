package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/gin-gonic/gin"
)

const localImageExecutorMaxRetries = 3

// ImageChannelAdaptor 定义 worker 执行本地图像任务所需的最小 adaptor 能力。
// 这里不能直接引用 relay/channel.Adaptor，否则会形成 service -> relay/channel -> service 循环依赖。
type ImageChannelAdaptor interface {
	Init(info *relaycommon.RelayInfo)
	ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error)
	DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error)
}

// GetChannelAdaptorFunc 由 main 包注入：
//
//	service.GetChannelAdaptorFunc = relay.GetAdaptor
var GetChannelAdaptorFunc func(apiType int) ImageChannelAdaptor

// ExecuteLocalImageTask 执行已声明的本地 image 任务。
func ExecuteLocalImageTask(ctx context.Context, workerID string, task *model.Task) error {
	if ctx == nil {
		ctx = context.Background()
	}
	persistCtx := context.WithoutCancel(ctx)

	imageReq, err := decodeLocalImageRequest(task)
	if err != nil {
		return failLocalImageTask(persistCtx, workerID, task, "invalid input request: "+err.Error(), err)
	}

	ch, err := loadLocalImageChannel(task)
	if err != nil {
		return failLocalImageTask(persistCtx, workerID, task, "channel not found: "+err.Error(), err)
	}
	if ch.Type != constant.ChannelTypeOpenAI {
		notSupportedErr := fmt.Errorf("channel type %d not supported in P1", ch.Type)
		return failLocalImageTask(persistCtx, workerID, task, notSupportedErr.Error(), notSupportedErr)
	}

	ginCtx, err := buildLocalImageGinContext(ctx, task, ch, &imageReq)
	if err != nil {
		return failLocalImageTask(persistCtx, workerID, task, "build gin context failed: "+err.Error(), err)
	}
	info, err := buildLocalImageRelayInfo(ginCtx, task, &imageReq)
	if err != nil {
		return failLocalImageTask(persistCtx, workerID, task, "build relay info failed: "+err.Error(), err)
	}

	adaptor, err := getLocalImageAdaptor(info)
	if err != nil {
		return failLocalImageTask(persistCtx, workerID, task, err.Error(), err)
	}

	resultURL, responseBody, err := executeLocalImageUpstream(ctx, ginCtx, adaptor, info, imageReq)
	if err != nil {
		return failLocalImageTask(persistCtx, workerID, task, err.Error(), err)
	}

	storedResultURL := resultURL
	storedResultBody := append([]byte(nil), responseBody...)
	if archivedURL, ok := MaybeArchiveTaskResult(persistCtx, task, resultURL, responseBody); ok {
		storedResultURL = archivedURL
		storedResultBody = RewriteTaskResultData(responseBody, archivedURL)
	}

	if err = FinalizeLocalImageSuccess(
		persistCtx,
		workerID,
		task.ID,
		storedResultURL,
		decodeLocalImageResultData(storedResultBody),
	); err != nil {
		return err
	}
	task.Status = model.TaskStatusSuccess
	task.Progress = "100%"
	task.FinishTime = common.GetTimestamp()
	task.PrivateData.ResultURL = storedResultURL
	task.PrivateData.OutputImageURL = storedResultURL
	task.Data = storedResultBody
	_ = model.PatchLatestConsumeLogOutputByTaskID(persistCtx, task.TaskID, storedResultURL)
	WriteAsyncStatusAdvance(persistCtx, task, model.GenerationStatusSuccess)

	info.FinalPreConsumedQuota = task.Quota
	if err = SettleBilling(ginCtx, info, task.Quota); err != nil {
		common.SysError(fmt.Sprintf("SettleBilling failed for task %s: %s", task.TaskID, err.Error()))
	}
	SendConsumeFinalAdjustCallback(task, task.Quota, ConsumeCallbackUsage{})
	return nil
}

func decodeLocalImageRequest(task *model.Task) (dto.ImageRequest, error) {
	var imageReq dto.ImageRequest
	if task == nil || task.PrivateData.InputRequest == "" {
		return imageReq, errors.New("empty input request")
	}
	if err := common.UnmarshalJsonStr(task.PrivateData.InputRequest, &imageReq); err != nil {
		return imageReq, err
	}
	return imageReq, nil
}

func loadLocalImageChannel(task *model.Task) (*model.Channel, error) {
	return model.GetChannelById(task.ChannelId, true)
}

func buildLocalImageGinContext(
	ctx context.Context,
	task *model.Task,
	ch *model.Channel,
	imageReq *dto.ImageRequest,
) (*gin.Context, error) {
	if err := hydrateLocalImageRequest(task, imageReq); err != nil {
		return nil, err
	}
	return buildLocalImageGenerationsGinContext(ctx, task, ch, imageReq)
}

func hydrateLocalImageRequest(task *model.Task, imageReq *dto.ImageRequest) error {
	if imageReq == nil || task == nil {
		return nil
	}
	if err := setLocalImageRequestImages(imageReq, task.PrivateData.InputImageURL); err != nil {
		return err
	}
	return setLocalImageRequestMask(imageReq, task.PrivateData.InputMaskURL)
}

func buildLocalImageGenerationsGinContext(
	ctx context.Context,
	task *model.Task,
	ch *model.Channel,
	imageReq *dto.ImageRequest,
) (*gin.Context, error) {
	requestBody, err := common.Marshal(imageReq)
	if err != nil {
		return nil, err
	}
	return newLocalImageGinContext(
		ctx,
		task,
		ch,
		imageReq,
		ch.GetImageTaskRequestPath(),
		requestBody,
		"application/json",
	)
}

func setLocalImageRequestImages(imageReq *dto.ImageRequest, inputImageURL string) error {
	if imageReq == nil || len(bytes.TrimSpace(imageReq.Image)) > 0 {
		return nil
	}
	trimmedURL := strings.TrimSpace(inputImageURL)
	if trimmedURL == "" {
		return nil
	}
	payload, err := common.Marshal([]string{trimmedURL})
	if err != nil {
		return err
	}
	imageReq.Image = payload
	return nil
}

func setLocalImageRequestMask(imageReq *dto.ImageRequest, inputMaskURL string) error {
	if imageReq == nil {
		return nil
	}
	trimmedURL := strings.TrimSpace(inputMaskURL)
	if trimmedURL == "" {
		return nil
	}
	if imageReq.Extra == nil {
		imageReq.Extra = make(map[string]json.RawMessage)
	}
	if len(bytes.TrimSpace(imageReq.Extra["mask"])) > 0 {
		return nil
	}
	payload, err := common.Marshal(trimmedURL)
	if err != nil {
		return err
	}
	imageReq.Extra["mask"] = payload
	return nil
}

func newLocalImageGinContext(
	ctx context.Context,
	task *model.Task,
	ch *model.Channel,
	imageReq *dto.ImageRequest,
	requestPath string,
	requestBody []byte,
	contentType string,
) (*gin.Context, error) {
	recorder := httptest.NewRecorder()
	ginCtx, _ := gin.CreateTestContext(recorder)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, requestPath, bytes.NewReader(requestBody))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", contentType)
	httpReq.Header.Set("Accept", "application/json")
	applyLocalImageIdempotencyHeaders(httpReq, task.PrivateData.UpstreamIdempotencyKey)
	ginCtx.Request = httpReq
	populateLocalImageChannelContext(ginCtx, task, ch, imageReq)
	return ginCtx, nil
}

func applyLocalImageIdempotencyHeaders(httpReq *http.Request, key string) {
	key = strings.TrimSpace(key)
	if httpReq == nil || key == "" {
		return
	}
	httpReq.Header.Set("Idempotency-Key", key)
	httpReq.Header.Set("X-New-Api-Idempotency-Key", key)
}

func populateLocalImageChannelContext(
	ginCtx *gin.Context,
	task *model.Task,
	ch *model.Channel,
	imageReq *dto.ImageRequest,
) {
	modelName := resolveLocalImageModelName(task, imageReq)
	ginCtx.Set(string(constant.ContextKeyOriginalModel), modelName)
	common.SetContextKey(ginCtx, constant.ContextKeyRequestStartTime, time.Now())
	common.SetContextKey(ginCtx, constant.ContextKeyUserId, task.UserId)
	common.SetContextKey(ginCtx, constant.ContextKeyUsingGroup, task.Group)
	common.SetContextKey(ginCtx, constant.ContextKeyChannelId, ch.Id)
	common.SetContextKey(ginCtx, constant.ContextKeyChannelName, ch.Name)
	common.SetContextKey(ginCtx, constant.ContextKeyChannelType, ch.Type)
	common.SetContextKey(ginCtx, constant.ContextKeyChannelCreateTime, ch.CreatedTime)
	common.SetContextKey(ginCtx, constant.ContextKeyChannelSetting, ch.GetSetting())
	common.SetContextKey(ginCtx, constant.ContextKeyChannelOtherSetting, ch.GetOtherSettings())
	common.SetContextKey(ginCtx, constant.ContextKeyChannelParamOverride, ch.GetParamOverride())
	common.SetContextKey(ginCtx, constant.ContextKeyChannelHeaderOverride, ch.GetHeaderOverride())
	common.SetContextKey(ginCtx, constant.ContextKeyChannelModelMapping, ch.GetModelMapping())
	common.SetContextKey(ginCtx, constant.ContextKeyChannelStatusCodeMapping, ch.GetStatusCodeMapping())
	common.SetContextKey(ginCtx, constant.ContextKeyChannelBaseUrl, ch.GetBaseURL())
	if ch.OpenAIOrganization != nil && *ch.OpenAIOrganization != "" {
		common.SetContextKey(ginCtx, constant.ContextKeyChannelOrganization, *ch.OpenAIOrganization)
	}

	key, index, keyErr := ch.GetNextEnabledKey()
	if keyErr == nil {
		common.SetContextKey(ginCtx, constant.ContextKeyChannelKey, key)
		common.SetContextKey(ginCtx, constant.ContextKeyChannelIsMultiKey, ch.ChannelInfo.IsMultiKey)
		common.SetContextKey(ginCtx, constant.ContextKeyChannelMultiKeyIndex, index)
	}
}

func resolveLocalImageModelName(task *model.Task, imageReq *dto.ImageRequest) string {
	if task != nil && task.Properties.OriginModelName != "" {
		return task.Properties.OriginModelName
	}
	if task != nil && task.PrivateData.BillingContext != nil && task.PrivateData.BillingContext.OriginModelName != "" {
		return task.PrivateData.BillingContext.OriginModelName
	}
	if imageReq != nil {
		return imageReq.Model
	}
	return ""
}

func buildLocalImageRelayInfo(
	ginCtx *gin.Context,
	task *model.Task,
	imageReq *dto.ImageRequest,
) (*relaycommon.RelayInfo, error) {
	info := relaycommon.GenRelayInfoImage(ginCtx, imageReq)
	info.InitChannelMeta(ginCtx)
	if err := helper.ModelMappedHelper(ginCtx, info, imageReq); err != nil {
		return nil, err
	}
	info.RequestId = task.TaskID
	info.UserId = task.UserId
	info.ChannelId = task.ChannelId
	info.TokenId = task.PrivateData.TokenId
	info.BillingSource = task.PrivateData.BillingSource
	info.FinalPreConsumedQuota = task.Quota
	applyLocalImageIdempotencyHeaderOverride(info, task.PrivateData.UpstreamIdempotencyKey)
	return info, nil
}

func applyLocalImageIdempotencyHeaderOverride(info *relaycommon.RelayInfo, key string) {
	key = strings.TrimSpace(key)
	if info == nil || key == "" {
		return
	}
	if info.RuntimeHeadersOverride == nil {
		info.RuntimeHeadersOverride = make(map[string]interface{}, 2)
	}
	info.RuntimeHeadersOverride["Idempotency-Key"] = key
	info.RuntimeHeadersOverride["X-New-Api-Idempotency-Key"] = key
	info.UseRuntimeHeadersOverride = true
}

func getLocalImageAdaptor(info *relaycommon.RelayInfo) (ImageChannelAdaptor, error) {
	if GetChannelAdaptorFunc == nil {
		return nil, errors.New("channel adaptor dispatcher not initialized")
	}
	adaptor := GetChannelAdaptorFunc(info.ApiType)
	if adaptor == nil {
		return nil, fmt.Errorf("no channel adaptor for apiType %d", info.ApiType)
	}
	adaptor.Init(info)
	return adaptor, nil
}

func executeLocalImageUpstream(
	ctx context.Context,
	ginCtx *gin.Context,
	adaptor ImageChannelAdaptor,
	info *relaycommon.RelayInfo,
	imageReq dto.ImageRequest,
) (string, []byte, error) {
	requestBody, err := buildLocalImageRequestBody(ginCtx, adaptor, info, imageReq)
	if err != nil {
		return "", nil, fmt.Errorf("convert request failed: %w", err)
	}

	for attempt := 0; attempt < localImageExecutorMaxRetries; attempt++ {
		resultURL, responseBody, retry, execErr := tryExecuteLocalImageOnce(ginCtx, adaptor, info, requestBody)
		if execErr == nil {
			return resultURL, responseBody, nil
		}
		if !retry || attempt == localImageExecutorMaxRetries-1 {
			return "", nil, execErr
		}
		if err = sleepWithContext(ctx, time.Duration(1<<attempt)*time.Second); err != nil {
			return "", nil, err
		}
	}
	return "", nil, errors.New("local image execution exhausted")
}

func buildLocalImageRequestBody(
	ginCtx *gin.Context,
	adaptor ImageChannelAdaptor,
	info *relaycommon.RelayInfo,
	imageReq dto.ImageRequest,
) ([]byte, error) {
	converted, err := adaptor.ConvertImageRequest(ginCtx, info, imageReq)
	if err != nil {
		return nil, err
	}
	switch value := converted.(type) {
	case *bytes.Buffer:
		return append([]byte(nil), value.Bytes()...), nil
	case io.Reader:
		return io.ReadAll(value)
	default:
		requestBody, marshalErr := common.Marshal(converted)
		if marshalErr != nil {
			return nil, marshalErr
		}
		if len(info.ParamOverride) == 0 {
			return requestBody, nil
		}
		return relaycommon.ApplyParamOverrideWithRelayInfo(requestBody, info)
	}
}

func tryExecuteLocalImageOnce(
	ginCtx *gin.Context,
	adaptor ImageChannelAdaptor,
	info *relaycommon.RelayInfo,
	requestBody []byte,
) (string, []byte, bool, error) {
	rawResp, err := adaptor.DoRequest(ginCtx, info, bytes.NewReader(requestBody))
	if err != nil {
		return "", nil, isRetryable(nil, 0, err), fmt.Errorf("upstream call failed: %w", err)
	}

	httpResp, ok := rawResp.(*http.Response)
	if !ok {
		return "", nil, false, fmt.Errorf("unexpected upstream response type %T", rawResp)
	}

	respBody, readErr := io.ReadAll(httpResp.Body)
	_ = httpResp.Body.Close()
	if readErr != nil {
		return "", nil, false, fmt.Errorf("read upstream body failed: %w", readErr)
	}
	if httpResp.StatusCode >= http.StatusBadRequest {
		retry := isRetryable(httpResp, httpResp.StatusCode, nil)
		return "", nil, retry, fmt.Errorf("upstream %d: %s", httpResp.StatusCode, string(respBody))
	}

	resultURL, parseErr := parseLocalImageResponse(respBody)
	if parseErr != nil {
		return "", nil, false, parseErr
	}
	return resultURL, respBody, false, nil
}

func decodeLocalImageResultData(respBody []byte) map[string]any {
	if len(respBody) == 0 {
		return nil
	}
	var payload map[string]any
	if err := common.Unmarshal(respBody, &payload); err != nil {
		return nil
	}
	return payload
}

func parseLocalImageResponse(respBody []byte) (string, error) {
	var imageResp dto.ImageResponse
	if err := common.Unmarshal(respBody, &imageResp); err != nil {
		return "", fmt.Errorf("parse response failed: %w", err)
	}
	if len(imageResp.Data) == 0 {
		return "", errors.New("empty response data")
	}
	if imageResp.Data[0].Url != "" {
		return imageResp.Data[0].Url, nil
	}
	if imageResp.Data[0].B64Json != "" {
		return "data:image/png;base64," + imageResp.Data[0].B64Json, nil
	}
	return "", errors.New("empty response data")
}

func failLocalImageTask(
	ctx context.Context,
	workerID string,
	task *model.Task,
	reason string,
	cause error,
) error {
	err := FinalizeLocalImageFailure(ctx, workerID, task.ID, reason, false)
	if err != nil {
		return err
	}
	task.Status = model.TaskStatusFailure
	task.Progress = "100%"
	task.FinishTime = common.GetTimestamp()
	task.FailReason = reason
	WriteAsyncStatusAdvance(ctx, task, model.GenerationStatusFailed)
	RefundTaskQuota(ctx, task, reason)
	return cause
}

func sleepWithContext(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func isRetryable(resp *http.Response, statusCode int, err error) bool {
	if err != nil {
		return true
	}
	if resp == nil {
		return false
	}
	return statusCode == http.StatusTooManyRequests || statusCode >= http.StatusInternalServerError
}
