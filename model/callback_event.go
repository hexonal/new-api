package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	CallbackEventSourceConsume  = "consume"
	CallbackEventSourceOperator = "operator"
	CallbackEventSourceFeishu   = "feishu"
)

const (
	CallbackEventSinkConsumeWebhook  = "consume_webhook"
	CallbackEventSinkOperatorWebhook = "operator_webhook"
	CallbackEventSinkFeishuWebhook   = "feishu_webhook"
)

const (
	CallbackEventStatusPending    = "pending"
	CallbackEventStatusProcessing = "processing"
	CallbackEventStatusRetryWait  = "retry_wait"
	CallbackEventStatusSucceeded  = "succeeded"
	CallbackEventStatusDead       = "dead"
	CallbackEventStatusCancelled  = "cancelled"
)

type CallbackEvent struct {
	ID             int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	EventID        string `json:"event_id" gorm:"type:varchar(40);uniqueIndex;not null"`
	IdempotencyKey string `json:"idempotency_key" gorm:"type:varchar(160);not null;uniqueIndex:idx_sink_idempotency,priority:2"`
	Source         string `json:"source" gorm:"type:varchar(24);not null;index"`
	EventType      string `json:"event_type" gorm:"type:varchar(64);not null;index"`
	SinkType       string `json:"sink_type" gorm:"type:varchar(24);not null;uniqueIndex:idx_sink_idempotency,priority:1;index"`

	RequestID   string `json:"request_id" gorm:"type:varchar(64);index"`
	UserID      int    `json:"user_id" gorm:"index"`
	TokenID     int    `json:"token_id" gorm:"index"`
	CallbackURL string `json:"callback_url" gorm:"type:text;not null"`
	HTTPMethod  string `json:"http_method" gorm:"type:varchar(8);not null;default:'POST'"`
	Headers     string `json:"headers" gorm:"type:text;not null;default:'{}'"`
	ContentType string `json:"content_type" gorm:"type:varchar(64);not null;default:'application/json'"`
	Body        string `json:"body" gorm:"type:text;not null"`
	BodySHA256  string `json:"body_sha256" gorm:"type:char(64);not null"`

	Status       string `json:"status" gorm:"type:varchar(16);not null;index:idx_callback_status_next,priority:1;index:idx_callback_status_locked,priority:1"`
	AttemptCount int    `json:"attempt_count" gorm:"type:int;not null;default:0"`
	MaxRetries   int    `json:"max_retries" gorm:"type:int;not null;default:3"`
	NextRetryAt  int64  `json:"next_retry_at" gorm:"type:bigint;not null;index:idx_callback_status_next,priority:2"`

	LockedBy string `json:"locked_by" gorm:"type:varchar(64);not null;default:''"`
	LockedAt int64  `json:"locked_at" gorm:"type:bigint;not null;default:0;index:idx_callback_status_locked,priority:2"`

	FirstAttemptAt int64  `json:"first_attempt_at" gorm:"type:bigint;not null;default:0"`
	LastAttemptAt  int64  `json:"last_attempt_at" gorm:"type:bigint;not null;default:0"`
	SucceededAt    int64  `json:"succeeded_at" gorm:"type:bigint;not null;default:0"`
	LastHTTPStatus int    `json:"last_http_status" gorm:"type:int;not null;default:0"`
	LastError      string `json:"last_error" gorm:"type:text;not null;default:''"`

	CreatedAt int64 `json:"created_at" gorm:"type:bigint;not null;index"`
	UpdatedAt int64 `json:"updated_at" gorm:"type:bigint;not null;index"`
}

func (e *CallbackEvent) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	if e.CreatedAt == 0 {
		e.CreatedAt = now
	}
	if e.UpdatedAt == 0 {
		e.UpdatedAt = now
	}
	if e.NextRetryAt == 0 {
		e.NextRetryAt = now
	}
	if strings.TrimSpace(e.Status) == "" {
		e.Status = CallbackEventStatusPending
	}
	if strings.TrimSpace(e.HTTPMethod) == "" {
		e.HTTPMethod = "POST"
	}
	if strings.TrimSpace(e.Headers) == "" {
		e.Headers = "{}"
	}
	if strings.TrimSpace(e.ContentType) == "" {
		e.ContentType = "application/json"
	}
	return nil
}

func (e *CallbackEvent) BeforeUpdate(tx *gorm.DB) error {
	e.UpdatedAt = common.GetTimestamp()
	return nil
}

func InsertCallbackEvent(event *CallbackEvent) error {
	return DB.Create(event).Error
}

