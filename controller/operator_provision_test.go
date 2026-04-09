package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type provisionResponseData struct {
	UserID int    `json:"user_id"`
	SK     string `json:"sk"`
}

type provisionAPIResponse struct {
	Success bool                  `json:"success"`
	Message string                `json:"message"`
	Data    provisionResponseData `json:"data"`
}

func setupOperatorProvisionTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	model.DB = db
	model.LOG_DB = db

	if err = db.AutoMigrate(&model.User{}, &model.Token{}, &model.Log{}); err != nil {
		t.Fatalf("failed to migrate operator provision tables: %v", err)
	}

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func performProvisionRequest(t *testing.T, body map[string]any) provisionAPIResponse {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("failed to marshal provision body: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/operator/provision", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	OperatorProvision(ctx)

	var resp provisionAPIResponse
	if err = common.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode provision response: %v, raw=%s", err, recorder.Body.String())
	}
	return resp
}

func seedProvisionUser(t *testing.T, db *gorm.DB, username string) model.User {
	t.Helper()

	u := model.User{
		Username:    username,
		DisplayName: username,
		Password:    "password123",
		Group:       "default",
		Status:      common.UserStatusEnabled,
		Role:        common.RoleCommonUser,
		AffCode:     common.GetRandomString(8),
		Setting:     "{}",
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}
	return u
}

func TestGetOperatorProvisionUsernameCandidates(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "normal username",
			input:    "ima_1998990577523736577",
			expected: []string{"ima_1998990577523736577"},
		},
		{
			name:     "ima uid with suffix fallback",
			input:    "ima_1998990577523736577_66cca569",
			expected: []string{"ima_1998990577523736577_66cca569", "ima_1998990577523736577"},
		},
		{
			name:     "blank username",
			input:    "   ",
			expected: nil,
		},
		{
			name:     "non-matching complex username",
			input:    "team_abc_123",
			expected: []string{"team_abc_123"},
		},
	}

	for _, tc := range cases {
		got := getOperatorProvisionUsernameCandidates(tc.input)
		if len(got) != len(tc.expected) {
			t.Fatalf("%s: candidates len=%d want=%d got=%v", tc.name, len(got), len(tc.expected), got)
		}
		for i := range got {
			if got[i] != tc.expected[i] {
				t.Fatalf("%s: candidate[%d]=%q want=%q", tc.name, i, got[i], tc.expected[i])
			}
		}
	}
}

func TestOperatorProvisionReusesBaseIMAUserWhenSuffixUsernameProvided(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	baseUsername := "ima_1998990577523736577"
	baseUser := seedProvisionUser(t, db, baseUsername)

	resp := performProvisionRequest(t, map[string]any{
		"username": baseUsername + "_66cca569",
		"token":    "ima_66cca569",
	})
	if !resp.Success {
		t.Fatalf("expected provision success, got message: %s", resp.Message)
	}
	if resp.Data.UserID != baseUser.Id {
		t.Fatalf("expected user_id=%d, got=%d", baseUser.Id, resp.Data.UserID)
	}

	var countBase int64
	if err := db.Model(&model.User{}).Where("username = ?", baseUsername).Count(&countBase).Error; err != nil {
		t.Fatalf("failed to count base user: %v", err)
	}
	if countBase != 1 {
		t.Fatalf("expected one base user, got %d", countBase)
	}

	var countSuffix int64
	if err := db.Model(&model.User{}).Where("username = ?", baseUsername+"_66cca569").Count(&countSuffix).Error; err != nil {
		t.Fatalf("failed to count suffix user: %v", err)
	}
	if countSuffix != 0 {
		t.Fatalf("expected no suffix user created, got %d", countSuffix)
	}

	var token model.Token
	if err := db.Where("key = ?", "ima_66cca569").First(&token).Error; err != nil {
		t.Fatalf("expected token to be created: %v", err)
	}
	if token.UserId != baseUser.Id {
		t.Fatalf("expected token user_id=%d, got=%d", baseUser.Id, token.UserId)
	}
}

