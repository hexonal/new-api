package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func getAssetUsingGroup(c *gin.Context) string {
	if g := common.GetContextKeyString(c, constant.ContextKeyUsingGroup); g != "" {
		return g
	}
	return c.GetString("group")
}

func CreateAssetGroup(c *gin.Context) {
	var req dto.AssetGroupCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	data, err := service.HandleCreateAssetGroup(c.Request.Context(), c.GetInt("id"), c.GetString("username"), getAssetUsingGroup(c), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}

func ListAssetGroups(c *gin.Context) {
	var req dto.AssetGroupListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	data, err := service.HandleListAssetGroups(c.Request.Context(), c.GetInt("id"), c.GetString("username"), getAssetUsingGroup(c), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}

func GetAssetGroup(c *gin.Context) {
	var req dto.AssetGroupGetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	data, err := service.HandleGetAssetGroup(c.Request.Context(), c.GetInt("id"), c.GetString("username"), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}

func UpdateAssetGroup(c *gin.Context) {
	var req dto.AssetGroupUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	data, err := service.HandleUpdateAssetGroup(c.Request.Context(), c.GetInt("id"), c.GetString("username"), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}

func CreateAsset(c *gin.Context) {
	var req dto.AssetCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	preferredTokenID := c.GetInt("token_id")
	if req.BillingTokenID > 0 {
		preferredTokenID = req.BillingTokenID
	}
	data, err := service.HandleCreateAsset(c.Request.Context(), c.GetInt("id"), c.GetString("username"), getAssetUsingGroup(c), preferredTokenID, c.GetString("token_name"), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}

func ListAssets(c *gin.Context) {
	var req dto.AssetListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	data, err := service.HandleListAssets(c.Request.Context(), c.GetInt("id"), c.GetString("username"), getAssetUsingGroup(c), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}

func GetAsset(c *gin.Context) {
	var req dto.AssetGetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	data, err := service.HandleGetAsset(c.Request.Context(), c.GetInt("id"), c.GetString("username"), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}

func UpdateAsset(c *gin.Context) {
	var req dto.AssetUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	data, err := service.HandleUpdateAsset(c.Request.Context(), c.GetInt("id"), c.GetString("username"), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}

func DeleteAsset(c *gin.Context) {
	var req dto.AssetDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.HandleDeleteAsset(c.GetInt("id"), req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"deleted": true})
}

func GetAssetQuota(c *gin.Context) {
	data, err := service.HandleGetAssetQuota(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}
