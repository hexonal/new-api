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
	Page      int    `json:"page" form:"page"`
	PageSize  int    `json:"page_size" form:"page_size"`
	StartTime int64  `json:"start_time,omitempty" form:"start_time"`
	EndTime   int64  `json:"end_time,omitempty" form:"end_time"`
	Kind      string `json:"kind,omitempty" form:"kind"`
	Status    string `json:"status,omitempty" form:"status"`
	Platform  string `json:"platform,omitempty" form:"platform"`
	Token     string `json:"token,omitempty" form:"token"`
	TokenID   int    `json:"-" form:"token_id"`
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
	req.TokenID = tokenID
	records, total, err := model.GetGenerationRecords(newGenerationRecordQuery(req, pageInfo))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	writeGenerationRecordPage(c, pageInfo, records, total)
}

func SearchUserGenerationRecords(c *gin.Context) {
	userID := c.GetInt("id")
	if userID <= 0 {
		common.ApiErrorMsg(c, "invalid user")
		return
	}
	req := newGenerationRecordReqFromQuery(c)
	pageInfo := newGenerationRecordPageInfo(req)
	records, total, err := model.GetUserGenerationRecords(userID, newGenerationRecordQuery(req, pageInfo))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	writeGenerationRecordPage(c, pageInfo, records, total)
}

func SearchAllGenerationRecords(c *gin.Context) {
	req := newGenerationRecordReqFromQuery(c)
	pageInfo := newGenerationRecordPageInfo(req)
	records, total, err := model.GetAllGenerationRecords(newGenerationRecordQuery(req, pageInfo))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	writeGenerationRecordPage(c, pageInfo, records, total)
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

func newGenerationRecordReqFromQuery(c *gin.Context) SearchGenerationRecordsReq {
	pageInfo := common.GetPageQuery(c)
	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)
	tokenID, _ := strconv.Atoi(c.Query("token_id"))
	return SearchGenerationRecordsReq{
		Page:      pageInfo.Page,
		PageSize:  pageInfo.PageSize,
		StartTime: startTime,
		EndTime:   endTime,
		Kind:      c.Query("kind"),
		Status:    c.Query("status"),
		Platform:  c.Query("platform"),
		Token:     c.Query("token"),
		TokenID:   tokenID,
	}
}

func newGenerationRecordQuery(
	req SearchGenerationRecordsReq,
	pageInfo *common.PageInfo,
) model.GenerationRecordQuery {
	return model.GenerationRecordQuery{
		TokenID:   req.TokenID,
		Limit:     pageInfo.PageSize,
		Page:      pageInfo.Page,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Kind:      strings.TrimSpace(req.Kind),
		Status:    strings.TrimSpace(req.Status),
		Platform:  strings.TrimSpace(req.Platform),
		Token:     strings.TrimSpace(req.Token),
	}
}

func writeGenerationRecordPage(
	c *gin.Context,
	pageInfo *common.PageInfo,
	records []*model.GenerationRecord,
	total int64,
) {
	pageInfo.SetItems(toGenerationRecordDTOs(records))
	pageInfo.SetTotal(int(total))
	common.ApiSuccess(c, pageInfo)
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
		Token:            r.TokenName,
		Kind:             r.Kind,
		Status:           r.Status,
		Model:            r.Model,
		Platform:         r.Platform,
		TaskID:           r.ExternalTaskID,
		RequestBody:      r.RequestBody,
		ResponseBody:     r.ResponseBody,
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