func TestOperatorProvisionCreatesBaseUsernameWhenSuffixUsernameProvidedAndBaseNotFound(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	suffixUsername := "ima_1998990577523736577_66cca569"
	baseUsername := "ima_1998990577523736577"

	resp := performProvisionRequest(t, map[string]any{
		"username": suffixUsername,
		"token":    "ima_newtokenx1",
	})
	if !resp.Success {
		t.Fatalf("expected provision success, got message: %s", resp.Message)
	}

	var created model.User
	if err := db.Where("username = ?", baseUsername).First(&created).Error; err != nil {
		t.Fatalf("expected base username to be created: %v", err)
	}
	if created.Id != resp.Data.UserID {
		t.Fatalf("response user_id=%d does not match created user id=%d", resp.Data.UserID, created.Id)
	}

	var suffixCount int64
	if err := db.Model(&model.User{}).Where("username = ?", suffixUsername).Count(&suffixCount).Error; err != nil {
		t.Fatalf("failed to count suffix username rows: %v", err)
	}
	if suffixCount != 0 {
		t.Fatalf("expected no suffix username rows, got %d", suffixCount)
	}
}

func TestOperatorProvisionTokenGroup_UsesTokenGroupWhenProvided(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	username := "ima_1998990577523736577"
	baseUser := seedProvisionUser(t, db, username)

	resp := performProvisionRequest(t, map[string]any{
		"username":    username,
		"group":       "default",
		"token_group": "clawBot",
		"token":       "ima_token_group_a",
	})
	if !resp.Success {
		t.Fatalf("provision failed: %s", resp.Message)
	}
	if resp.Data.UserID != baseUser.Id {
		t.Fatalf("expected reused user_id=%d, got=%d", baseUser.Id, resp.Data.UserID)
	}

	var token model.Token
	if err := db.Where("key = ?", "ima_token_group_a").First(&token).Error; err != nil {
		t.Fatalf("failed to query token: %v", err)
	}
	if token.Group != "clawBot" {
		t.Fatalf("expected token group clawBot, got %q", token.Group)
	}
}

func TestOperatorProvisionTokenGroup_FallbackToGroupWhenEmpty(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	username := "ima_1998990577523736578"
	_ = seedProvisionUser(t, db, username)

	resp := performProvisionRequest(t, map[string]any{
		"username": username,
		"group":    "clawBot",
		"token":    "ima_token_group_b",
	})
	if !resp.Success {
		t.Fatalf("provision failed: %s", resp.Message)
	}

	var token model.Token
	if err := db.Where("key = ?", "ima_token_group_b").First(&token).Error; err != nil {
		t.Fatalf("failed to query token: %v", err)
	}
	if token.Group != "clawBot" {
		t.Fatalf("expected token group fallback to clawBot, got %q", token.Group)
	}
}

func TestOperatorProvisionDuplicateUsernameAddsTokenOnly(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	username := "ima_1998990577523736577"
	baseUser := seedProvisionUser(t, db, username)

	first := performProvisionRequest(t, map[string]any{
		"username": username,
		"token":    "ima_token_one",
	})
	if !first.Success {
		t.Fatalf("first provision failed: %s", first.Message)
	}

	second := performProvisionRequest(t, map[string]any{
		"username": username,
		"token":    "ima_token_two",
	})
	if !second.Success {
		t.Fatalf("second provision failed: %s", second.Message)
	}
	if second.Data.UserID != baseUser.Id {
		t.Fatalf("expected reused user_id=%d, got=%d", baseUser.Id, second.Data.UserID)
	}

	var users []model.User
	if err := db.Where("username = ?", username).Find(&users).Error; err != nil {
		t.Fatalf("failed to query users: %v", err)
	}
	if len(users) != 1 {
		t.Fatalf("expected exactly 1 user row for username, got %d", len(users))
	}

	var tokenCount int64
	if err := db.Model(&model.Token{}).Where("user_id = ?", baseUser.Id).Count(&tokenCount).Error; err != nil {
		t.Fatalf("failed to count tokens: %v", err)
	}
	if tokenCount != 2 {
		t.Fatalf("expected 2 tokens for existing user, got %d", tokenCount)
	}
}

