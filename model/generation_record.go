package model

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/QuantumNous/new-api/logger"
)

// ========== 枚举常量 ==========

const (
	GenerationKindImage = "image"
	GenerationKindAudio = "audio"
	GenerationKindVideo = "video"
	GenerationKindMusic = "music"
)

const (
	GenerationStatusPending = "pending"
	GenerationStatusRunning = "running"
	GenerationStatusSuccess = "success"
	GenerationStatusFailed  = "failed"
)

const (
	RefundStatusNone        = "none"
	RefundStatusFullRefund  = "full_refund"
	RefundStatusDeltaRefund = "delta_refund"
	RefundStatusFailed      = "refund_failed"
)

// ========== Struct ==========

// GenerationRecord 生成调用统一记录表
type GenerationRecord struct {
	RecordID         int64  `json:"record_id" gorm:"column:record_id;primaryKey;autoIncrement;index:idx_gr_token_record,priority:2"`
	RecordKey        string `json:"record_key" gorm:"type:varchar(191);uniqueIndex:uk_record_key;not null"`
	TokenID          int    `json:"token_id" gorm:"not null;index:idx_gr_token_record,priority:1"`
	UserID           int    `json:"user_id" gorm:"not null;index"`
	ChannelID        int    `json:"channel_id" gorm:"not null"`
	Token            string `json:"token" gorm:"type:varchar(191);default:''"`
	UserGroup        string `json:"user_group" gorm:"type:varchar(50);default:''"`
	Kind             string `json:"kind" gorm:"type:varchar(32);not null"`
	Status           string `json:"status" gorm:"type:varchar(16);not null"`
	Platform         string `json:"platform" gorm:"type:varchar(32);default:'';index:idx_gr_platform_task,priority:1"`
	ExternalTaskID   string `json:"external_task_id" gorm:"type:varchar(191);default:'';index:idx_gr_platform_task,priority:2"`
	Model            string `json:"model" gorm:"type:varchar(128);not null"`
	UpstreamModel    string `json:"upstream_model" gorm:"type:varchar(128);default:''"`
	RequestBody      string `json:"request_body" gorm:"type:text"`
	ResponseBody     string `json:"response_body" gorm:"type:text"`
	Extras           string `json:"extras" gorm:"type:text"`
	ErrorMessage     string `json:"error_message" gorm:"type:text"`
	Quota            int    `json:"quota" gorm:"default:0"`
	PromptTokens     int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens int    `json:"completion_tokens" gorm:"default:0"`
	TotalTokens      int    `json:"total_tokens" gorm:"default:0"`
	RefundStatus     string `json:"refund_status" gorm:"type:varchar(16);default:'none'"`
	RefundedQuota    int    `json:"refunded_quota" gorm:"default:0"`
	RefundTime       int64  `json:"refund_time" gorm:"default:0"`
	SubmitTime       int64  `json:"submit_time" gorm:"not null"`
	StartTime        int64  `json:"start_time" gorm:"default:0"`
	FinishTime       int64  `json:"finish_time" gorm:"default:0"`
	CreatedAt        int64  `json:"created_at" gorm:"autoCreateTime;not null"`
	UpdatedAt        int64  `json:"updated_at" gorm:"autoUpdateTime;not null"`
}

func (GenerationRecord) TableName() string {
	return "generation_records"
}

// ========== 四套状态原语 ==========

// InsertPending 用于首次插入，冲突时不做任何操作
func InsertPending(rec *GenerationRecord) error {
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "record_key"}},
		DoNothing: true,
	}).Create(rec).Error
}

// GenerationStatusUpdate 状态推进参数
type GenerationStatusUpdate struct {
	Status       string
	ResponseBody string
	ErrorMessage string
	Quota        int
	StartTime    int64
	FinishTime   int64
}

func allowedPreviousStatus(newStatus string) []string {
	switch newStatus {
	case GenerationStatusRunning:
		return []string{GenerationStatusPending}
	case GenerationStatusSuccess, GenerationStatusFailed:
		return []string{GenerationStatusPending, GenerationStatusRunning}
	default:
		return nil
	}
}

