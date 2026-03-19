package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

func TestIsUserPointsGuardPath(t *testing.T) {
	cases := []struct {
		method string
		path   string
		want   bool
	}{
		{method: "POST", path: "/v1/chat/completions", want: true},
		{method: "POST", path: "/v1/messages", want: true},
		{method: "POST", path: "/v1/responses", want: true},
		{method: "POST", path: "/v1/responses/compact", want: true},
		{method: "POST", path: "/v1/embeddings", want: true},
		{method: "POST", path: "/v1/models/gemini:generateContent", want: true},
		{method: "POST", path: "/v1beta/models/gemini-2.0-flash:generateContent", want: true},
		{method: "POST", path: "/v1/models", want: false},
		{method: "GET", path: "/v1/models", want: false},
		{method: "GET", path: "/v1/models/gpt-4o", want: false},
		{method: "GET", path: "/v1beta/models", want: false},
		{method: "GET", path: "/v1beta/openai/models", want: false},
		{method: "GET", path: "/v1/chat/completions", want: false},
		{method: "POST", path: "/v1/files", want: false},
		{method: "POST", path: "/v1beta/openai/models", want: false},
		{method: "POST", path: "/v1/dashboard/billing/usage", want: false},
	}
	for _, tc := range cases {
		got := isUserPointsGuardPath(tc.method, tc.path)
		if got != tc.want {
			t.Fatalf("unexpected result method=%s path=%s: got %v want %v", tc.method, tc.path, got, tc.want)
		}
	}
}

func TestBuildUserPointsFailureCallbackEvent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "req-user-points-1")
	c.Set("id", 123)
	c.Set("token_id", 456)
	c.Set("username", "ima_test_user")
	c.Set("token_name", "token-a")

	event, err := buildUserPointsFailureCallbackEvent(
		c,
		"https://example.com/api/v1/user_points?sk={sk}",
		"data.can_pre_deduct",
		"abc123",
		errors.New("dial tcp timeout"),
		true,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event == nil {
		t.Fatalf("event should not be nil")
	}
	if event.Source != model.CallbackEventSourceUserPointsGuard {
		t.Fatalf("unexpected source: %s", event.Source)
	}
	if event.SinkType != model.CallbackEventSinkUserPointsGuardLog {
		t.Fatalf("unexpected sink type: %s", event.SinkType)
	}
	if event.Status != model.CallbackEventStatusDead {
		t.Fatalf("unexpected status: %s", event.Status)
	}
	if event.HTTPMethod != http.MethodGet {
		t.Fatalf("unexpected method: %s", event.HTTPMethod)
	}
	if event.TokenSKSnapshot != "sk-abc123" {
		t.Fatalf("unexpected token sk snapshot: %s", event.TokenSKSnapshot)
	}
	if event.RequestID != "req-user-points-1" {
		t.Fatalf("unexpected request id: %s", event.RequestID)
	}
	if !strings.Contains(event.CallbackURL, "/api/v1/user_points") {
		t.Fatalf("unexpected callback url: %s", event.CallbackURL)
	}
	if !strings.Contains(event.Body, "dial tcp timeout") {
		t.Fatalf("event body should contain error detail, got: %s", event.Body)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(event.Body), &payload); err != nil {
		t.Fatalf("unexpected payload json error: %v", err)
	}
	if payload["reason"] != "user_points_guard_failed_open" {
		t.Fatalf("unexpected reason: %v", payload["reason"])
	}
	if payload["fail_open"] != true {
		t.Fatalf("unexpected fail_open value: %v", payload["fail_open"])
	}
}

func TestBuildUserPointsFailureCallbackEventFailCloseReason(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "req-user-points-2")

	event, err := buildUserPointsFailureCallbackEvent(
		c,
		"https://example.com/api/v1/user_points?sk={sk}",
		"data.can_pre_deduct",
		"abc123",
		errors.New("request timeout"),
		false,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(event.Body), &payload); err != nil {
		t.Fatalf("unexpected payload json error: %v", err)
	}
	if payload["reason"] != "user_points_guard_failed_close" {
		t.Fatalf("unexpected reason: %v", payload["reason"])
	}
	if payload["fail_open"] != false {
		t.Fatalf("unexpected fail_open value: %v", payload["fail_open"])
	}
}

