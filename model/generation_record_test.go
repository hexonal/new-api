package model

import (
	"bytes"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupGenerationRecordTestDB(t *testing.T) {
	t.Helper()
	var err error
	DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal("failed to open test db:", err)
	}
	err = DB.AutoMigrate(&GenerationRecord{})
	if err != nil {
		t.Fatal("failed to migrate test db:", err)
	}
}

func TestInsertPending_NewRecord(t *testing.T) {
	setupGenerationRecordTestDB(t)
	rec := &GenerationRecord{
		RecordKey:  "test:1:abc",
		TokenID:    1,
		UserID:     1,
		ChannelID:  1,
		Kind:       GenerationKindImage,
		Status:     GenerationStatusPending,
		Model:      "dall-e-3",
		SubmitTime: 1700000000,
	}
	err := InsertPending(rec)
	assert.NoError(t, err)
	assert.Greater(t, rec.RecordID, int64(0))
}

func TestInsertPending_OnConflict_DoNothing(t *testing.T) {
	setupGenerationRecordTestDB(t)
	rec := &GenerationRecord{
		RecordKey:  "test:1:dup",
		TokenID:    1,
		UserID:     1,
		ChannelID:  1,
		Kind:       GenerationKindImage,
		Status:     GenerationStatusPending,
		Model:      "dall-e-3",
		SubmitTime: 1700000000,
	}
	err := InsertPending(rec)
	assert.NoError(t, err)

	rec2 := &GenerationRecord{
		RecordKey:  "test:1:dup",
		TokenID:    1,
		UserID:     1,
		ChannelID:  1,
		Kind:       GenerationKindAudio,
		Status:     GenerationStatusSuccess,
		Model:      "tts-1",
		SubmitTime: 1700000001,
	}
	err = InsertPending(rec2)
	assert.NoError(t, err)

	var found GenerationRecord
	DB.Where("record_key = ?", "test:1:dup").First(&found)
	assert.Equal(t, GenerationKindImage, found.Kind)
	assert.Equal(t, GenerationStatusPending, found.Status)
}

func TestAdvanceStatus_CASForward(t *testing.T) {
	setupGenerationRecordTestDB(t)
	rec := &GenerationRecord{
		RecordKey:  "test:1:cas",
		TokenID:    1,
		UserID:     1,
		ChannelID:  1,
		Kind:       GenerationKindVideo,
		Status:     GenerationStatusPending,
		Model:      "kling-v1",
		SubmitTime: 1700000000,
	}
	InsertPending(rec)

	err := AdvanceStatus("test:1:cas", GenerationStatusUpdate{
		Status:    GenerationStatusRunning,
		StartTime: 1700000010,
	}, nil)
	assert.NoError(t, err)

	var found GenerationRecord
	DB.Where("record_key = ?", "test:1:cas").First(&found)
	assert.Equal(t, GenerationStatusRunning, found.Status)
	assert.Equal(t, int64(1700000010), found.StartTime)
}

func TestAdvanceStatus_RejectBackward(t *testing.T) {
	setupGenerationRecordTestDB(t)
	rec := &GenerationRecord{
		RecordKey:  "test:1:rej",
		TokenID:    1,
		UserID:     1,
		ChannelID:  1,
		Kind:       GenerationKindVideo,
		Status:     GenerationStatusSuccess,
		Model:      "kling-v1",
		SubmitTime: 1700000000,
	}
	DB.Create(rec)

	err := AdvanceStatus("test:1:rej", GenerationStatusUpdate{
		Status: GenerationStatusRunning,
	}, nil)
	assert.NoError(t, err)

	var found GenerationRecord
	DB.Where("record_key = ?", "test:1:rej").First(&found)
	assert.Equal(t, GenerationStatusSuccess, found.Status)
}

func TestAdvanceStatus_FallbackUpsert_WhenRecordNotExists(t *testing.T) {
	setupGenerationRecordTestDB(t)
	fallbackCalled := false
	err := AdvanceStatus("test:1:fallback", GenerationStatusUpdate{
		Status:     GenerationStatusSuccess,
		FinishTime: 1700000099,
	}, func() *GenerationRecord {
		fallbackCalled = true
		return &GenerationRecord{
			RecordKey:  "test:1:fallback",
			TokenID:    1,
			UserID:     1,
			ChannelID:  1,
			Kind:       GenerationKindVideo,
			Model:      "sora-v1",
			Quota:      200,
			SubmitTime: 1700000000,
		}
	})
	assert.NoError(t, err)
	assert.True(t, fallbackCalled)

	var found GenerationRecord
	DB.Where("record_key = ?", "test:1:fallback").First(&found)
	assert.Equal(t, GenerationStatusSuccess, found.Status)
	assert.Equal(t, int64(1700000099), found.FinishTime)
	assert.Equal(t, int64(1700000000), found.SubmitTime)
}

