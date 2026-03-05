package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type CallbackEventAttempt struct {
	ID              int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	EventID         int64  `json:"event_id" gorm:"type:bigint;not null;index:idx_callback_attempt_event,priority:1"`
	AttemptNo       int    `json:"attempt_no" gorm:"type:int;not null;index:idx_callback_attempt_event,priority:2"`
	StartedAt       int64  `json:"started_at" gorm:"type:bigint;not null"`
	FinishedAt      int64  `json:"finished_at" gorm:"type:bigint;not null"`
	HTTPStatus      int    `json:"http_status" gorm:"type:int;not null;default:0"`
	Success         bool   `json:"success" gorm:"not null;default:false"`
	Error           string `json:"error" gorm:"type:text;not null;default:''"`
	ResponseSnippet string `json:"response_snippet" gorm:"type:text;not null;default:''"`
	NodeID          string `json:"node_id" gorm:"type:varchar(64);not null;default:''"`
	CreatedAt       int64  `json:"created_at" gorm:"type:bigint;not null;index"`
}

func (e *CallbackEventAttempt) BeforeCreate(tx *gorm.DB) error {
	if e.CreatedAt == 0 {
		e.CreatedAt = common.GetTimestamp()
	}
	return nil
}

func InsertCallbackEventAttempt(attempt *CallbackEventAttempt) error {
	return DB.Create(attempt).Error
}
