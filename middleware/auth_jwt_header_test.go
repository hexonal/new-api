package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupJWTHeaderAuthTestDB(t *testing.T) *gorm.DB {
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

	if err := db.AutoMigrate(&model.User{}, &model.Token{}); err != nil {
		t.Fatalf("failed to migrate jwt header auth tables: %v", err)
	}

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func seedJWTHeaderRootUser(t *testing.T, db *gorm.DB, userID int) *model.User {
	t.Helper()

	user := &model.User{
		Id:       userID,
		Username: fmt.Sprintf("root-%d", userID),
		Password: "password123",
		Role:     common.RoleRootUser,
		Status:   common.UserStatusEnabled,
		Email:    fmt.Sprintf("root-%d@example.com", userID),
		Group:    "default",
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("failed to create root user: %v", err)
	}
	return user
}

func seedJWTHeaderToken(t *testing.T, db *gorm.DB, userID int, name string, expiredTime int64, remainQuota int, unlimitedQuota bool) *model.Token {
	t.Helper()

	token := &model.Token{
		UserId:         userID,
		Name:           name,
		Key:            fmt.Sprintf("key-%s", strings.ReplaceAll(name, "_", "-")),
		Status:         common.TokenStatusEnabled,
		CreatedTime:    1,
		AccessedTime:   1,
		ExpiredTime:    expiredTime,
		RemainQuota:    remainQuota,
		UnlimitedQuota: unlimitedQuota,
		Group:          "default",
	}
	if err := db.Create(token).Error; err != nil {
		t.Fatalf("failed to create jwt header token: %v", err)
	}
	if expiredTime == 0 {
		if err := db.Model(token).Update("expired_time", int64(0)).Error; err != nil {
			t.Fatalf("failed to persist zero expired time: %v", err)
		}
		token.ExpiredTime = 0
	}
	return token
}

func newJWTHeaderAuthContext(headers map[string]string) *gin.Context {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	for key, value := range headers {
		ctx.Request.Header.Set(key, value)
	}
	return ctx
}

func TestTryJWTHeaderAuthRejectsExpiredAndExhaustedTokens(t *testing.T) {
	db := setupJWTHeaderAuthTestDB(t)
	seedJWTHeaderRootUser(t, db, 1)

	now := common.GetTimestamp()
	cases := []struct {
		name      string
		tokenName string
		headers   map[string]string
		expiredAt int64
		quota     int
		unlimited bool
	}{
		{
			name:      "expired token is rejected",
			tokenName: "prod_app_user1",
			headers: map[string]string{
				"x-app-id":  "app",
				"x-user-id": "user1",
				"x-env":     "prod",
			},
			expiredAt: now - 1,
			quota:     100,
			unlimited: true,
		},
		{
			name:      "zero expiry token is rejected",
			tokenName: "prod_app_user0",
			headers: map[string]string{
				"x-app-id":  "app",
				"x-user-id": "user0",
				"x-env":     "prod",
			},
			expiredAt: 0,
			quota:     100,
			unlimited: true,
		},
		{
			name:      "quota exhausted token is rejected",
			tokenName: "prod_app_user2",
			headers: map[string]string{
				"x-app-id":  "app",
				"x-user-id": "user2",
				"x-env":     "prod",
			},
			expiredAt: -1,
			quota:     0,
			unlimited: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			seedJWTHeaderToken(t, db, 1, tc.tokenName, tc.expiredAt, tc.quota, tc.unlimited)
			ctx := newJWTHeaderAuthContext(tc.headers)

			token, ok := tryJWTHeaderAuth(ctx, "eyJ.test.token")
			if ok || token != nil {
				t.Fatalf("expected jwt header auth to reject token %q", tc.tokenName)
			}
		})
	}
}

func TestTryJWTHeaderAuthAllowsHyphenMetadata(t *testing.T) {
	db := setupJWTHeaderAuthTestDB(t)
	seedJWTHeaderRootUser(t, db, 1)
	seedJWTHeaderToken(t, db, 1, "prod-env_app_user-1", -1, 100, true)

	ctx := newJWTHeaderAuthContext(map[string]string{
		"x-app-id":  "app",
		"x-user-id": "user-1",
		"x-env":     "prod-env",
	})

	token, ok := tryJWTHeaderAuth(ctx, "eyJ.test.token")
	if !ok || token == nil {
		t.Fatalf("expected jwt header auth to accept hyphenated metadata")
	}
	if got := ctx.GetString("x-user-id"); got != "user-1" {
		t.Fatalf("expected x-user-id context to be preserved, got %q", got)
	}
	if got := ctx.GetString("x-env"); got != "prod-env" {
		t.Fatalf("expected x-env context to be preserved, got %q", got)
	}
}

func TestTryJWTHeaderAuthRejectsUnderscoreMetadata(t *testing.T) {
	db := setupJWTHeaderAuthTestDB(t)
	seedJWTHeaderRootUser(t, db, 1)

	cases := []struct {
		name      string
		tokenName string
		headers   map[string]string
	}{
		{
			name:      "app id cannot contain underscore",
			tokenName: "prod_app_id_user1",
			headers: map[string]string{
				"x-app-id":  "app_id",
				"x-user-id": "user1",
				"x-env":     "prod",
			},
		},
		{
			name:      "user id cannot contain underscore",
			tokenName: "prod_app_user_1",
			headers: map[string]string{
				"x-app-id":  "app",
				"x-user-id": "user_1",
				"x-env":     "prod",
			},
		},
		{
			name:      "env cannot contain underscore",
			tokenName: "prod_env_app_user1",
			headers: map[string]string{
				"x-app-id":  "app",
				"x-user-id": "user1",
				"x-env":     "prod_env",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			seedJWTHeaderToken(t, db, 1, tc.tokenName, -1, 100, true)
			ctx := newJWTHeaderAuthContext(tc.headers)

			token, ok := tryJWTHeaderAuth(ctx, "eyJ.test.token")
			if ok || token != nil {
				t.Fatalf("expected jwt header auth to reject headers: %#v", tc.headers)
			}
		})
	}
}

func TestTryJWTHeaderAuthSetsJWTHeaderAuthContextFlag(t *testing.T) {
	db := setupJWTHeaderAuthTestDB(t)
	seedJWTHeaderRootUser(t, db, 1)
	seedJWTHeaderToken(t, db, 1, "prod_app_user1", -1, 100, true)

	ctx := newJWTHeaderAuthContext(map[string]string{
		"x-app-id":  "app",
		"x-user-id": "user1",
		"x-env":     "prod",
	})

	token, ok := tryJWTHeaderAuth(ctx, "eyJ.test.token")
	if !ok || token == nil {
		t.Fatalf("expected jwt header auth to succeed")
	}
	if !common.GetContextKeyBool(ctx, constant.ContextKeyJWTHeaderAuth) {
		t.Fatalf("expected jwt header auth context flag to be set")
	}
}