func TestNormalizeUserPointsOnErrorDecision(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string
	}{
		{name: "empty default allow", raw: "", want: userPointsOnErrorAllow},
		{name: "allow", raw: "allow", want: userPointsOnErrorAllow},
		{name: "allow uppercase", raw: "ALLOW", want: userPointsOnErrorAllow},
		{name: "deny", raw: "deny", want: userPointsOnErrorDeny},
		{name: "deny with spaces", raw: "  deny  ", want: userPointsOnErrorDeny},
		{name: "unknown default allow", raw: "whatever", want: userPointsOnErrorAllow},
	}

	for _, tc := range cases {
		got := normalizeUserPointsOnErrorDecision(tc.raw)
		if got != tc.want {
			t.Fatalf("%s: got %s, want %s", tc.name, got, tc.want)
		}
	}
}

func TestBuildUserPointsRequestURL(t *testing.T) {
	url1, err := buildUserPointsRequestURL("https://example.com/api/v1/user_points?sk={sk}", "sk-abc123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url1 != "https://example.com/api/v1/user_points?sk=sk-abc123" {
		t.Fatalf("unexpected url with placeholder: %s", url1)
	}

	url2, err := buildUserPointsRequestURL("https://example.com/api/v1/user_points", "sk-abc123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url2 != "https://example.com/api/v1/user_points?sk=sk-abc123" {
		t.Fatalf("unexpected url with query append: %s", url2)
	}
}

func TestNormalizeUserPointsJSONPath(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string
	}{
		{name: "empty uses default", raw: "", want: defaultUserPointsCanPreDeductJSONPath},
		{name: "plain path", raw: "data.can_pre_deduct", want: "data.can_pre_deduct"},
		{name: "jsonpath with dollar", raw: "$.data.can_pre_deduct", want: "data.can_pre_deduct"},
		{name: "jsonpath with spaces", raw: "  $.data.can_pre_deduct  ", want: "data.can_pre_deduct"},
		{name: "only dollar uses default", raw: "$", want: defaultUserPointsCanPreDeductJSONPath},
	}
	for _, tc := range cases {
		got := normalizeUserPointsJSONPath(tc.raw)
		if got != tc.want {
			t.Fatalf("%s: got %q, want %q", tc.name, got, tc.want)
		}
	}
}

func TestFetchUserPointsCanPreDeductSupportsDollarJSONPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"code":200,"data":{"can_pre_deduct":false}}`))
	}))
	defer server.Close()

	canPreDeduct, err := fetchUserPointsCanPreDeduct(
		context.Background(),
		server.URL+"?sk={sk}",
		"abc123",
		"$.data.can_pre_deduct",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if canPreDeduct {
		t.Fatalf("expected false, got true")
	}
}

func TestRunUserPointsPreDeductGuardBlocksWhenFalse(t *testing.T) {
	origin := *operation_setting.GetPaymentSetting()
	defer func() {
		*operation_setting.GetPaymentSetting() = origin
	}()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"code":200,"msg":"success","data":{"can_pre_deduct":false}}`))
	}))
	defer server.Close()

	cfg := operation_setting.GetPaymentSetting()
	cfg.UserPointsEnabled = true
	cfg.UserPointsQueryURL = server.URL + "?sk={sk}"
	cfg.UserPointsUsernamePrefixFilter = "ima_"
	cfg.UserPointsCanPreDeductJSONPath = "$.data.can_pre_deduct"
	cfg.UserPointsOnErrorDecision = "allow"

	userPointsPrefixCache = sync.Map{}
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set("token_key", "abc123")
	c.Set("username", "ima_1999004390964838400")

	err := RunUserPointsPreDeductGuard(c, &model.Token{Key: "abc123"})
	if err == nil {
		t.Fatalf("expected guard to block request when can_pre_deduct=false")
	}
	if err.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status code: %d", err.StatusCode)
	}
	if !strings.Contains(err.Error(), "Insufficient quota") {
		t.Fatalf("unexpected error message: %s", err.Error())
	}
}