func TestAdvanceStatus_FallbackSkipped_WhenRecordExistsAhead(t *testing.T) {
	setupGenerationRecordTestDB(t)
	rec := &GenerationRecord{
		RecordKey:  "test:1:ahead",
		TokenID:    1,
		UserID:     1,
		ChannelID:  1,
		Kind:       GenerationKindVideo,
		Status:     GenerationStatusSuccess,
		Model:      "kling-v1",
		SubmitTime: 1700000000,
	}
	DB.Create(rec)

	err := AdvanceStatus("test:1:ahead", GenerationStatusUpdate{
		Status: GenerationStatusRunning,
	}, nil)
	assert.NoError(t, err)

	var found GenerationRecord
	DB.Where("record_key = ?", "test:1:ahead").First(&found)
	assert.Equal(t, GenerationStatusSuccess, found.Status)
}

func TestGetStaleRecords_ReturnsPendingAndRunning(t *testing.T) {
	setupGenerationRecordTestDB(t)

	records := []*GenerationRecord{
		{
			RecordKey:  "test:1:stale-pending",
			TokenID:    1,
			UserID:     1,
			ChannelID:  1,
			Kind:       GenerationKindVideo,
			Status:     GenerationStatusPending,
			Model:      "kling-v1",
			SubmitTime: 100,
		},
		{
			RecordKey:  "test:1:stale-running",
			TokenID:    1,
			UserID:     1,
			ChannelID:  1,
			Kind:       GenerationKindVideo,
			Status:     GenerationStatusRunning,
			Model:      "kling-v1",
			SubmitTime: 101,
		},
		{
			RecordKey:  "test:1:stale-success",
			TokenID:    1,
			UserID:     1,
			ChannelID:  1,
			Kind:       GenerationKindVideo,
			Status:     GenerationStatusSuccess,
			Model:      "kling-v1",
			SubmitTime: 102,
		},
		{
			RecordKey:  "test:1:fresh-pending",
			TokenID:    1,
			UserID:     1,
			ChannelID:  1,
			Kind:       GenerationKindVideo,
			Status:     GenerationStatusPending,
			Model:      "kling-v1",
			SubmitTime: 200,
		},
	}
	for _, rec := range records {
		assert.NoError(t, DB.Create(rec).Error)
	}

	staleRecords, err := GetStaleRecords(150, 10)
	assert.NoError(t, err)
	assert.Len(t, staleRecords, 2)

	recordKeys := make([]string, 0, len(staleRecords))
	for _, rec := range staleRecords {
		recordKeys = append(recordKeys, rec.RecordKey)
	}
	assert.ElementsMatch(t, []string{"test:1:stale-pending", "test:1:stale-running"}, recordKeys)
}

func TestPatchBilling_OnlyTerminalState(t *testing.T) {
	setupGenerationRecordTestDB(t)
	rec := &GenerationRecord{
		RecordKey:  "test:1:patchpend",
		TokenID:    1,
		UserID:     1,
		ChannelID:  1,
		Kind:       GenerationKindVideo,
		Status:     GenerationStatusPending,
		Model:      "kling-v1",
		SubmitTime: 1700000000,
	}
	DB.Create(rec)

	err := PatchBilling("test:1:patchpend", GenerationBillingPatch{Quota: 999})
	assert.NoError(t, err)

	var found GenerationRecord
	DB.Where("record_key = ?", "test:1:patchpend").First(&found)
	assert.Equal(t, 0, found.Quota)
}

func TestPatchBilling_SuccessState(t *testing.T) {
	setupGenerationRecordTestDB(t)
	rec := &GenerationRecord{
		RecordKey:  "test:1:patchsucc",
		TokenID:    1,
		UserID:     1,
		ChannelID:  1,
		Kind:       GenerationKindVideo,
		Status:     GenerationStatusSuccess,
		Model:      "kling-v1",
		Quota:      100,
		SubmitTime: 1700000000,
	}
	DB.Create(rec)

	err := PatchBilling("test:1:patchsucc", GenerationBillingPatch{Quota: 80})
	assert.NoError(t, err)

	var found GenerationRecord
	DB.Where("record_key = ?", "test:1:patchsucc").First(&found)
	assert.Equal(t, 80, found.Quota)
}

