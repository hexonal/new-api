package router

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSetApiRouterRegistersOperatorTokenExistsRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)

	engine := gin.New()
	SetApiRouter(engine)

	for _, route := range engine.Routes() {
		if route.Method == http.MethodGet && route.Path == "/api/operator/token/exists" {
			return
		}
	}

	t.Fatalf("expected GET /api/operator/token/exists to be registered")
}