func TestGjsonResultToBool(t *testing.T) {
	cases := []struct {
		raw      string
		path     string
		expected bool
		ok       bool
	}{
		{raw: `{"x":true}`, path: "x", expected: true, ok: true},
		{raw: `{"x":false}`, path: "x", expected: false, ok: true},
		{raw: `{"x":"true"}`, path: "x", expected: true, ok: true},
		{raw: `{"x":"0"}`, path: "x", expected: false, ok: true},
		{raw: `{"x":1}`, path: "x", expected: true, ok: true},
		{raw: `{"x":0}`, path: "x", expected: false, ok: true},
		{raw: `{"x":"unknown"}`, path: "x", expected: false, ok: false},
	}
	for _, tc := range cases {
		value, ok := gjsonResultToBool(gjson.Get(tc.raw, tc.path))
		if ok != tc.ok || value != tc.expected {
			t.Fatalf("unexpected parse result for %s: got (%v,%v), want (%v,%v)", tc.raw, value, ok, tc.expected, tc.ok)
		}
	}
}

func TestShouldCheckUserPointsWithWildcardPrefix(t *testing.T) {
	tokenKey := "token-1"
	username := "ima_1999004390964838400"
	if !shouldCheckUserPoints(tokenKey, username, "ima_*") {
		t.Fatalf("wildcard prefix should match username")
	}
	if shouldCheckUserPoints(tokenKey, username, "abc_*") {
		t.Fatalf("unexpected match for non-matching wildcard prefix")
	}
}

func TestBuildUserPointsQuotaRejectMessage(t *testing.T) {
	defaultMessage := buildUserPointsQuotaRejectMessage(nil)
	if defaultMessage == "" {
		t.Fatalf("default message should not be empty")
	}

	msgWithURLOnly := buildUserPointsQuotaRejectMessage(&operation_setting.PaymentSetting{
		UserPointsRechargeURL: "https://example.com/topup",
	})
	if !strings.Contains(msgWithURLOnly, "https://example.com/topup") {
		t.Fatalf("url should be appended when custom message is empty, got: %s", msgWithURLOnly)
	}

	msgWithPlaceholder := buildUserPointsQuotaRejectMessage(&operation_setting.PaymentSetting{
		UserPointsRechargeURL:         "https://example.com/topup",
		UserPointsInsufficientMessage: "Insufficient quota. Please recharge at {recharge_url}",
	})
	if msgWithPlaceholder != "Insufficient quota. Please recharge at https://example.com/topup" {
		t.Fatalf("placeholder replacement failed, got: %s", msgWithPlaceholder)
	}

	msgWithoutPlaceholder := buildUserPointsQuotaRejectMessage(&operation_setting.PaymentSetting{
		UserPointsRechargeURL:         "https://example.com/topup",
		UserPointsInsufficientMessage: "Insufficient quota. Please recharge via the dashboard.",
	})
	if !strings.Contains(msgWithoutPlaceholder, "https://example.com/topup") {
		t.Fatalf("url should be appended when placeholder absent, got: %s", msgWithoutPlaceholder)
	}
}

