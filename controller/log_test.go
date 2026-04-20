package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupLogControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Log{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func TestGetLogByKeyFiltersByRequestId(t *testing.T) {
	db := setupLogControllerTestDB(t)
	require.NoError(t, db.Create(&model.Log{
		TokenId:   11,
		RequestId: "task_target",
		CreatedAt: 1001,
		Type:      model.LogTypeConsume,
		Quota:     100,
		Other:     `{"actual_quota":150}`,
	}).Error)
	require.NoError(t, db.Create(&model.Log{
		TokenId:   11,
		RequestId: "task_other",
		CreatedAt: 1002,
		Type:      model.LogTypeConsume,
		Quota:     200,
		Other:     `{}`,
	}).Error)
	require.NoError(t, db.Create(&model.Log{
		TokenId:   12,
		RequestId: "task_target",
		CreatedAt: 1003,
		Type:      model.LogTypeConsume,
		Quota:     300,
		Other:     `{}`,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/log/token?request_id=task_target", nil)
	ctx.Set("token_id", 11)

	GetLogByKey(ctx)

	var response struct {
		Success bool        `json:"success"`
		Message string      `json:"message"`
		Data    []model.Log `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Empty(t, response.Message)
	require.Len(t, response.Data, 1)
	require.Equal(t, 11, response.Data[0].TokenId)
	require.Equal(t, "task_target", response.Data[0].RequestId)
	require.Equal(t, 100, response.Data[0].Quota)
	require.Equal(t, float64(150)/common.QuotaPerUnit, response.Data[0].AmountUSD)
}
