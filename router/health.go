package router

import (
	"sync/atomic"

	"github.com/gin-gonic/gin"
)

var isDraining atomic.Bool

func SetHealthRouter(router *gin.Engine) {
	router.GET("/healthz/ready", func(c *gin.Context) {
		if isDraining.Load() {
			c.JSON(503, gin.H{"status": "draining"})
			return
		}
		c.JSON(200, gin.H{"status": "ready"})
	})
}

func MarkDraining() {
	isDraining.Store(true)
}
