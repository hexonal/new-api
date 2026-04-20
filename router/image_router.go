package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetImageTaskRouter(router *gin.Engine) {
	g := router.Group("/v1")
	g.Use(middleware.RouteTag("relay"))
	g.Use(middleware.SystemPerformanceCheck())
	g.Use(middleware.TokenAuth(), middleware.Distribute())
	{
		g.POST("/images", controller.RelayImageTaskSubmit)
		g.GET("/images/:task_id", controller.RelayImageTaskFetch)
	}
}
