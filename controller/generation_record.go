package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

type SearchGenerationRecordsReq struct {
	Page      int    `json:"page"`
	PageSize  int    `json:"page_size"`
	StartTime int64  `json:"start_time,omitempty"`
	EndTime   int64  `json:"end_time,omitempty"`
	Kind      string `json:"kind,omitempty"`
	Status    string `json:"status,omitempty"`
	Platform  string `json:"platform,omitempty"`
}

func SearchTokenGenerationRecords(c *gin.Context) {
	tokenID, ok := getGenerationRecordTokenID(c)
	if !ok {
		return
	}
	var req SearchGenerationRecordsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo := newGenerationRecordPageInfo(req)
	records, total, err := model.GetGenerationRecords(newGenerationRecordQuery(tokenID, req, pageInfo))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetItems(toGenerationRecordDTOs(records))
	pageInfo.SetTotal(int(total))
	common.ApiSuccess(c, pageInfo)
}

func GetTokenGenerationRecord(c *gin.Context) {
	tokenID, ok := getGenerationRecordTokenID(c)
	if !ok {
		return
	}
	recordID, err := parseGenerationRecordID(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	record, err := model.GetGenerationRecordByID(recordID, tokenID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toGenerationRecordDTO(record))
}

func getGenerationRecordTokenID(c *gin.Context) (int, bool) {
	tokenID := c.GetInt("token_id")
	if tokenID <= 0 {
		common.ApiErrorMsg(c, "invalid token")
		return 0, false
	}
	return tokenID, true
}

func newGenerationRecordPageInfo(req SearchGenerationRecordsReq) *common.PageInfo {
	pageInfo := &common.PageInfo{
		Page:     req.Page,
		PageSize: req.PageSize,
	}
	if pageInfo.Page < 1 {
		pageInfo.Page = 1
	}
	if pageInfo.PageSize <= 0 {
		pageInfo.PageSize = 20
	}
	if pageInfo.PageSize > 100 {
		pageInfo.PageSize = 100
	}
	return pageInfo
}

func newGenerationRecordQuery(
	tokenID int,
	req SearchGenerationRecordsReq,
	pageInfo *common.PageInfo,
) model.GenerationRecordQuery {
	return model.GenerationRecordQuery{
		TokenID:   tokenID,
		Limit:     pageInfo.PageSize,
		Page:      pageInfo.Page,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Kind:      strings.TrimSpace(req.Kind),
		Status:    strings.TrimSpace(req.Status),
		Platform:  strings.TrimSpace(req.Platform),
	}
}

func parseGenerationRecordID(raw string) (int64, error) {
	recordID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, errors.New("invalid generation record id")
	}
	if recordID <= 0 {
		return 0, errors.New("invalid generation record id")
	}
	return recordID, nil
}

func toGenerationRecordDTOs(records []*model.GenerationRecord) []dto.GenerationRecordDTO {
	items := make([]dto.GenerationRecordDTO, 0, len(records))
	for _, record := range records {
		items = append(items, toGenerationRecordDTO(record))
	}
	return items
}

func toGenerationRecordDTO(r *model.GenerationRecord) dto.GenerationRecordDTO {
	d := dto.GenerationRecordDTO{
		ID:               r.RecordID,
		Kind:             r.Kind,
		Status:           r.Status,
		Model:            r.Model,
		Platform:         r.Platform,
		TaskID:           r.ExternalTaskID,
		InputPreview:     r.InputPreview,
		Quota:            r.Quota,
		PromptTokens:     r.PromptTokens,
		CompletionTokens: r.CompletionTokens,
		TotalTokens:      r.TotalTokens,
		ErrorMessage:     r.ErrorMessage,
		Refunded:         r.RefundedQuota > 0,
		RefundedQuota:    r.RefundedQuota,
		SubmitTime:       r.SubmitTime,
		StartTime:        r.StartTime,
		FinishTime:       r.FinishTime,
		Outputs:          []dto.GenerationOutputDTO{},
	}
	if r.OutputURLs != "" {
		var outputs []dto.GenerationOutputDTO
		if err := common.UnmarshalJsonStr(r.OutputURLs, &outputs); err == nil && outputs != nil {
			d.Outputs = outputs
		}
	}
	if r.Extras != "" {
		var extras struct {
			ClientTraceID string `json:"client_trace_id,omitempty"`
		}
		if err := common.UnmarshalJsonStr(r.Extras, &extras); err == nil {
			d.RequestID = extras.ClientTraceID
		}
	}
	return d
}
