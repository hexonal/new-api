package controller

import (
	"bytes"
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

func setupModelMetaControllerTestDB(t *testing.T) *gorm.DB {
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

	require.NoError(t, db.AutoMigrate(&model.Model{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func TestUpdateModelMetaSortOnlyTouchesSortOrder(t *testing.T) {
	db := setupModelMetaControllerTestDB(t)
	original := &model.Model{
		Id:           501,
		ModelName:    "ima-pro-fast",
		Description:  "keep description",
		Tags:         "video,fast",
		VendorID:     9,
		SortOrder:    0,
		Endpoints:    `["responses"]`,
		Status:       1,
		SyncOfficial: 1,
		NameRule:     model.NameRuleExact,
		CreatedTime:  1000,
		UpdatedTime:  1000,
	}
	require.NoError(t, db.Create(original).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/models/?sort_only=true",
		bytes.NewBufferString(`{"id":501,"sort_order":12}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateModelMeta(ctx)

	var response struct {
		Success bool        `json:"success"`
		Message string      `json:"message"`
		Data    model.Model `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Empty(t, response.Message)
	require.Equal(t, 12, response.Data.SortOrder)

	var reloaded model.Model
	require.NoError(t, db.First(&reloaded, 501).Error)
	require.Equal(t, "ima-pro-fast", reloaded.ModelName)
	require.Equal(t, "keep description", reloaded.Description)
	require.Equal(t, "video,fast", reloaded.Tags)
	require.Equal(t, 9, reloaded.VendorID)
	require.Equal(t, `["responses"]`, reloaded.Endpoints)
	require.Equal(t, 1, reloaded.Status)
	require.Equal(t, 12, reloaded.SortOrder)
}

func TestUpdateModelMetaKeepsNonFormFieldsWhenEditPayloadOmitsThem(t *testing.T) {
	db := setupModelMetaControllerTestDB(t)
	original := &model.Model{
		Id:           601,
		ModelName:    "seedance-pro",
		Description:  "before edit",
		Icon:         "ByteDance",
		Tags:         "video,seedance",
		VendorID:     7,
		SortOrder:    88,
		Endpoints:    `["video"]`,
		Status:       1,
		SyncOfficial: 1,
		NameRule:     model.NameRulePrefix,
		CreatedTime:  1000,
		UpdatedTime:  1000,
	}
	require.NoError(t, db.Create(original).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/models/",
		bytes.NewBufferString(`{"id":601,"model_name":"seedance-pro","description":"after edit","tags":"video,seedance","vendor_id":7,"status":1,"endpoints":"[\"video\"]","sync_official":1}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateModelMeta(ctx)

	var response struct {
		Success bool        `json:"success"`
		Message string      `json:"message"`
		Data    model.Model `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Empty(t, response.Message)

	var reloaded model.Model
	require.NoError(t, db.First(&reloaded, 601).Error)
	require.Equal(t, "after edit", reloaded.Description)
	require.Equal(t, "ByteDance", reloaded.Icon)
	require.Equal(t, model.NameRulePrefix, reloaded.NameRule)
	require.Equal(t, 88, reloaded.SortOrder)
	require.Equal(t, 7, reloaded.VendorID)
	require.Equal(t, `["video"]`, reloaded.Endpoints)
}
