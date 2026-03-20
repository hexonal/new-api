package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

func TestGetModelRequest_VideoFetchByID_NoModelRequired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/videos/task_demo_123", nil)

	modelReq, shouldSelectChannel, err := getModelRequest(c)
	if err != nil {
		t.Fatalf("getModelRequest returned error: %v", err)
	}
	if shouldSelectChannel {
		t.Fatalf("shouldSelectChannel = true, want false for GET /v1/videos/{task_id}")
	}
	if modelReq == nil {
		t.Fatalf("modelReq is nil")
	}
	if modelReq.Model != "" {
		t.Fatalf("modelReq.Model = %q, want empty", modelReq.Model)
	}
}

func TestGetModelRequest_VideoSubmit_ExtractModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(`{"model":"ima-pro"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	modelReq, shouldSelectChannel, err := getModelRequest(c)
	if err != nil {
		t.Fatalf("getModelRequest returned error: %v", err)
	}
	if !shouldSelectChannel {
		t.Fatalf("shouldSelectChannel = false, want true for POST /v1/videos")
	}
	if modelReq == nil || modelReq.Model != "ima-pro" {
		t.Fatalf("modelReq.Model = %v, want ima-pro", modelReq)
	}
}

func TestDistribute_ModelLimitEnabled_VideoFetchByID_NotForbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{
			"ima-pro": true,
		})
		c.Next()
	})
	r.Use(Distribute())
	r.GET("/v1/videos/:task_id", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/videos/task_demo_123", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code == http.StatusForbidden {
		t.Fatalf("GET /v1/videos/{task_id} should not be forbidden by model-limit when model is empty")
	}
	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusNoContent)
	}
}

func TestGetModelRequest_ImageFetchByID_NoModelRequired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/images/generations/task_demo_123", nil)

	modelReq, shouldSelectChannel, err := getModelRequest(c)
	if err != nil {
		t.Fatalf("getModelRequest returned error: %v", err)
	}
	if shouldSelectChannel {
		t.Fatalf("shouldSelectChannel = true, want false for GET /v1/images/generations/{task_id}")
	}
	if modelReq == nil {
		t.Fatalf("modelReq is nil")
	}
	if modelReq.Model != "" {
		t.Fatalf("modelReq.Model = %q, want empty", modelReq.Model)
	}
}

func TestDistribute_ModelLimitEnabled_ImageFetchByID_NotForbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{
			"gemini-3-pro-image-preview": true,
		})
		c.Next()
	})
	r.Use(Distribute())
	r.GET("/v1/images/generations/:task_id", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/images/generations/task_demo_123", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code == http.StatusForbidden {
		t.Fatalf("GET /v1/images/generations/{task_id} should not be forbidden by model-limit when model is empty")
	}
	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusNoContent)
	}
}
