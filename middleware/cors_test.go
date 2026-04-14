package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSPreflightAllowsExtendedHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(CORS())
	router.OPTIONS("/v1/models", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodOptions, "/v1/models", nil)
	req.Header.Set("Origin", "http://localhost:4002")
	req.Header.Set("Access-Control-Request-Method", http.MethodGet)
	req.Header.Set(
		"Access-Control-Request-Headers",
		"authorization,x-user-id,x-env,x-app-id,x-api-key,anthropic-version,anthropic-beta,x-goog-api-key,mj-api-secret,x-youchuan-setting,x-codex-beta-features,stripe-signature,x-custom-header",
	)

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, recorder.Code)
	}

	allowHeaders := recorder.Header().Get("Access-Control-Allow-Headers")
	expectedHeaders := []string{
		"Authorization",
		"X-User-Id",
		"X-Env",
		"X-App-Id",
		"X-API-Key",
		"Anthropic-Version",
		"Anthropic-Beta",
		"X-Goog-Api-Key",
		"Mj-Api-Secret",
		"X-Youchuan-Setting",
		"X-Codex-Beta-Features",
		"Stripe-Signature",
		"X-Custom-Header",
	}

	for _, header := range expectedHeaders {
		if !allowHeaderContains(allowHeaders, header) {
			t.Fatalf("expected Access-Control-Allow-Headers to contain %q, got %q", header, allowHeaders)
		}
	}

	varyHeaders := recorder.Header().Values("Vary")
	expectedVary := []string{
		"Origin",
		"Access-Control-Request-Method",
		"Access-Control-Request-Headers",
	}
	for _, header := range expectedVary {
		if !varyHeaderContains(varyHeaders, header) {
			t.Fatalf("expected Vary to contain %q, got %v", header, varyHeaders)
		}
	}
}

func TestCORSPreflightUsesFallbackHeadersWhenRequestHeadersMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(CORS())
	router.OPTIONS("/v1/models", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodOptions, "/v1/models", nil)
	req.Header.Set("Origin", "http://localhost:4002")
	req.Header.Set("Access-Control-Request-Method", http.MethodGet)

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, recorder.Code)
	}

	allowHeaders := recorder.Header().Get("Access-Control-Allow-Headers")
	expectedHeaders := []string{
		"Authorization",
		"X-User-Id",
		"X-App-Id",
		"X-Env",
		"X-API-Key",
		"Anthropic-Version",
		"X-Goog-Api-Key",
		"Mj-Api-Secret",
		"Stripe-Signature",
	}

	for _, header := range expectedHeaders {
		if !allowHeaderContains(allowHeaders, header) {
			t.Fatalf("expected fallback Access-Control-Allow-Headers to contain %q, got %q", header, allowHeaders)
		}
	}

	varyHeaders := recorder.Header().Values("Vary")
	expectedVary := []string{
		"Origin",
		"Access-Control-Request-Method",
		"Access-Control-Request-Headers",
	}
	for _, header := range expectedVary {
		if !varyHeaderContains(varyHeaders, header) {
			t.Fatalf("expected fallback Vary to contain %q, got %v", header, varyHeaders)
		}
	}
}

func allowHeaderContains(allowHeaders string, target string) bool {
	for _, value := range strings.Split(allowHeaders, ",") {
		if strings.EqualFold(strings.TrimSpace(value), target) {
			return true
		}
	}
	return false
}

func varyHeaderContains(values []string, target string) bool {
	for _, value := range values {
		for _, item := range strings.Split(value, ",") {
			if strings.EqualFold(strings.TrimSpace(item), target) {
				return true
			}
		}
	}
	return false
}
