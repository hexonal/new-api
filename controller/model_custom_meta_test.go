package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/model_capability"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.Model{}, &model.Vendor{}))

	t.Cleanup(func() {
		require.NoError(t, model_capability.UpdateModelNSFWByJSONString(""))
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func TestRetrieveModelReturnsVendorAndNSFWForCustomModel(t *testing.T) {
	db := setupModelControllerTestDB(t)

	vendor := model.Vendor{
		Name: "Moonshot",
		Icon: "Moonshot",
	}
	require.NoError(t, db.Create(&vendor).Error)

	meta := model.Model{
		ModelName: "k2.6",
		VendorID:  vendor.Id,
		Endpoints: `{"claude_messages":{"supported":true,"path":"/v1/messages","method":"POST","request_format":"json","sdk_method":"aiApi.messages"}}`,
	}
	require.NoError(t, db.Create(&meta).Error)
	require.NoError(t, model_capability.UpdateModelNSFWByJSONString(`{"k2.6":true}`))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models/k2.6", nil)
	ctx.Params = gin.Params{{Key: "model", Value: "k2.6"}}

	RetrieveModel(ctx, 0)

	var resp dto.OpenAIModels
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &resp))
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "k2.6", resp.Id)
	require.Equal(t, "Moonshot", resp.OwnedBy)
	require.Equal(t, "Moonshot", resp.Provider)
	require.Equal(t, "Moonshot", resp.Icon)
	require.True(t, resp.NSFW)
	require.Contains(t, resp.SupportedEndpointTypes, constant.EndpointType("claude_messages"))
}