func TestResolveUserPointsRouting(t *testing.T) {
	defaultQueryURL := "https://default.example.com/query?sk={sk}"
	defaultRechargeURL := "https://default.example.com/recharge"
	defaultInsufficientMessage := "Insufficient quota. Recharge at {recharge_url}"

	t.Run("no rules -> defaults", func(t *testing.T) {
		resolved := resolveUserPointsRouting(
			"ima_user",
			defaultQueryURL,
			defaultRechargeURL,
			defaultInsufficientMessage,
			nil,
		)
		if resolved.queryURL != defaultQueryURL || resolved.rechargeURL != defaultRechargeURL || resolved.insufficientMessage != defaultInsufficientMessage {
			t.Fatalf("expected defaults, got %+v", resolved)
		}
	})

	t.Run("rule match -> overrides", func(t *testing.T) {
		rules := []operation_setting.UserPointsRoutingRule{
			{
				Enabled:             true,
				PrefixPattern:       "ima_",
				QueryURL:            "https://r1.example.com/query",
				RechargeURL:         "https://r1.example.com/recharge",
				InsufficientMessage: "r1 insufficient {recharge_url}",
				Priority:            10,
			},
		}
		resolved := resolveUserPointsRouting(
			"ima_123",
			defaultQueryURL,
			defaultRechargeURL,
			defaultInsufficientMessage,
			rules,
		)
		if resolved.queryURL != "https://r1.example.com/query" ||
			resolved.rechargeURL != "https://r1.example.com/recharge" ||
			resolved.insufficientMessage != "r1 insufficient {recharge_url}" {
			t.Fatalf("unexpected resolved config: %+v", resolved)
		}
	})

	t.Run("disabled rule skipped", func(t *testing.T) {
		rules := []operation_setting.UserPointsRoutingRule{
			{
				Enabled:             false,
				PrefixPattern:       "ima_",
				QueryURL:            "https://disabled.example.com/query",
				RechargeURL:         "https://disabled.example.com/recharge",
				InsufficientMessage: "disabled message",
				Priority:            100,
			},
		}
		resolved := resolveUserPointsRouting(
			"ima_123",
			defaultQueryURL,
			defaultRechargeURL,
			defaultInsufficientMessage,
			rules,
		)
		if resolved.queryURL != defaultQueryURL || resolved.rechargeURL != defaultRechargeURL || resolved.insufficientMessage != defaultInsufficientMessage {
			t.Fatalf("disabled rule should be skipped, got %+v", resolved)
		}
	})

	t.Run("no match -> defaults", func(t *testing.T) {
		rules := []operation_setting.UserPointsRoutingRule{
			{
				Enabled:             true,
				PrefixPattern:       "vip_",
				QueryURL:            "https://vip.example.com/query",
				RechargeURL:         "https://vip.example.com/recharge",
				InsufficientMessage: "vip message",
				Priority:            1,
			},
		}
		resolved := resolveUserPointsRouting(
			"ima_123",
			defaultQueryURL,
			defaultRechargeURL,
			defaultInsufficientMessage,
			rules,
		)
		if resolved.queryURL != defaultQueryURL || resolved.rechargeURL != defaultRechargeURL || resolved.insufficientMessage != defaultInsufficientMessage {
			t.Fatalf("unmatched rules should fallback to defaults, got %+v", resolved)
		}
	})

	t.Run("partial override (URL only)", func(t *testing.T) {
		rules := []operation_setting.UserPointsRoutingRule{
			{
				Enabled:       true,
				PrefixPattern: "ima_",
				QueryURL:      "https://partial.example.com/query",
				Priority:      1,
			},
		}
		resolved := resolveUserPointsRouting(
			"ima_123",
			defaultQueryURL,
			defaultRechargeURL,
			defaultInsufficientMessage,
			rules,
		)
		if resolved.queryURL != "https://partial.example.com/query" {
			t.Fatalf("query url should be overridden, got %+v", resolved)
		}
		if resolved.rechargeURL != defaultRechargeURL || resolved.insufficientMessage != defaultInsufficientMessage {
			t.Fatalf("partial override should keep defaults for missing fields, got %+v", resolved)
		}
	})

	t.Run("priority ordering", func(t *testing.T) {
		rules := []operation_setting.UserPointsRoutingRule{
			{
				Enabled:       true,
				PrefixPattern: "ima_",
				QueryURL:      "https://low.example.com/query",
				Priority:      1,
			},
			{
				Enabled:       true,
				PrefixPattern: "ima_",
				QueryURL:      "https://high.example.com/query",
				Priority:      9,
			},
		}
		resolved := resolveUserPointsRouting(
			"ima_123",
			defaultQueryURL,
			defaultRechargeURL,
			defaultInsufficientMessage,
			rules,
		)
		if resolved.queryURL != "https://high.example.com/query" {
			t.Fatalf("higher priority rule should win, got %+v", resolved)
		}
	})
}