// AdvanceStatus CAS 前进 + 降级 InsertDoNothing + CAS 重试
func AdvanceStatus(
	recordKey string,
	update GenerationStatusUpdate,
	fallbackBuilder func() *GenerationRecord,
) error {
	allowed := allowedPreviousStatus(update.Status)
	if len(allowed) == 0 {
		return errors.New("invalid target status: " + update.Status)
	}

	updates := buildAdvanceUpdates(update)
	result := DB.Model(&GenerationRecord{}).
		Where("record_key = ? AND status IN ?", recordKey, allowed).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected > 0 {
		return nil
	}

	var existing GenerationRecord
	err := DB.Where("record_key = ?", recordKey).
		Select("record_id", "status").First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if fallbackBuilder == nil {
		return errors.New("record not found and no fallback")
	}
	fallback := fallbackBuilder()
	fallback.RecordKey = recordKey
	fallback.Status = GenerationStatusPending

	if insertErr := DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "record_key"}},
		DoNothing: true,
	}).Create(fallback).Error; insertErr != nil {
		return insertErr
	}

	allAllowed := append(allowed, GenerationStatusPending)
	retryResult := DB.Model(&GenerationRecord{}).
		Where("record_key = ? AND status IN ?", recordKey, allAllowed).
		Updates(updates)
	return retryResult.Error
}

// buildAdvanceUpdates 构造 GORM Updates 参数
// 注意：此处使用 map[string]interface{} 是 GORM ORM API 的必要用法
// （struct 传入 Updates 会忽略零值字段，无法实现 patch 语义）
// 业务数据结构一律用具名 struct（如 GenerationStatusUpdate）
func buildAdvanceUpdates(u GenerationStatusUpdate) map[string]interface{} {
	m := map[string]interface{}{
		"status":     u.Status,
		"updated_at": time.Now().Unix(),
	}
	if u.ResponseBody != "" {
		m["response_body"] = u.ResponseBody
	}
	if u.ErrorMessage != "" {
		m["error_message"] = u.ErrorMessage
	}
	if u.Quota > 0 {
		m["quota"] = u.Quota
	}
	if u.StartTime > 0 {
		m["start_time"] = u.StartTime
	}
	if u.FinishTime > 0 {
		m["finish_time"] = u.FinishTime
	}
	return m
}

// GenerationBillingPatch 计费 patch 参数
type GenerationBillingPatch struct {
	Quota            int
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

// PatchBilling 只更新计费字段，不推进状态
func PatchBilling(recordKey string, patch GenerationBillingPatch) error {
	updates := map[string]interface{}{"updated_at": time.Now().Unix()}
	if patch.Quota > 0 {
		updates["quota"] = patch.Quota
	}
	if patch.PromptTokens > 0 {
		updates["prompt_tokens"] = patch.PromptTokens
	}
	if patch.CompletionTokens > 0 {
		updates["completion_tokens"] = patch.CompletionTokens
	}
	if patch.TotalTokens > 0 {
		updates["total_tokens"] = patch.TotalTokens
	}
	if len(updates) == 1 {
		return nil
	}
	result := DB.Model(&GenerationRecord{}).
		Where("record_key = ? AND status IN ?", recordKey, []string{GenerationStatusSuccess, GenerationStatusFailed}).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		logger.LogError(context.Background(), "PatchBilling: no rows affected for "+recordKey)
	}
	return nil
}

// GenerationRefundMark 退款标记参数
type GenerationRefundMark struct {
	RefundStatus  string
	RefundedQuota int
}

// MarkRefund 标记退款，幂等（WHERE refund_status='none'）
func MarkRefund(recordKey string, mark GenerationRefundMark) error {
	if mark.RefundStatus == "" || mark.RefundStatus == RefundStatusNone {
		return errors.New("invalid refund status")
	}
	updates := map[string]interface{}{
		"refund_status":  mark.RefundStatus,
		"refunded_quota": mark.RefundedQuota,
		"refund_time":    time.Now().Unix(),
		"updated_at":     time.Now().Unix(),
	}
	result := DB.Model(&GenerationRecord{}).
		Where("record_key = ? AND refund_status = ?", recordKey, RefundStatusNone).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		logger.LogError(context.Background(), "MarkRefund: no rows affected for "+recordKey)
	}
	return nil
}