func TestOperatorProvisionExistingUserAmountUSDAddsQuota(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	username := "ima_1888888888888888888"
	baseUser := seedProvisionUser(t, db, username)
	originalQuota := baseUser.Quota

	amountUSD := 2.0
	resp := performProvisionRequest(t, map[string]any{
		"username":   username,
		"token":      "ima_token_existing_amount_add",
		"amount_usd": amountUSD,
	})
	if !resp.Success {
		t.Fatalf("provision failed: %s", resp.Message)
	}

	var user model.User
	if err := db.Where("id = ?", baseUser.Id).First(&user).Error; err != nil {
		t.Fatalf("failed to query existing user: %v", err)
	}
	expected := originalQuota + int(math.Round(amountUSD*float64(common.QuotaPerUnit)))
	if user.Quota != expected {
		t.Fatalf("expected existing user quota=%d, got=%d", expected, user.Quota)
	}
}

func TestOperatorProvisionExistingUserDuplicateTokenStillAddsQuota(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	baseUser := seedProvisionUser(t, db, "ima_1998990577523736577")

	seedToken := model.Token{
		UserId:         baseUser.Id,
		Name:           "default",
		Key:            "ima_dup_token_0001",
		Status:         common.TokenStatusEnabled,
		CreatedTime:    common.GetTimestamp(),
		AccessedTime:   common.GetTimestamp(),
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}
	if err := db.Create(&seedToken).Error; err != nil {
		t.Fatalf("seed token failed: %v", err)
	}

	originalQuota := baseUser.Quota
	amountUSD := 2.0
	resp := performProvisionRequest(t, map[string]any{
		"username":   baseUser.Username,
		"token":      seedToken.Key,
		"amount_usd": amountUSD,
	})
	if !resp.Success {
		t.Fatalf("expected success for duplicate token retry, got: %s", resp.Message)
	}

	var user model.User
	if err := db.Where("id = ?", baseUser.Id).First(&user).Error; err != nil {
		t.Fatalf("query user failed: %v", err)
	}
	expected := originalQuota + int(math.Round(amountUSD*float64(common.QuotaPerUnit)))
	if user.Quota != expected {
		t.Fatalf("expected quota=%d, got=%d", expected, user.Quota)
	}
}

func TestOperatorProvisionNewUserAmountUSDOverridesQuotaAsTotal(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)

	amountUSD := 1.25
	resp := performProvisionRequest(t, map[string]any{
		"username":   "ima_2999999999999999999",
		"token":      "ima_token_amount_add",
		"amount_usd": amountUSD,
	})
	if !resp.Success {
		t.Fatalf("provision failed: %s", resp.Message)
	}

	var user model.User
	if err := db.Where("id = ?", resp.Data.UserID).First(&user).Error; err != nil {
		t.Fatalf("failed to query created user: %v", err)
	}

	expectedQuota := int(math.Round(amountUSD * float64(common.QuotaPerUnit)))
	if user.Quota != expectedQuota {
		t.Fatalf("expected quota=%d, got=%d", expectedQuota, user.Quota)
	}
}

