package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// SyncGenerationReq 同步调用记录入参
type SyncGenerationReq struct {
	Kind             string
	Platform         string
	Model            string
	InputPreview     string
	OutputURLs       string
	Extras           string
	Quota            int
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

// WriteSyncSuccess 同步调用成功后写入记录
func WriteSyncSuccess(c *gin.Context, info *relaycommon.RelayInfo, req SyncGenerationReq) {
	if !common.GenerationRecordEnabled.Load() {
		return
	}
	rec := &model.GenerationRecord{
		RecordKey:        syncRecordKey(info.TokenId),
		TokenID:          info.TokenId,
		UserID:           info.UserId,
		ChannelID:        info.ChannelMeta.ChannelId,
		Kind:             req.Kind,
		Status:           model.GenerationStatusSuccess,
		Platform:         req.Platform,
		Model:            req.Model,
		InputPreview:     truncateByRune(req.InputPreview, 1024),
		OutputURLs:       req.OutputURLs,
		Extras:           req.Extras,
		Quota:            req.Quota,
		PromptTokens:     req.PromptTokens,
		CompletionTokens: req.CompletionTokens,
		TotalTokens:      req.TotalTokens,
		SubmitTime:       time.Now().Unix(),
	}
	insertGenerationRecord(c, rec, "WriteSyncSuccess")
}

// WriteAsyncSubmitted 异步任务提交后写入 pending 记录
func WriteAsyncSubmitted(c *gin.Context, info *relaycommon.RelayInfo, task *model.Task) {
	if !common.GenerationRecordEnabled.Load() {
		return
	}
	if info == nil || task == nil {
		logger.LogError(context.Background(), "WriteAsyncSubmitted invalid args")
		return
	}
	rec := buildAsyncSubmittedRecord(c, info, task)
	insertGenerationRecord(c, rec, "WriteAsyncSubmitted")
}

// WriteAsyncStatusAdvance 异步任务状态推进
func WriteAsyncStatusAdvance(ctx context.Context, task *model.Task, newStatus string, outputURLsJSON string) {
	if !common.GenerationRecordEnabled.Load() {
		return
	}
	if task == nil {
		logger.LogError(ctx, "WriteAsyncStatusAdvance invalid task")
		return
	}
	update := model.GenerationStatusUpdate{
		Status:       mapAsyncTaskStatusToRecordStatus(newStatus),
		OutputURLs:   outputURLsJSON,
		ErrorMessage: errorMessageForRecordStatus(mapAsyncTaskStatusToRecordStatus(newStatus), task.FailReason),
		StartTime:    convertMsToSec(task.StartTime),
		FinishTime:   convertMsToSec(task.FinishTime),
	}
	err := model.AdvanceStatus(asyncRecordKey(task.PrivateData.TokenId, task.TaskID), update, func() *model.GenerationRecord {
		return buildTaskFallbackRecord(task)
	})
	if err != nil {
		logger.LogError(ctx, "WriteAsyncStatusAdvance failed: "+err.Error())
	}
}

// WriteAsyncRefund 异步任务退款标记
func WriteAsyncRefund(ctx context.Context, task *model.Task, refundKind string, refundedQuota int) {
	if !common.GenerationRecordEnabled.Load() {
		return
	}
	if task == nil || refundedQuota <= 0 || strings.TrimSpace(refundKind) == "" {
		return
	}
	err := model.MarkRefund(asyncRecordKey(task.PrivateData.TokenId, task.TaskID), model.GenerationRefundMark{
		RefundStatus:  refundKind,
		RefundedQuota: refundedQuota,
	})
	if err != nil {
		logger.LogError(ctx, "WriteAsyncRefund failed: "+err.Error())
	}
}

// WriteAsyncBillingPatch 异步任务差额结算 patch quota
func WriteAsyncBillingPatch(ctx context.Context, task *model.Task, actualQuota int) {
	if !common.GenerationRecordEnabled.Load() {
		return
	}
	if task == nil || actualQuota <= 0 {
		return
	}
	err := model.PatchBilling(asyncRecordKey(task.PrivateData.TokenId, task.TaskID), model.GenerationBillingPatch{
		Quota: actualQuota,
	})
	if err != nil {
		logger.LogError(ctx, "WriteAsyncBillingPatch failed: "+err.Error())
	}
}

// WriteMjSubmitted MJ 提交后写入 pending 记录
func WriteMjSubmitted(c *gin.Context, info *relaycommon.RelayInfo, mj *model.Midjourney) {
	if !common.GenerationRecordEnabled.Load() {
		return
	}
	if info == nil || mj == nil {
		logger.LogError(context.Background(), "WriteMjSubmitted invalid args")
		return
	}
	rec := buildMjSubmittedRecord(c, info, mj)
	insertGenerationRecord(c, rec, "WriteMjSubmitted")
}

// WriteMjStatusAdvance MJ 状态推进
func WriteMjStatusAdvance(ctx context.Context, mj *model.Midjourney, newStatus string) {
	if !common.GenerationRecordEnabled.Load() {
		return
	}
	if mj == nil {
		logger.LogError(ctx, "WriteMjStatusAdvance invalid mj task")
		return
	}
	recordStatus := mapMjStatusToRecordStatus(newStatus)
	err := model.AdvanceStatus(mjRecordKey(mj.UserId, mj.MjId), model.GenerationStatusUpdate{
		Status:       recordStatus,
		OutputURLs:   buildOutputURLsJSON(buildMjOutputURLs(mj)),
		ErrorMessage: errorMessageForRecordStatus(recordStatus, mj.FailReason),
		StartTime:    convertMsToSec(mj.StartTime),
		FinishTime:   convertMsToSec(mj.FinishTime),
	}, func() *model.GenerationRecord {
		return buildMjFallbackRecord(mj)
	})
	if err != nil {
		logger.LogError(ctx, "WriteMjStatusAdvance failed: "+err.Error())
	}
}

// WriteMjRefund MJ 退款标记
func WriteMjRefund(ctx context.Context, mj *model.Midjourney, refundedQuota int) {
	if !common.GenerationRecordEnabled.Load() {
		return
	}
	if mj == nil || refundedQuota <= 0 {
		return
	}
	recordKey := mjRecordKey(mj.UserId, mj.MjId)
	err := model.MarkRefund(recordKey, model.GenerationRefundMark{
		RefundStatus:  model.RefundStatusFullRefund,
		RefundedQuota: refundedQuota,
	})
	if err != nil {
		logger.LogError(ctx, "WriteMjRefund failed: "+err.Error())
		return
	}
	exists, existsErr := model.GenerationRecordExists(recordKey)
	if existsErr != nil {
		logger.LogError(ctx, "WriteMjRefund verify record failed: "+existsErr.Error())
		return
	}
	if !exists {
		logger.LogError(ctx, "WriteMjRefund generation record not found: "+recordKey)
	}
}

func syncRecordKey(tokenID int) string {
	return "sync:" + strconv.Itoa(tokenID) + ":" + generateServerUUID()
}

func asyncRecordKey(tokenID int, taskID string) string {
	return "task:" + strconv.Itoa(tokenID) + ":" + taskID
}

func mjRecordKey(userID int, mjID string) string {
	return "mj:" + strconv.Itoa(userID) + ":" + mjID
}

func insertGenerationRecord(ctx context.Context, rec *model.GenerationRecord, op string) {
	if err := model.InsertPending(rec); err != nil {
		logger.LogError(ctx, op+" insert failed: "+err.Error())
		enqueueCompensation(rec)
	}
}

func buildAsyncSubmittedRecord(c *gin.Context, info *relaycommon.RelayInfo, task *model.Task) *model.GenerationRecord {
	return &model.GenerationRecord{
		RecordKey:      asyncRecordKey(info.TokenId, task.TaskID),
		TokenID:        info.TokenId,
		UserID:         info.UserId,
		ChannelID:      info.ChannelId,
		TokenName:      c.GetString("token_name"),
		UserGroup:      info.UsingGroup,
		Kind:           mapTaskPlatformToKind(task.Platform),
		Status:         model.GenerationStatusPending,
		Platform:       string(task.Platform),
		ExternalTaskID: task.TaskID,
		Model:          firstNonEmpty(taskModelName(task), info.OriginModelName, info.UpstreamModelName),
		UpstreamModel:  firstNonEmpty(task.Properties.UpstreamModelName, info.UpstreamModelName),
		InputPreview:   truncateByRune(task.Properties.Input, 1024),
		Extras:         buildExtrasJSON(c, info),
		Quota:          task.Quota,
		SubmitTime:     firstPositiveInt64(convertMsToSec(task.SubmitTime), time.Now().Unix()),
	}
}

func buildTaskFallbackRecord(task *model.Task) *model.GenerationRecord {
	return &model.GenerationRecord{
		TokenID:        task.PrivateData.TokenId,
		UserID:         task.UserId,
		ChannelID:      task.ChannelId,
		UserGroup:      task.Group,
		Kind:           mapTaskPlatformToKind(task.Platform),
		Platform:       string(task.Platform),
		ExternalTaskID: task.TaskID,
		Model:          taskModelName(task),
		UpstreamModel:  task.Properties.UpstreamModelName,
		InputPreview:   truncateByRune(task.Properties.Input, 1024),
		Quota:          task.Quota,
		SubmitTime:     convertMsToSec(task.SubmitTime),
	}
}

func buildMjFallbackRecord(mj *model.Midjourney) *model.GenerationRecord {
	return &model.GenerationRecord{
		TokenID:        mj.TokenId,
		UserID:         mj.UserId,
		ChannelID:      mj.ChannelId,
		Kind:           model.GenerationKindImage,
		Platform:       string(constant.TaskPlatformMidjourney),
		ExternalTaskID: mj.MjId,
		Model:          CovertMjpActionToModelName(mj.Action),
		InputPreview:   truncateByRune(firstNonEmpty(mj.Prompt, mj.Description), 1024),
		Quota:          mj.Quota,
		SubmitTime:     firstPositiveInt64(convertMsToSec(mj.SubmitTime), time.Now().Unix()),
	}
}

func buildMjSubmittedRecord(c *gin.Context, info *relaycommon.RelayInfo, mj *model.Midjourney) *model.GenerationRecord {
	return &model.GenerationRecord{
		RecordKey:      mjRecordKey(mj.UserId, mj.MjId),
		TokenID:        info.TokenId,
		UserID:         mj.UserId,
		ChannelID:      mj.ChannelId,
		TokenName:      c.GetString("token_name"),
		UserGroup:      info.UsingGroup,
		Kind:           model.GenerationKindImage,
		Status:         model.GenerationStatusPending,
		Platform:       string(constant.TaskPlatformMidjourney),
		ExternalTaskID: mj.MjId,
		Model:          firstNonEmpty(info.OriginModelName, CovertMjpActionToModelName(mj.Action)),
		UpstreamModel:  info.UpstreamModelName,
		InputPreview:   truncateByRune(firstNonEmpty(mj.Prompt, mj.Description), 1024),
		OutputURLs:     buildOutputURLsJSON(buildMjOutputURLs(mj)),
		Extras:         buildExtrasJSON(c, info),
		Quota:          mj.Quota,
		SubmitTime:     firstPositiveInt64(convertMsToSec(mj.SubmitTime), time.Now().Unix()),
	}
}

func generateServerUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func mapTaskPlatformToKind(platform constant.TaskPlatform) string {
	switch platform {
	case constant.TaskPlatformSuno:
		return model.GenerationKindMusic
	case constant.TaskPlatformMidjourney:
		return model.GenerationKindImage
	default:
		return model.GenerationKindVideo
	}
}

func convertMsToSec(ms int64) int64 {
	if ms < 1e11 {
		return ms
	}
	return ms / 1000
}

func buildExtrasJSON(c *gin.Context, info *relaycommon.RelayInfo) string {
	type extras struct {
		ClientTraceID string `json:"client_trace_id,omitempty"`
		RequestPath   string `json:"request_path,omitempty"`
	}

	if c == nil && info == nil {
		return ""
	}
	ex := extras{}
	if c != nil {
		ex.ClientTraceID = strings.TrimSpace(c.GetHeader(common.TraceIdKey))
		if c.Request != nil && c.Request.URL != nil {
			ex.RequestPath = strings.TrimSpace(c.Request.URL.Path)
		}
	}
	if info != nil && ex.RequestPath == "" {
		ex.RequestPath = strings.TrimSpace(info.RequestURLPath)
	}
	return marshalJSONString(ex)
}

func buildMjOutputURLs(mj *model.Midjourney) []dto.GenerationOutputDTO {
	if mj == nil {
		return nil
	}
	outputs := make([]dto.GenerationOutputDTO, 0, 4)
	seen := make(map[string]struct{})
	appendURL := func(kind string, url string) {
		url = strings.TrimSpace(url)
		if url == "" {
			return
		}
		key := kind + "|" + url
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		outputs = append(outputs, dto.GenerationOutputDTO{Type: kind, URL: url, Index: len(outputs)})
	}

	var imageURLs []string
	_ = common.UnmarshalJsonStr(mj.ImageUrls, &imageURLs)
	for _, url := range imageURLs {
		appendURL(model.GenerationKindImage, url)
	}
	if len(imageURLs) == 0 {
		appendURL(model.GenerationKindImage, mj.ImageUrl)
	}

	var videoURLs []dto.ImgUrls
	_ = common.UnmarshalJsonStr(mj.VideoUrls, &videoURLs)
	for _, item := range videoURLs {
		appendURL(model.GenerationKindVideo, item.Url)
	}
	if len(videoURLs) == 0 {
		appendURL(model.GenerationKindVideo, mj.VideoUrl)
	}
	return outputs
}

func BuildTaskOutputJSON(task *model.Task) string {
	if task == nil {
		return ""
	}
	url := strings.TrimSpace(task.GetResultURL())
	if url == "" {
		return ""
	}
	outputType := model.GenerationKindVideo
	if mapTaskPlatformToKind(task.Platform) == model.GenerationKindMusic {
		outputType = model.GenerationKindAudio
	}
	outputs := []dto.GenerationOutputDTO{{
		Type:  outputType,
		URL:   url,
		Index: 0,
	}}
	return marshalJSONString(outputs)
}

func buildOutputURLsJSON(outputs []dto.GenerationOutputDTO) string {
	if len(outputs) == 0 {
		return ""
	}
	return marshalJSONString(outputs)
}

func marshalJSONString(v any) string {
	data, err := common.Marshal(v)
	if err != nil || string(data) == "{}" {
		return ""
	}
	return string(data)
}

func mapAsyncTaskStatusToRecordStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case model.GenerationStatusSuccess:
		return model.GenerationStatusSuccess
	case model.GenerationStatusFailed:
		return model.GenerationStatusFailed
	case model.GenerationStatusRunning:
		return model.GenerationStatusRunning
	case model.GenerationStatusPending:
		return model.GenerationStatusPending
	}
	switch model.TaskStatus(status) {
	case model.TaskStatusSuccess:
		return model.GenerationStatusSuccess
	case model.TaskStatusFailure:
		return model.GenerationStatusFailed
	case model.TaskStatusInProgress:
		return model.GenerationStatusRunning
	case model.TaskStatusSubmitted, model.TaskStatusQueued, model.TaskStatusNotStart:
		return model.GenerationStatusPending
	default:
		return model.GenerationStatusRunning
	}
}

func mapMjStatusToRecordStatus(status string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "SUCCESS":
		return model.GenerationStatusSuccess
	case "FAILURE":
		return model.GenerationStatusFailed
	case "":
		return model.GenerationStatusPending
	default:
		return model.GenerationStatusRunning
	}
}

func errorMessageForRecordStatus(status string, reason string) string {
	if status != model.GenerationStatusFailed {
		return ""
	}
	return strings.TrimSpace(reason)
}

func firstPositiveInt64(values ...int64) int64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func truncateByRune(s string, maxRunes int) string {
	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}
	return string(runes[:maxRunes])
}