// ========== 查询 ==========

// GenerationRecordQuery 查询参数
type GenerationRecordQuery struct {
	TokenID   int
	UserID    int
	Limit     int
	Page      int
	StartTime int64
	EndTime   int64
	Kind      string
	Status    string
	Platform  string
	Token     string
}

// GetGenerationRecords 单表标准分页查询
func GetGenerationRecords(q GenerationRecordQuery) ([]*GenerationRecord, int64, error) {
	if q.TokenID <= 0 {
		return nil, 0, errors.New("invalid token_id")
	}
	return listGenerationRecords(q)
}

// GetUserGenerationRecords 查询当前登录用户的生成记录
func GetUserGenerationRecords(userID int, q GenerationRecordQuery) ([]*GenerationRecord, int64, error) {
	if userID <= 0 {
		return nil, 0, errors.New("invalid user_id")
	}
	q.UserID = userID
	return listGenerationRecords(q)
}

// GetAllGenerationRecords 查询全局生成记录（管理员视角）
func GetAllGenerationRecords(q GenerationRecordQuery) ([]*GenerationRecord, int64, error) {
	return listGenerationRecords(q)
}

func listGenerationRecords(q GenerationRecordQuery) ([]*GenerationRecord, int64, error) {
	limit, page := normalizeGenerationRecordPagination(q.Limit, q.Page)
	tx := buildGenerationRecordQuery(DB.Model(&GenerationRecord{}), q)
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * limit
	var records []*GenerationRecord
	err := tx.Order("record_id DESC").Offset(offset).Limit(limit).Find(&records).Error
	return records, total, err
}

func buildGenerationRecordQuery(tx *gorm.DB, q GenerationRecordQuery) *gorm.DB {
	if q.TokenID > 0 {
		tx = tx.Where("token_id = ?", q.TokenID)
	}
	if q.Token != "" {
		tx = tx.Where("token = ?", q.Token)
	}
	if q.UserID > 0 {
		tx = tx.Where("user_id = ?", q.UserID)
	}
	if q.StartTime > 0 {
		tx = tx.Where("submit_time >= ?", q.StartTime)
	}
	if q.EndTime > 0 {
		tx = tx.Where("submit_time <= ?", q.EndTime)
	}
	if q.Kind != "" {
		tx = tx.Where("kind = ?", q.Kind)
	}
	if q.Status != "" {
		tx = tx.Where("status = ?", q.Status)
	}
	if q.Platform != "" {
		tx = tx.Where("platform = ?", q.Platform)
	}
	return tx
}

func normalizeGenerationRecordPagination(limit, page int) (int, int) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	return limit, page
}

func GetGenerationRecordByID(recordID int64, tokenID int) (*GenerationRecord, error) {
	if recordID <= 0 {
		return nil, errors.New("invalid record_id")
	}
	if tokenID <= 0 {
		return nil, errors.New("invalid token_id")
	}
	record := &GenerationRecord{}
	err := DB.Where("record_id = ? AND token_id = ?", recordID, tokenID).First(record).Error
	if err != nil {
		return nil, err
	}
	return record, nil
}

func GenerationRecordExists(recordKey string) (bool, error) {
	record := &GenerationRecord{}
	err := DB.Select("record_id").Where("record_key = ?", recordKey).Take(record).Error
	if err == nil {
		return true, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return false, err
}

// GetStaleRecords 查询超时仍未结束的记录
func GetStaleRecords(cutoffUnix int64, limit int) ([]*GenerationRecord, error) {
	var records []*GenerationRecord
	err := DB.Where("status IN ? AND submit_time < ?", []string{GenerationStatusPending, GenerationStatusRunning}, cutoffUnix).
		Order("record_id ASC").Limit(limit).Find(&records).Error
	return records, err
}

// ========== 工具函数 ==========

// GenerateRecordID 生成 16 字节 hex 随机字符串
func GenerateRecordID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