func TestOperatorCreateTokenCreatesTokenForAuthenticatedOperatorUser(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	operatorUser := seedProvisionUser(t, db, "operator_root")
	operatorUser.Role = common.RoleRootUser
	if err := db.Save(&operatorUser).Error; err != nil {
		t.Fatalf("failed to update operator role: %v", err)
	}

	payload, err := json.Marshal(map[string]any{
		"name":            "prod_app_123_user_456",
		"unlimited_quota": true,
	})
	if err != nil {
		t.Fatalf("failed to marshal create token body: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/operator/token/create", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", operatorUser.Id)

	OperatorCreateToken(ctx)

	var resp provisionAPIResponse
	if err = common.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode create token response: %v, raw=%s", err, recorder.Body.String())
	}
	if !resp.Success {
		t.Fatalf("expected success response, got message: %s", resp.Message)
	}

	var token model.Token
	if err = db.Where("name = ?", "prod_app_123_user_456").First(&token).Error; err != nil {
		t.Fatalf("expected token to be created: %v", err)
	}
	if token.UserId != operatorUser.Id {
		t.Fatalf("expected token user_id=%d, got=%d", operatorUser.Id, token.UserId)
	}
	if !token.UnlimitedQuota {
		t.Fatal("expected token unlimited_quota to be true")
	}
	if token.ExpiredTime != -1 {
		t.Fatalf("expected token expired_time=-1, got=%d", token.ExpiredTime)
	}
	if token.Key != "prod_app_123_user_456" {
		t.Fatalf("expected token key=%q, got=%q", "prod_app_123_user_456", token.Key)
	}
}

func TestOperatorCreateTokenUsesNameAsTokenKeyWithoutSKPrefix(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	operatorUser := seedProvisionUser(t, db, "operator_root")
	operatorUser.Role = common.RoleRootUser
	if err := db.Save(&operatorUser).Error; err != nil {
		t.Fatalf("failed to update operator role: %v", err)
	}

	payload, err := json.Marshal(map[string]any{
		"name":            " sk-custom_token_123 ",
		"unlimited_quota": true,
	})
	if err != nil {
		t.Fatalf("failed to marshal create token body: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/operator/token/create", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", operatorUser.Id)

	OperatorCreateToken(ctx)

	var resp provisionAPIResponse
	if err = common.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode create token response: %v, raw=%s", err, recorder.Body.String())
	}
	if !resp.Success {
		t.Fatalf("expected success response, got message: %s", resp.Message)
	}

	var token model.Token
	if err = db.Where("name = ?", "sk-custom_token_123").First(&token).Error; err != nil {
		t.Fatalf("expected token to be created: %v", err)
	}
	if token.Name != "sk-custom_token_123" {
		t.Fatalf("expected stored token name %q, got %q", "sk-custom_token_123", token.Name)
	}
	if token.Key != "custom_token_123" {
		t.Fatalf("expected stored token key %q, got %q", "custom_token_123", token.Key)
	}
}

func TestOperatorCreateTokenRejectsNameLongerThan48CharsAfterSKPrefixStripped(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	operatorUser := seedProvisionUser(t, db, "operator_root")
	operatorUser.Role = common.RoleRootUser
	if err := db.Save(&operatorUser).Error; err != nil {
		t.Fatalf("failed to update operator role: %v", err)
	}

	payload, err := json.Marshal(map[string]any{
		"name":            "sk-" + strings.Repeat("a", 49),
		"unlimited_quota": true,
	})
	if err != nil {
		t.Fatalf("failed to marshal create token body: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/operator/token/create", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", operatorUser.Id)

	OperatorCreateToken(ctx)

	var resp provisionAPIResponse
	if err = common.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode create token response: %v, raw=%s", err, recorder.Body.String())
	}
	if resp.Success {
		t.Fatalf("expected invalid token response to fail, body=%s", recorder.Body.String())
	}

	var count int64
	if err = db.Model(&model.Token{}).Where("name = ?", "sk-"+strings.Repeat("a", 49)).Count(&count).Error; err != nil {
		t.Fatalf("failed to count created tokens: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no token rows to be created, got %d", count)
	}
}

func TestOperatorCreateTokenRejectsKeyLongerThan48CharsAfterSKPrefixStripped(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	operatorUser := seedProvisionUser(t, db, "operator_root")
	operatorUser.Role = common.RoleRootUser
	if err := db.Save(&operatorUser).Error; err != nil {
		t.Fatalf("failed to update operator role: %v", err)
	}

	payload, err := json.Marshal(map[string]any{
		"name":            strings.Repeat("a", 49),
		"unlimited_quota": true,
	})
	if err != nil {
		t.Fatalf("failed to marshal create token body: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/operator/token/create", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", operatorUser.Id)

	OperatorCreateToken(ctx)

	var resp provisionAPIResponse
	if err = common.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode create token response: %v, raw=%s", err, recorder.Body.String())
	}
	if resp.Success {
		t.Fatalf("expected invalid token response to fail, body=%s", recorder.Body.String())
	}

	var count int64
	if err = db.Model(&model.Token{}).Where("name = ?", strings.Repeat("a", 49)).Count(&count).Error; err != nil {
		t.Fatalf("failed to count created tokens: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no token rows to be created, got %d", count)
	}
}
