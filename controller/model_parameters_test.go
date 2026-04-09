package controller

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/model_capability"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelParameterControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	prevDB := model.DB
	prevLogDB := model.LOG_DB
	prevUsingSQLite := common.UsingSQLite
	prevUsingMySQL := common.UsingMySQL
	prevUsingPostgreSQL := common.UsingPostgreSQL
	prevRedisEnabled := common.RedisEnabled

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.Model{}))

	t.Cleanup(func() {
		model.DB = prevDB
		model.LOG_DB = prevLogDB
		common.UsingSQLite = prevUsingSQLite
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
		common.RedisEnabled = prevRedisEnabled
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func TestResolveModelParametersMergesDefaultsAndDBOverrides(t *testing.T) {
	db := setupModelParameterControllerTestDB(t)

	min := 0.0
	max := 1.0
	raw, err := common.Marshal(map[string]model_capability.ModelParameterDef{
		"temperature": {
			Type:        "number",
			Description: "Custom temperature.",
			Default:     0.3,
			Min:         &min,
			Max:         &max,
		},
		"custom_mode": {
			Type: "string",
			Enum: []string{"fast", "safe"},
		},
	})
	require.NoError(t, err)

	require.NoError(t, db.Create(&model.Model{
		ModelName:   "gpt-4o",
		Parameters:  string(raw),
		Status:      1,
		CreatedTime: 1,
		UpdatedTime: 1,
	}).Error)

	params := resolveModelParameters("gpt-4o")

	require.Contains(t, params, "max_tokens")
	require.Contains(t, params, "custom_mode")
	require.Equal(t, "Custom temperature.", params["temperature"].Description)
	require.Equal(t, 0.3, params["temperature"].Default)
}

func TestResolveModelParametersFallsBackToDefaults(t *testing.T) {
	setupModelParameterControllerTestDB(t)

	params := resolveModelParameters("claude-3-5-sonnet")

	require.Contains(t, params, "temperature")
	require.Contains(t, params, "max_tokens")
	require.NotContains(t, params, "response_format")
}
