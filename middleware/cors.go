package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// gin-contrib/cors does not treat AllowHeaders=["*"] as a wildcard
// for preflight responses, so we keep an explicit fallback list here.
var corsAllowHeaders = []string{
	"Origin",
	"Accept",
	"Accept-Language",
	"Authorization",
	"Cache-Control",
	"Content-Length",
	"Content-Type",
	"Content-Disposition",
	"Content-Encoding",
	"Pragma",
	"X-Requested-With",
	"Anthropic-Beta",
	"Anthropic-Version",
	"Mj-Api-Secret",
	"X-User-Id",
	"X-App-Id",
	"X-Env",
	"X-API-Key",
	"X-Codex-Beta-Features",
	"X-Forwarded-Host",
	"X-Forwarded-Proto",
	"X-Forwarded-Protocol",
	"X-Goog-Api-Key",
	"X-Youchuan-Setting",
	"New-Api-User",
	"Originator",
	"Sec-Websocket-Extensions",
	"Sec-WebSocket-Key",
	"Sec-WebSocket-Protocol",
	"Sec-Websocket-Version",
	"Session_id",
	"Stripe-Signature",
	common.TraceIdKey,
	common.RequestIdKey,
}

func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowCredentials = false
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}
	config.AllowHeaders = nil
	base := cors.New(config)

	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions {
			addCORSVaryHeaders(c)
			c.Header("Access-Control-Allow-Headers", buildCORSAllowHeaders(c.GetHeader("Access-Control-Request-Headers")))
		}
		base(c)
	}
}

func addCORSVaryHeaders(c *gin.Context) {
	c.Header("Vary", "Origin")
	c.Writer.Header().Add("Vary", "Access-Control-Request-Method")
	c.Writer.Header().Add("Vary", "Access-Control-Request-Headers")
}

func buildCORSAllowHeaders(requested string) string {
	headers := canonicalizeHeaderList(requested)
	if len(headers) == 0 {
		headers = corsAllowHeaders
	}
	return strings.Join(headers, ",")
}

func canonicalizeHeaderList(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	seen := make(map[string]struct{})
	headers := make([]string, 0)
	for _, value := range strings.Split(raw, ",") {
		header := http.CanonicalHeaderKey(strings.TrimSpace(value))
		if header == "" {
			continue
		}
		key := strings.ToLower(header)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		headers = append(headers, header)
	}
	return headers
}

func PoweredBy() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-New-Api-Version", common.Version)
		c.Next()
	}
}