func CallbackEventExistsBySinkAndIdempotency(sinkType, idempotencyKey string) (bool, error) {
	var cnt int64
	err := DB.Model(&CallbackEvent{}).
		Where("sink_type = ? AND idempotency_key = ?", sinkType, idempotencyKey).
		Count(&cnt).Error
	return cnt > 0, err
}

func ClaimDueCallbackEvents(limit int, workerID string, leaseSeconds int64) ([]*CallbackEvent, error) {
	if limit <= 0 {
		return nil, nil
	}
	if leaseSeconds <= 0 {
		leaseSeconds = 30
	}

	now := common.GetTimestamp()
	staleBefore := now - leaseSeconds
	readyStatuses := []string{CallbackEventStatusPending, CallbackEventStatusRetryWait}
	events := make([]*CallbackEvent, 0, limit)

	err := DB.Transaction(func(tx *gorm.DB) error {
		// Recover stale processing events to keep at-least-once delivery.
		// If a worker crashes after claiming, the lease timeout lets another worker reclaim it.
		_ = tx.Model(&CallbackEvent{}).
			Where("status = ? AND locked_at > 0 AND locked_at <= ?", CallbackEventStatusProcessing, staleBefore).
			Updates(map[string]interface{}{
				"status":        CallbackEventStatusRetryWait,
				"locked_by":     "",
				"locked_at":     0,
				"next_retry_at": now,
			}).Error

		var candidateIDs []int64
		if err := tx.Model(&CallbackEvent{}).
			Where("status IN ? AND next_retry_at <= ?", readyStatuses, now).
			Order("next_retry_at ASC, id ASC").
			Limit(limit).
			Pluck("id", &candidateIDs).Error; err != nil {
			return err
		}
		if len(candidateIDs) == 0 {
			return nil
		}

		claimedIDs := make([]int64, 0, len(candidateIDs))
		for _, id := range candidateIDs {
			// CAS-style claim: only promote rows that are still due and in claimable states.
			res := tx.Model(&CallbackEvent{}).
				Where("id = ? AND status IN ? AND next_retry_at <= ?", id, readyStatuses, now).
				Updates(map[string]interface{}{
					"status":    CallbackEventStatusProcessing,
					"locked_by": workerID,
					"locked_at": now,
				})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected > 0 {
				claimedIDs = append(claimedIDs, id)
			}
		}
		if len(claimedIDs) == 0 {
			return nil
		}

		return tx.Where("id IN ?", claimedIDs).
			Order("next_retry_at ASC, id ASC").
			Find(&events).Error
	})
	if err != nil {
		return nil, err
	}
	return events, nil
}

func MarkCallbackEventSucceeded(id int64, attemptCount int, httpStatus int, firstAttemptAt int64, finishedAt int64) error {
	return DB.Model(&CallbackEvent{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":           CallbackEventStatusSucceeded,
			"attempt_count":    attemptCount,
			"first_attempt_at": firstAttemptAt,
			"last_attempt_at":  finishedAt,
			"succeeded_at":     finishedAt,
			"last_http_status": httpStatus,
			"last_error":       "",
			"locked_by":        "",
			"locked_at":        0,
			"next_retry_at":    finishedAt,
		}).Error
}

func MarkCallbackEventRetryWait(id int64, attemptCount int, nextRetryAt int64, httpStatus int, errMsg string, firstAttemptAt int64, finishedAt int64) error {
	return DB.Model(&CallbackEvent{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":           CallbackEventStatusRetryWait,
			"attempt_count":    attemptCount,
			"first_attempt_at": firstAttemptAt,
			"last_attempt_at":  finishedAt,
			"last_http_status": httpStatus,
			"last_error":       trimErrorForStorage(errMsg),
			"locked_by":        "",
			"locked_at":        0,
			"next_retry_at":    nextRetryAt,
		}).Error
}

func MarkCallbackEventDead(id int64, attemptCount int, httpStatus int, errMsg string, firstAttemptAt int64, finishedAt int64) error {
	return DB.Model(&CallbackEvent{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":           CallbackEventStatusDead,
			"attempt_count":    attemptCount,
			"first_attempt_at": firstAttemptAt,
			"last_attempt_at":  finishedAt,
			"last_http_status": httpStatus,
			"last_error":       trimErrorForStorage(errMsg),
			"locked_by":        "",
			"locked_at":        0,
			"next_retry_at":    0,
		}).Error
}

func trimErrorForStorage(errMsg string) string {
	errMsg = strings.TrimSpace(errMsg)
	if len(errMsg) <= 8000 {
		return errMsg
	}
	return errMsg[:8000]
}
