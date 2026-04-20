package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCallbackEventTestDB(t *testing.T) {
	t.Helper()
	previousDB := DB
	previousUsingSQLite := common.UsingSQLite
	previousUsingMySQL := common.UsingMySQL
	previousUsingPostgreSQL := common.UsingPostgreSQL
	t.Cleanup(func() {
		DB = previousDB
		common.UsingSQLite = previousUsingSQLite
		common.UsingMySQL = previousUsingMySQL
		common.UsingPostgreSQL = previousUsingPostgreSQL
		InitColumnNames()
	})

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	InitColumnNames()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})

	DB = db
	require.NoError(t, DB.AutoMigrate(&CallbackEvent{}))
}

func TestGetAllCallbackEvents_ExcludeFinalAdjust(t *testing.T) {
	setupCallbackEventTestDB(t)

	require.NoError(t, InsertCallbackEvent(&CallbackEvent{
		EventID:        "event-settle",
		IdempotencyKey: "idem-settle",
		Source:         CallbackEventSourceConsume,
		EventType:      "consume.settle",
		SinkType:       CallbackEventSinkConsumeWebhook,
		RequestID:      "req-settle",
		Status:         CallbackEventStatusSucceeded,
		CallbackURL:    "https://example.com/callback",
		Body:           "{}",
		BodySHA256:     "sha-settle",
	}))
	require.NoError(t, InsertCallbackEvent(&CallbackEvent{
		EventID:        "event-final-adjust",
		IdempotencyKey: "idem-final-adjust",
		Source:         CallbackEventSourceConsume,
		EventType:      "consume.final_adjust",
		SinkType:       CallbackEventSinkConsumeWebhook,
		RequestID:      "req-final-adjust",
		Status:         CallbackEventStatusSucceeded,
		CallbackURL:    "https://example.com/callback",
		Body:           "{}",
		BodySHA256:     "sha-final-adjust",
	}))

	events, total, err := GetAllCallbackEvents(0, 20, CallbackEventQueryParams{
		ExcludeFinalAdjust: true,
	})
	require.NoError(t, err)
	require.Len(t, events, 1)
	assert.EqualValues(t, 1, total)
	assert.Equal(t, "consume.settle", events[0].EventType)
}
