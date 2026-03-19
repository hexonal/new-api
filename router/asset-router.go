package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

func SetAssetRouter(router *gin.Engine) {
	r := router.Group("/v1/assets")
	r.Use(middleware.RouteTag("asset"))
	r.Use(middleware.TokenAuth())
	{
		r.POST("/group/create", controller.CreateAssetGroup)
		r.POST("/group/list", controller.ListAssetGroups)
		r.POST("/group/get", controller.GetAssetGroup)
		r.POST("/group/update", controller.UpdateAssetGroup)
		r.POST("/create", controller.CreateAsset)
		r.POST("/list", controller.ListAssets)
		r.POST("/get", controller.GetAsset)
		r.POST("/update", controller.UpdateAsset)
		r.POST("/delete", controller.DeleteAsset)
		r.POST("/quota", controller.GetAssetQuota)
	}
}