func TestMarkRefund_Idempotent(t *testing.T) {
	setupGenerationRecordTestDB(t)
	rec := &GenerationRecord{
		RecordKey:    "test:1:refund",
		TokenID:      1,
		UserID:       1,
		ChannelID:    1,
		Kind:         GenerationKindVideo,
		Status:       GenerationStatusFailed,
		Model:        "kling-v1",
		RefundStatus: RefundStatusNone,
		SubmitTime:   1700000000,
	}
	DB.Create(rec)

	err := MarkRefund("test:1:refund", GenerationRefundMark{
		RefundStatus:  RefundStatusFullRefund,
		RefundedQuota: 100,
	})
	assert.NoError(t, err)

	err = MarkRefund("test:1:refund", GenerationRefundMark{
		RefundStatus:  RefundStatusFullRefund,
		RefundedQuota: 200,
	})
	assert.NoError(t, err)

	var found GenerationRecord
	DB.Where("record_key = ?", "test:1:refund").First(&found)
	assert.Equal(t, RefundStatusFullRefund, found.RefundStatus)
	assert.Equal(t, 100, found.RefundedQuota)
}

func TestMarkRefund_MissingRecord_LogsAndReturnsNil(t *testing.T) {
	setupGenerationRecordTestDB(t)

	var logBuffer bytes.Buffer
	originalWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logBuffer
	t.Cleanup(func() {
		gin.DefaultErrorWriter = originalWriter
	})

	err := MarkRefund("test:1:missing-refund", GenerationRefundMark{
		RefundStatus:  RefundStatusFullRefund,
		RefundedQuota: 100,
	})
	assert.NoError(t, err)
	assert.Contains(t, logBuffer.String(), "MarkRefund: no rows affected for test:1:missing-refund")

	var count int64
	DB.Model(&GenerationRecord{}).Where("record_key = ?", "test:1:missing-refund").Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestGetGenerationRecords_PagePagination(t *testing.T) {
	setupGenerationRecordTestDB(t)
	for i := 0; i < 5; i++ {
		DB.Create(&GenerationRecord{
			RecordKey:  "test:42:page" + strconv.Itoa(i),
			TokenID:    42,
			UserID:     1,
			ChannelID:  1,
			Kind:       GenerationKindImage,
			Status:     GenerationStatusSuccess,
			Model:      "dall-e-3",
			SubmitTime: int64(1700000000 + i),
		})
	}
	records, total, err := GetGenerationRecords(GenerationRecordQuery{
		TokenID: 42,
		Limit:   3,
		Page:    1,
	})
	assert.NoError(t, err)
	assert.Len(t, records, 3)
	assert.Equal(t, int64(5), total)
	assert.Equal(t, int64(5), records[0].RecordID)
	assert.Equal(t, int64(3), records[2].RecordID)

	records2, total2, err := GetGenerationRecords(GenerationRecordQuery{
		TokenID: 42,
		Limit:   3,
		Page:    2,
	})
	assert.NoError(t, err)
	assert.Len(t, records2, 2)
	assert.Equal(t, int64(5), total2)
	assert.Equal(t, int64(2), records2[0].RecordID)
	assert.Equal(t, int64(1), records2[1].RecordID)
}

func TestGetGenerationRecordByID(t *testing.T) {
	setupGenerationRecordTestDB(t)
	target := &GenerationRecord{
		RecordKey:  "test:7:detail",
		TokenID:    7,
		UserID:     1,
		ChannelID:  1,
		Kind:       GenerationKindVideo,
		Status:     GenerationStatusSuccess,
		Model:      "kling-v1",
		SubmitTime: 1700000000,
	}
	DB.Create(target)

	record, err := GetGenerationRecordByID(target.RecordID, 7)
	assert.NoError(t, err)
	assert.NotNil(t, record)
	assert.Equal(t, target.RecordID, record.RecordID)

	record, err = GetGenerationRecordByID(target.RecordID, 8)
	assert.Error(t, err)
	assert.Nil(t, record)
}
