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
	return db
}

func performProvisionRequest(t *testing.T, body map[string]any) provisionAPIResponse {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/operator/provision", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	OperatorProvision(ctx)

	var resp provisionAPIResponse
	if err = common.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode failed: %v, raw=%s", err, recorder.Body.String())
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
		t.Fatalf("seed user failed: %v", err)
	}
	return u
}

func TestOperatorProvisionExistingUserDuplicateTokenStillAddsQuota(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	baseUser := seedProvisionUser(t, db, "ima_1998990577523736577")

	token := model.Token{
		UserId:         baseUser.Id,
		Name:           "default",
		Key:            "ima_dup_token_0001",
		Status:         common.TokenStatusEnabled,
		CreatedTime:    common.GetTimestamp(),
		AccessedTime:   common.GetTimestamp(),
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}
	if err := db.Create(&token).Error; err != nil {
		t.Fatalf("seed token failed: %v", err)
	}

	originalQuota := baseUser.Quota
	amountUSD := 2.0
	resp := performProvisionRequest(t, map[string]any{
		"username":   baseUser.Username,
		"token":      token.Key,
		"amount_usd": amountUSD,
	})
	if !resp.Success {
		t.Fatalf("expected success for duplicate token retry, got: %s", resp.Message)
	}

	var user model.User
	if err := db.Where("id = ?", baseUser.Id).First(&user).Error; err != nil {
		t.Fatalf("query user failed: %v", err)
	}
	expectedQuota := originalQuota + int(math.Round(amountUSD*float64(common.QuotaPerUnit)))
	if user.Quota != expectedQuota {
		t.Fatalf("expected quota=%d, got=%d", expectedQuota, user.Quota)
	}
}

func TestOperatorProvisionCreatesBaseUsernameWhenSuffixProvided(t *testing.T) {
	db := setupOperatorProvisionTestDB(t)
	resp := performProvisionRequest(t, map[string]any{
		"username": "ima_1998990577523736577_66cca569",
		"token":    "ima_token_suffix_case",
	})
	if !resp.Success {
		t.Fatalf("provision failed: %s", resp.Message)
	}

	var baseUser model.User
	if err := db.Where("username = ?", "ima_1998990577523736577").First(&baseUser).Error; err != nil {
		t.Fatalf("expected base username created: %v", err)
	}

	var suffixCount int64
	if err := db.Model(&model.User{}).Where("username = ?", "ima_1998990577523736577_66cca569").Count(&suffixCount).Error; err != nil {
		t.Fatalf("count suffix user failed: %v", err)
	}
	if suffixCount != 0 {
		t.Fatalf("expected no suffix username row, got %d", suffixCount)
	}
}

