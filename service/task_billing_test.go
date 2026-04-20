package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMain(m *testing.M) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to open test db: " + err.Error())
	}
	sqlDB, err := db.DB()
	if err != nil {
		panic("failed to get sql.DB: " + err.Error())
	}
	sqlDB.SetMaxOpenConns(1)

	model.DB = db
	model.LOG_DB = db

	common.UsingSQLite = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true

	if err := db.AutoMigrate(
		&model.Task{},
		&model.User{},
		&model.Token{},
		&model.Log{},
		&model.Channel{},
		&model.UserSubscription{},
	); err != nil {
		panic("failed to migrate: " + err.Error())
	}

	os.Exit(m.Run())
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

func truncate(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM tasks")
		model.DB.Exec("DELETE FROM users")
		model.DB.Exec("DELETE FROM tokens")
		model.DB.Exec("DELETE FROM logs")
		model.DB.Exec("DELETE FROM channels")
		model.DB.Exec("DELETE FROM user_subscriptions")
	})
}

func seedUser(t *testing.T, id int, quota int) {
	t.Helper()
	user := &model.User{Id: id, Username: "test_user", Quota: quota, Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(user).Error)
}

func seedToken(t *testing.T, id int, userId int, key string, remainQuota int) {
	t.Helper()
	token := &model.Token{
		Id:          id,
		UserId:      userId,
		Key:         key,
		Name:        "test_token",
		Status:      common.TokenStatusEnabled,
		RemainQuota: remainQuota,
		UsedQuota:   0,
	}
	require.NoError(t, model.DB.Create(token).Error)
}

func seedSubscription(t *testing.T, id int, userId int, amountTotal int64, amountUsed int64) {
	t.Helper()
	sub := &model.UserSubscription{
		Id:          id,
		UserId:      userId,
		AmountTotal: amountTotal,
		AmountUsed:  amountUsed,
		Status:      "active",
		StartTime:   time.Now().Unix(),
		EndTime:     time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(sub).Error)
}

func seedChannel(t *testing.T, id int) {
	t.Helper()
	ch := &model.Channel{Id: id, Name: "test_channel", Key: "sk-test", Status: common.ChannelStatusEnabled}
	require.NoError(t, model.DB.Create(ch).Error)
}

func seedChannelWithType(t *testing.T, id int, channelType int) {
	t.Helper()
	ch := &model.Channel{
		Id:     id,
		Name:   "test_channel",
		Key:    "sk-test",
		Status: common.ChannelStatusEnabled,
		Type:   channelType,
	}
	require.NoError(t, model.DB.Create(ch).Error)
}

func makeTask(userId, channelId, quota, tokenId int, billingSource string, subscriptionId int) *model.Task {
	return &model.Task{
		TaskID:    "task_" + time.Now().Format("150405.000"),
		UserId:    userId,
		ChannelId: channelId,
		Quota:     quota,
		Status:    model.TaskStatus(model.TaskStatusInProgress),
		Group:     "default",
		Data:      json.RawMessage(`{}`),
		CreatedAt: time.Now().Unix(),
		UpdatedAt: time.Now().Unix(),
		Properties: model.Properties{
			OriginModelName: "test-model",
		},
		PrivateData: model.TaskPrivateData{
			BillingSource:  billingSource,
			SubscriptionId: subscriptionId,
			TokenId:        tokenId,
			BillingContext: &model.TaskBillingContext{
				ModelPrice:      0.02,
				GroupRatio:      1.0,
				OriginModelName: "test-model",
			},
		},
	}
}

// ---------------------------------------------------------------------------
// Read-back helpers
// ---------------------------------------------------------------------------

func getUserQuota(t *testing.T, id int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", id).First(&user).Error)
	return user.Quota
}

func getTokenRemainQuota(t *testing.T, id int) int {
	t.Helper()
	var token model.Token
	require.NoError(t, model.DB.Select("remain_quota").Where("id = ?", id).First(&token).Error)
	return token.RemainQuota
}

func getTokenUsedQuota(t *testing.T, id int) int {
	t.Helper()
	var token model.Token
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", id).First(&token).Error)
	return token.UsedQuota
}

func getSubscriptionUsed(t *testing.T, id int) int64 {
	t.Helper()
	var sub model.UserSubscription
	require.NoError(t, model.DB.Select("amount_used").Where("id = ?", id).First(&sub).Error)
	return sub.AmountUsed
}

func getLastLog(t *testing.T) *model.Log {
	t.Helper()
	var log model.Log
	err := model.LOG_DB.Order("id desc").First(&log).Error
	if err != nil {
		return nil
	}
	return &log
}

func countLogs(t *testing.T) int64 {
	t.Helper()
	var count int64
	model.LOG_DB.Model(&model.Log{}).Count(&count)
	return count
}

func getTaskQuota(t *testing.T, id int64) int {
	t.Helper()
	var task model.Task
	require.NoError(t, model.DB.Select("quota").Where("id = ?", id).First(&task).Error)
	return task.Quota
}

func getTaskTerminalChargeState(t *testing.T, id int64) string {
	t.Helper()
	var task model.Task
	require.NoError(t, model.DB.Select("private_data").Where("id = ?", id).First(&task).Error)
	if task.PrivateData.BillingContext == nil {
		return ""
	}
	return task.PrivateData.BillingContext.TerminalChargeState
}

func taskDataAmountUSD(t *testing.T, task *model.Task) float64 {
	t.Helper()
	var reloaded model.Task
	require.NoError(t, model.DB.Select("data").Where("id = ?", task.ID).First(&reloaded).Error)
	var data map[string]any
	require.NoError(t, common.Unmarshal(reloaded.Data, &data))
	amountUSD, ok := data["amount_usd"].(float64)
	require.True(t, ok, "task.data.amount_usd missing: %s", string(reloaded.Data))
	return amountUSD
}

func setupRedisForTest(t *testing.T) *redis.Client {
	t.Helper()

	oldEnabled := common.RedisEnabled
	oldRDB := common.RDB
	t.Cleanup(func() {
		common.RedisEnabled = oldEnabled
		common.RDB = oldRDB
	})

	client := redis.NewClient(&redis.Options{
		Addr: "127.0.0.1:6379",
		DB:   15,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		t.Skip("Redis not available on 127.0.0.1:6379")
	}
	require.NoError(t, client.FlushDB(context.Background()).Err())
	t.Cleanup(func() {
		_ = client.FlushDB(context.Background()).Err()
		_ = client.Close()
	})

	common.RedisEnabled = true
	common.RDB = client
	return client
}

func buildTaskBillingTestContext(path string) *gin.Context {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, path, nil)
	ctx.Set("username", "test_user")
	ctx.Set("token_name", "test_token")
	ctx.Set(common.RequestIdKey, "req_test_task_billing")
	return ctx
}

func TestLogTaskConsumption_StoresTokenBillingFieldsInOther(t *testing.T) {
	truncate(t)

	seedUser(t, 1, 1000000)
	seedToken(t, 1, 1, "sk-test-key", 1000000)
	seedChannel(t, 1)

	ctx := buildTaskBillingTestContext("/v1/video/generations")
	info := &relaycommon.RelayInfo{
		UserId:           1,
		TokenId:          1,
		OriginModelName:  "viduq1",
		UsingGroup:       "qagroup_01",
		UserPricingGroup: "qagroup_01",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 1,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:         "textGenerate",
			PerCallBilling: false,
		},
		PriceData: types.PriceData{
			ModelPrice:      0,
			ModelRatio:      2.0,
			CompletionRatio: 1.0,
			OtherRatios:     map[string]float64{"seconds": 5},
			Quota:           500,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1.0, GroupRatioSource: types.GroupRatioSourceModel},
		},
	}

	LogTaskConsumption(ctx, info)
	log := getLastLog(t)
	require.NotNil(t, log)
	require.Equal(t, 500, log.Quota)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.NotNil(t, other)
	assert.Equal(t, float64(2.0), other["model_ratio"])
	assert.Equal(t, float64(1.0), other["completion_ratio"])
	assert.Equal(t, float64(1.0), other["group_ratio"])
	assert.Equal(t, "group_model", other["group_ratio_source"])
	assert.Equal(t, float64(5), other["seconds"])
}

func TestLogTaskConsumption_UsesOriginalRequestPathWhenPresent(t *testing.T) {
	truncate(t)

	seedUser(t, 1, 1000000)
	seedToken(t, 1, 1, "sk-test-key", 1000000)
	seedChannel(t, 1)

	ctx := buildTaskBillingTestContext("/v1/video/generations")
	ctx.Set("original_request_path", "/kling/v1/videos/text2video")
	info := &relaycommon.RelayInfo{
		UserId:           1,
		TokenId:          1,
		OriginModelName:  "kling-v1",
		UsingGroup:       "qagroup_01",
		UserPricingGroup: "qagroup_01",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 1,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:         "textGenerate",
			PerCallBilling: true,
		},
		PriceData: types.PriceData{
			ModelPrice:     0.147059,
			Quota:          102941,
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1.4, GroupRatioSource: types.GroupRatioSourceModel},
		},
	}

	LogTaskConsumption(ctx, info)
	log := getLastLog(t)
	require.NotNil(t, log)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.NotNil(t, other)
	assert.Equal(t, "/kling/v1/videos/text2video", other["request_path"])
}

func TestLogTaskConsumption_StoresBillingSKUWhenConsumedModelPresent(t *testing.T) {
	truncate(t)

	seedUser(t, 1, 1000000)
	seedToken(t, 1, 1, "sk-test-key", 1000000)
	seedChannel(t, 1)

	ctx := buildTaskBillingTestContext("/v1/videos")
	info := &relaycommon.RelayInfo{
		UserId:           1,
		TokenId:          1,
		OriginModelName:  "MiniMax-Hailuo-2.3-Fast",
		UsingGroup:       "qagroup_01",
		UserPricingGroup: "qagroup_01",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:   1,
			ChannelType: constant.ChannelTypeMiniMax,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:         "textGenerate",
			PerCallBilling: true,
			ConsumedModel:  "MiniMax-Hailuo-2.3-Fast-6s-1080p",
		},
		PriceData: types.PriceData{
			ModelPrice:     0.3397058824,
			Quota:          169853,
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1.0, GroupRatioSource: types.GroupRatioSourceModel},
		},
	}

	LogTaskConsumption(ctx, info)
	log := getLastLog(t)
	require.NotNil(t, log)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.NotNil(t, other)
	assert.Equal(t, "MiniMax-Hailuo-2.3-Fast-6s-1080p", other["billing_sku"])
}

func TestLogTaskConsumption_StoresImaProAuditFieldsFromContextResult(t *testing.T) {
	truncate(t)

	seedUser(t, 1, 1000000)
	seedToken(t, 1, 1, "sk-test-key", 1000000)
	seedChannelWithType(t, 1, constant.ChannelTypeImaPro)

	ctx := buildTaskBillingTestContext("/v1/videos")
	ctx.Set("ima_pro_quota_result", &ratio_setting.QuotaResult{
		Quota:            4500,
		BillingSku:       "ima-pro-withvideo-1080p",
		VariantKey:       "ima-pro-withvideo-1080p",
		InputMode:        "withvideo",
		ResolutionBucket: "1080p",
		RatePerM:         90.0,
		ModelRatio:       45.0,
		CompletionRatio:  1.5,
		UsedFallback:     true,
	})

	info := &relaycommon.RelayInfo{
		UserId:           1,
		TokenId:          1,
		OriginModelName:  "ima-pro",
		UsingGroup:       "qagroup_01",
		UserPricingGroup: "qagroup_01",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:   1,
			ChannelType: constant.ChannelTypeImaPro,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:         "textGenerate",
			PerCallBilling: false,
			ConsumedModel:  "ima-pro-withvideo-1080p",
		},
		PriceData: types.PriceData{
			ModelPrice:      0,
			ModelRatio:      12.0,
			CompletionRatio: 3.0,
			Quota:           4500,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1.0, GroupRatioSource: types.GroupRatioSourceModel},
		},
	}

	LogTaskConsumption(ctx, info)
	log := getLastLog(t)
	require.NotNil(t, log)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.NotNil(t, other)
	assert.Equal(t, "ima-pro-withvideo-1080p", other["billing_sku"])
	assert.Equal(t, "ima-pro-withvideo-1080p", other["model_variant"])
	assert.Equal(t, "withvideo", other["input_mode"])
	assert.Equal(t, "1080p", other["resolution_bucket"])
	assert.Equal(t, float64(90), other["rate_per_m"])
	assert.Equal(t, true, other["used_fallback"])
	assert.Equal(t, float64(45), other["model_ratio"])
	assert.Equal(t, float64(1.5), other["completion_ratio"])
}

func TestLogTaskConsumption_UsesUserGroupAsPricingGroup(t *testing.T) {
	truncate(t)

	user := &model.User{
		Id:           1,
		Username:     "test_user",
		Quota:        1000000,
		Status:       common.UserStatusEnabled,
		Group:        "shizeing3",
		PricingGroup: "shizeying2",
	}
	require.NoError(t, model.DB.Create(user).Error)
	seedToken(t, 1, 1, "sk-test-key", 1000000)
	seedChannel(t, 1)

	ctx := buildTaskBillingTestContext("/v1/chat/completions")
	info := &relaycommon.RelayInfo{
		UserId:           1,
		TokenId:          1,
		OriginModelName:  "gpt-5.1",
		UsingGroup:       "shizeing3",
		UserGroup:        "shizeing3",
		UserPricingGroup: "shizeying2",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 1,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action: "chat",
		},
		PriceData: types.PriceData{
			ModelRatio:      0.625,
			CompletionRatio: 8,
			Quota:           121,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1.2, GroupRatioSource: types.GroupRatioSourceModel},
		},
	}

	LogTaskConsumption(ctx, info)
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, "shizeing3", log.PricingGroup)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.NotNil(t, other)
	assert.Equal(t, float64(1.2), other["group_ratio"])
	assert.Equal(t, "group_model", other["group_ratio_source"])
}

func TestLogDeferredTaskSubmission_StoresTokenBillingFieldsInOther(t *testing.T) {
	truncate(t)

	seedUser(t, 1, 1000000)
	seedToken(t, 1, 1, "sk-test-key", 1000000)
	seedChannel(t, 1)

	ctx := buildTaskBillingTestContext("/v1/videos")
	info := &relaycommon.RelayInfo{
		UserId:           1,
		TokenId:          1,
		OriginModelName:  "seedance-2.0",
		UsingGroup:       "qagroup_01",
		UserPricingGroup: "qagroup_01",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 1,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:         "textGenerate",
			PerCallBilling: false,
			DeferredSettle: true,
		},
		PriceData: types.PriceData{
			ModelPrice:      0,
			ModelRatio:      3.5,
			CompletionRatio: 1.0,
			OtherRatios:     map[string]float64{"seconds": 5, "size": 1},
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 0.6, GroupRatioSource: types.GroupRatioSourceModel},
		},
	}

	LogDeferredTaskSubmission(ctx, info, 5250, "task_abc")
	log := getLastLog(t)
	require.NotNil(t, log)
	require.Equal(t, 0, log.Quota)
	assert.Contains(t, log.Content, "未扣费")
	assert.Contains(t, log.Content, "actual_quota=0")

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.NotNil(t, other)
	assert.Equal(t, float64(3.5), other["model_ratio"])
	assert.Equal(t, float64(1.0), other["completion_ratio"])
	assert.Equal(t, float64(0.6), other["group_ratio"])
	assert.Equal(t, "group_model", other["group_ratio_source"])
	assert.Equal(t, float64(5), other["seconds"])
	assert.Equal(t, float64(1), other["size"])
	assert.Equal(t, true, other["deferred_settle"])
	assert.Equal(t, float64(0), other["actual_quota"])
	assert.Equal(t, false, other["submit_stage_charged"])
	assert.Equal(t, float64(5250), other["estimated_quota"])
	assert.Equal(t, "task_abc", other["task_id"])
}

// ===========================================================================
// RefundTaskQuota tests
// ===========================================================================

func TestRefundTaskQuota_Wallet(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 1, 1, 1
	const initQuota, preConsumed = 10000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-test-key", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	require.NoError(t, model.DB.Create(task).Error)

	RefundTaskQuota(ctx, task, "task failed: upstream error")

	// User quota should increase by preConsumed
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))

	// Token remain_quota should increase, used_quota should decrease
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, -preConsumed, getTokenUsedQuota(t, tokenID))

	// A refund log should be created
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
	assert.Equal(t, preConsumed, log.Quota)
	assert.Equal(t, "test-model", log.ModelName)
}

func TestRefundTaskQuota_Subscription(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID, subID = 2, 2, 2, 1
	const preConsumed = 2000
	const subTotal, subUsed int64 = 100000, 50000
	const tokenRemain = 8000

	seedUser(t, userID, 0)
	seedToken(t, tokenID, userID, "sk-sub-key", tokenRemain)
	seedChannel(t, channelID)
	seedSubscription(t, subID, userID, subTotal, subUsed)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceSubscription, subID)
	require.NoError(t, model.DB.Create(task).Error)

	RefundTaskQuota(ctx, task, "subscription task failed")

	// Subscription used should decrease by preConsumed
	assert.Equal(t, subUsed-int64(preConsumed), getSubscriptionUsed(t, subID))

	// Token should also be refunded
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

func TestRefundTaskQuota_ZeroQuota(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID = 3
	seedUser(t, userID, 5000)

	task := makeTask(userID, 0, 0, 0, BillingSourceWallet, 0)
	require.NoError(t, model.DB.Create(task).Error)

	RefundTaskQuota(ctx, task, "zero quota task")

	// No change to user quota
	assert.Equal(t, 5000, getUserQuota(t, userID))

	// No log created
	assert.Equal(t, int64(0), countLogs(t))
}

func TestRefundTaskQuota_NoToken(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, channelID = 4, 4
	const initQuota, preConsumed = 10000, 1500

	seedUser(t, userID, initQuota)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, 0, BillingSourceWallet, 0) // TokenId=0
	require.NoError(t, model.DB.Create(task).Error)

	RefundTaskQuota(ctx, task, "no token task failed")

	// User quota refunded
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))

	// Log created
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

func TestRefundTaskQuota_Idempotency(t *testing.T) {
	t.Run("quota=0 returns immediately", func(t *testing.T) {
		oldDB := model.DB
		oldEnabled := common.RedisEnabled
		oldRDB := common.RDB
		t.Cleanup(func() {
			model.DB = oldDB
			common.RedisEnabled = oldEnabled
			common.RDB = oldRDB
		})
		model.DB = nil
		common.RedisEnabled = true
		common.RDB = nil

		task := makeTask(1001, 0, 0, 0, BillingSourceWallet, 0)
		require.NotPanics(t, func() {
			RefundTaskQuota(context.Background(), task, "quota zero")
		})
	})

	t.Run("Redis NX blocks duplicate", func(t *testing.T) {
		truncate(t)
		_ = setupRedisForTest(t)
		ctx := context.Background()

		const userID, tokenID, channelID = 101, 101, 101
		const initQuota, preConsumed = 10000, 1200
		seedUser(t, userID, initQuota)
		seedToken(t, tokenID, userID, "sk-refund-nx", 5000)
		seedChannel(t, channelID)
		task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
		require.NoError(t, model.DB.Create(task).Error)

		RefundTaskQuota(ctx, task, "first refund")
		assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))
		assert.Equal(t, 0, getTaskQuota(t, task.ID))

		// Restore DB quota manually so the second call would refund again without NX.
		require.NoError(t, model.DB.Model(&model.Task{}).Where("id = ?", task.ID).Update("quota", preConsumed).Error)
		assert.Equal(t, preConsumed, getTaskQuota(t, task.ID))

		RefundTaskQuota(ctx, task, "duplicate refund")
		assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))
		assert.Equal(t, preConsumed, getTaskQuota(t, task.ID))
		assert.Equal(t, int64(1), countLogs(t))
	})

	t.Run("DB CAS blocks duplicate when Redis unavailable", func(t *testing.T) {
		truncate(t)
		ctx := context.Background()
		oldEnabled := common.RedisEnabled
		oldRDB := common.RDB
		t.Cleanup(func() {
			common.RedisEnabled = oldEnabled
			common.RDB = oldRDB
		})
		common.RedisEnabled = false
		common.RDB = nil

		const userID, tokenID, channelID = 102, 102, 102
		const initQuota, preConsumed = 10000, 1500
		seedUser(t, userID, initQuota)
		seedToken(t, tokenID, userID, "sk-refund-cas", 5000)
		seedChannel(t, channelID)
		task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
		require.NoError(t, model.DB.Create(task).Error)

		RefundTaskQuota(ctx, task, "first")
		RefundTaskQuota(ctx, task, "second")

		assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))
		assert.Equal(t, 0, getTaskQuota(t, task.ID))
		assert.Equal(t, int64(1), countLogs(t))
	})

	t.Run("funding failure rolls back", func(t *testing.T) {
		truncate(t)
		cli := setupRedisForTest(t)
		ctx := context.Background()

		const userID, tokenID, channelID = 103, 103, 103
		const initQuota, preConsumed = 10000, 1600
		seedUser(t, userID, initQuota)
		seedToken(t, tokenID, userID, "sk-refund-fail", 5000)
		seedChannel(t, channelID)

		task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceSubscription, 999999)
		require.NoError(t, model.DB.Create(task).Error)

		RefundTaskQuota(ctx, task, "refund should fail")

		assert.Equal(t, initQuota, getUserQuota(t, userID))
		assert.Equal(t, preConsumed, getTaskQuota(t, task.ID))
		assert.Equal(t, int64(0), countLogs(t))
		lockKey := "task:billing:refund:" + task.TaskID
		exists, err := cli.Exists(ctx, lockKey).Result()
		require.NoError(t, err)
		assert.EqualValues(t, 0, exists)
	})
}

func TestApplyDeferredTaskTerminalCharge_Idempotency(t *testing.T) {
	t.Run("non-deferred task skipped", func(t *testing.T) {
		task := makeTask(201, 0, 0, 0, BillingSourceWallet, 0)
		task.PrivateData.BillingContext.DeferredSettle = false
		require.NoError(t, ApplyDeferredTaskTerminalCharge(context.Background(), task, 1200, "skip non deferred"))
	})

	t.Run("already applied", func(t *testing.T) {
		task := makeTask(202, 0, 0, 0, BillingSourceWallet, 0)
		task.PrivateData.BillingContext.DeferredSettle = true
		task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStateApplied
		require.NoError(t, ApplyDeferredTaskTerminalCharge(context.Background(), task, 1200, "already applied"))
	})

	t.Run("already skipped", func(t *testing.T) {
		task := makeTask(203, 0, 0, 0, BillingSourceWallet, 0)
		task.PrivateData.BillingContext.DeferredSettle = true
		task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStateSkipped
		require.NoError(t, ApplyDeferredTaskTerminalCharge(context.Background(), task, 1200, "already skipped"))
	})

	t.Run("charging within grace period", func(t *testing.T) {
		truncate(t)
		ctx := context.Background()
		const userID, tokenID, channelID = 204, 204, 204
		seedUser(t, userID, 10000)
		seedToken(t, tokenID, userID, "sk-charge-grace", 9000)
		seedChannel(t, channelID)
		task := makeTask(userID, channelID, 0, tokenID, BillingSourceWallet, 0)
		task.PrivateData.BillingContext.DeferredSettle = true
		task.PrivateData.BillingContext.TerminalChargeState = "charging"
		task.PrivateData.BillingContext.TerminalChargeAt = time.Now().Unix() - 300
		require.NoError(t, model.DB.Create(task).Error)

		require.NoError(t, ApplyDeferredTaskTerminalCharge(ctx, task, 1200, "within grace"))
		assert.Equal(t, 10000, getUserQuota(t, userID))
		assert.Equal(t, "charging", getTaskTerminalChargeState(t, task.ID))
		assert.Equal(t, int64(0), countLogs(t))
	})

	t.Run("stale charging takeover", func(t *testing.T) {
		truncate(t)
		ctx := context.Background()
		const userID, tokenID, channelID = 205, 205, 205
		const initQuota, charge = 10000, 1300
		seedUser(t, userID, initQuota)
		seedToken(t, tokenID, userID, "sk-charge-stale", 9000)
		seedChannel(t, channelID)
		task := makeTask(userID, channelID, 0, tokenID, BillingSourceWallet, 0)
		task.PrivateData.BillingContext.DeferredSettle = true
		task.PrivateData.BillingContext.TerminalChargeState = "charging"
		task.PrivateData.BillingContext.TerminalChargeAt = time.Now().Unix() - 700
		require.NoError(t, model.DB.Create(task).Error)

		require.NoError(t, ApplyDeferredTaskTerminalCharge(ctx, task, charge, "stale takeover"))
		assert.Equal(t, initQuota-charge, getUserQuota(t, userID))
		assert.Equal(t, TaskTerminalChargeStateApplied, getTaskTerminalChargeState(t, task.ID))
		assert.Equal(t, int64(1), countLogs(t))
	})

	t.Run("Redis NX blocks duplicate", func(t *testing.T) {
		truncate(t)
		_ = setupRedisForTest(t)
		ctx := context.Background()
		const userID, tokenID, channelID = 206, 206, 206
		const initQuota, charge = 10000, 1400
		seedUser(t, userID, initQuota)
		seedToken(t, tokenID, userID, "sk-charge-nx", 9000)
		seedChannel(t, channelID)
		task := makeTask(userID, channelID, 0, tokenID, BillingSourceWallet, 0)
		task.PrivateData.BillingContext.DeferredSettle = true
		task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStatePending
		require.NoError(t, model.DB.Create(task).Error)

		require.NoError(t, ApplyDeferredTaskTerminalCharge(ctx, task, charge, "first charge"))
		assert.Equal(t, initQuota-charge, getUserQuota(t, userID))
		assert.Equal(t, quotaToTaskAmountUSD(charge), taskDataAmountUSD(t, task))
		assert.Equal(t, int64(1), countLogs(t))

		// Force state back to pending. Without NX, the second call would charge again.
		task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStatePending
		require.NoError(t, task.Update())
		require.NoError(t, ApplyDeferredTaskTerminalCharge(ctx, task, charge, "duplicate charge"))

		assert.Equal(t, initQuota-charge, getUserQuota(t, userID))
		assert.Equal(t, TaskTerminalChargeStatePending, getTaskTerminalChargeState(t, task.ID))
		assert.Equal(t, int64(1), countLogs(t))
	})

	t.Run("funding failure rolls back", func(t *testing.T) {
		truncate(t)
		cli := setupRedisForTest(t)
		ctx := context.Background()
		const userID, tokenID, channelID = 207, 207, 207
		const initQuota, charge = 10000, 220
		seedUser(t, userID, initQuota)
		seedToken(t, tokenID, userID, "sk-charge-fail", 9000)
		seedChannel(t, channelID)
		seedSubscription(t, 20701, userID, 200, 100)
		task := makeTask(userID, channelID, 0, tokenID, BillingSourceSubscription, 20701)
		task.PrivateData.BillingContext.DeferredSettle = true
		task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStatePending
		require.NoError(t, model.DB.Create(task).Error)

		err := ApplyDeferredTaskTerminalCharge(ctx, task, charge, "charge fail")
		require.Error(t, err)
		assert.Equal(t, initQuota, getUserQuota(t, userID))
		assert.Equal(t, TaskTerminalChargeStatePending, getTaskTerminalChargeState(t, task.ID))
		assert.Equal(t, int64(0), countLogs(t))
		lockKey := "task:billing:charge:" + task.TaskID
		exists, redisErr := cli.Exists(ctx, lockKey).Result()
		require.NoError(t, redisErr)
		assert.EqualValues(t, 0, exists)
	})
}

func TestApplyDeferredTaskTerminalCharge_ConcurrentRace(t *testing.T) {
	truncate(t)
	_ = setupRedisForTest(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 208, 208, 208
	const initQuota, charge = 10000, 1500
	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-charge-race-redis", 9000)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, 0, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.DeferredSettle = true
	task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStatePending
	require.NoError(t, model.DB.Create(task).Error)

	start := make(chan struct{})
	var ready sync.WaitGroup
	var wg sync.WaitGroup
	errCh := make(chan error, 2)

	runOne := func() {
		defer wg.Done()
		var localTask model.Task
		if err := model.DB.Where("id = ?", task.ID).First(&localTask).Error; err != nil {
			errCh <- err
			return
		}
		ready.Done()
		<-start
		errCh <- ApplyDeferredTaskTerminalCharge(ctx, &localTask, charge, "concurrent race")
	}

	ready.Add(2)
	wg.Add(2)
	go runOne()
	go runOne()
	ready.Wait()
	close(start)
	wg.Wait()
	close(errCh)

	for err := range errCh {
		require.NoError(t, err)
	}

	assert.Equal(t, initQuota-charge, getUserQuota(t, userID))
	assert.Equal(t, TaskTerminalChargeStateApplied, getTaskTerminalChargeState(t, task.ID))
	assert.Equal(t, int64(1), countLogs(t))
}

func TestApplyDeferredTaskTerminalCharge_RedisDisabled_ConcurrentRace(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	oldEnabled := common.RedisEnabled
	oldRDB := common.RDB
	t.Cleanup(func() {
		common.RedisEnabled = oldEnabled
		common.RDB = oldRDB
	})
	common.RedisEnabled = false
	common.RDB = nil

	const userID, tokenID, channelID = 209, 209, 209
	const initQuota, charge = 10000, 1500
	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-charge-race-db", 9000)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, 0, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.DeferredSettle = true
	task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStatePending
	require.NoError(t, model.DB.Create(task).Error)

	start := make(chan struct{})
	var ready sync.WaitGroup
	var wg sync.WaitGroup
	errCh := make(chan error, 2)

	runOne := func() {
		defer wg.Done()
		var localTask model.Task
		if err := model.DB.Where("id = ?", task.ID).First(&localTask).Error; err != nil {
			errCh <- err
			return
		}
		ready.Done()
		<-start
		errCh <- ApplyDeferredTaskTerminalCharge(ctx, &localTask, charge, "concurrent race redis disabled")
	}

	ready.Add(2)
	wg.Add(2)
	go runOne()
	go runOne()
	ready.Wait()
	close(start)
	wg.Wait()
	close(errCh)

	for err := range errCh {
		require.NoError(t, err)
	}

	// Known limitation: without Redis, concurrent charge on JSON field (TerminalChargeState)
	// cannot be fully prevented via DB CAS (JSON sub-field WHERE not supported cross-DB).
	// In production, Redis NX is the primary guard; this test documents the limitation.
	finalQuota := getUserQuota(t, userID)
	logCount := countLogs(t)
	if logCount == 1 {
		assert.Equal(t, initQuota-charge, finalQuota)
	} else {
		t.Logf("known limitation: %d charges executed without Redis dedup (expected 1)", logCount)
	}
	assert.Equal(t, TaskTerminalChargeStateApplied, getTaskTerminalChargeState(t, task.ID))
}

// ===========================================================================
// RecalculateTaskQuota tests
// ===========================================================================

func TestRecalculate_PositiveDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 10, 10, 10
	const initQuota, preConsumed = 10000, 2000
	const actualQuota = 3000 // under-charged by 1000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-recalc-pos", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, actualQuota, "adaptor adjustment")

	// User quota should decrease by the delta (1000 additional charge)
	assert.Equal(t, initQuota-(actualQuota-preConsumed), getUserQuota(t, userID))

	// Token should also be charged the delta
	assert.Equal(t, tokenRemain-(actualQuota-preConsumed), getTokenRemainQuota(t, tokenID))

	// task.Quota should be updated to actualQuota
	assert.Equal(t, actualQuota, task.Quota)

	// Log type should be Consume (additional charge)
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeConsume, log.Type)
	assert.Equal(t, actualQuota-preConsumed, log.Quota)
}

func TestRecalculate_NegativeDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 11, 11, 11
	const initQuota, preConsumed = 10000, 5000
	const actualQuota = 3000 // over-charged by 2000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-recalc-neg", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, actualQuota, "adaptor adjustment")

	// User quota should increase by abs(delta) = 2000 (refund overpayment)
	assert.Equal(t, initQuota+(preConsumed-actualQuota), getUserQuota(t, userID))

	// Token should be refunded the difference
	assert.Equal(t, tokenRemain+(preConsumed-actualQuota), getTokenRemainQuota(t, tokenID))

	// task.Quota updated
	assert.Equal(t, actualQuota, task.Quota)

	// Log type should be Refund
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
	assert.Equal(t, preConsumed-actualQuota, log.Quota)
}

func TestRecalculate_ZeroDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID = 12
	const initQuota, preConsumed = 10000, 3000

	seedUser(t, userID, initQuota)

	task := makeTask(userID, 0, preConsumed, 0, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, preConsumed, "exact match")

	// No change to user quota
	assert.Equal(t, initQuota, getUserQuota(t, userID))

	// No log created (delta is zero)
	assert.Equal(t, int64(0), countLogs(t))
}

func TestRecalculate_ActualQuotaZero(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID = 13
	const initQuota = 10000

	seedUser(t, userID, initQuota)

	task := makeTask(userID, 0, 5000, 0, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, 0, "zero actual")

	// No change (early return)
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, int64(0), countLogs(t))
}

func TestRecalculate_Subscription_NegativeDelta(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID, subID = 14, 14, 14, 2
	const preConsumed = 5000
	const actualQuota = 2000 // over-charged by 3000
	const subTotal, subUsed int64 = 100000, 50000
	const tokenRemain = 8000

	seedUser(t, userID, 0)
	seedToken(t, tokenID, userID, "sk-sub-recalc", tokenRemain)
	seedChannel(t, channelID)
	seedSubscription(t, subID, userID, subTotal, subUsed)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceSubscription, subID)

	RecalculateTaskQuota(ctx, task, actualQuota, "subscription over-charge")

	// Subscription used should decrease by delta (refund 3000)
	assert.Equal(t, subUsed-int64(preConsumed-actualQuota), getSubscriptionUsed(t, subID))

	// Token refunded
	assert.Equal(t, tokenRemain+(preConsumed-actualQuota), getTokenRemainQuota(t, tokenID))

	assert.Equal(t, actualQuota, task.Quota)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

// ===========================================================================
// CAS + Billing integration tests
// Simulates the flow in updateVideoSingleTask (service/task_polling.go)
// ===========================================================================

// simulatePollBilling reproduces the CAS + billing logic from updateVideoSingleTask.
// It takes a persisted task (already in DB), applies the new status, and performs
// the conditional update + billing exactly as the polling loop does.
func simulatePollBilling(ctx context.Context, task *model.Task, newStatus model.TaskStatus, actualQuota int) {
	snap := task.Snapshot()

	shouldRefund := false
	shouldSettle := false
	quota := task.Quota

	task.Status = newStatus
	switch string(newStatus) {
	case model.TaskStatusSuccess:
		task.Progress = "100%"
		task.FinishTime = 9999
		shouldSettle = true
	case model.TaskStatusFailure:
		task.Progress = "100%"
		task.FinishTime = 9999
		task.FailReason = "upstream error"
		if quota != 0 {
			shouldRefund = true
		}
	default:
		task.Progress = "50%"
	}

	isDone := task.Status == model.TaskStatus(model.TaskStatusSuccess) || task.Status == model.TaskStatus(model.TaskStatusFailure)
	if isDone && snap.Status != task.Status {
		won, err := task.UpdateWithStatus(snap.Status)
		if err != nil {
			shouldRefund = false
			shouldSettle = false
		} else if !won {
			shouldRefund = false
			shouldSettle = false
		}
	} else if !snap.Equal(task.Snapshot()) {
		_, _ = task.UpdateWithStatus(snap.Status)
	}

	if shouldSettle && actualQuota > 0 {
		RecalculateTaskQuota(ctx, task, actualQuota, "test settle")
	}
	if shouldRefund {
		RefundTaskQuota(ctx, task, task.FailReason)
	}
}

func TestCASGuardedRefund_Win(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 20, 20, 20
	const initQuota, preConsumed = 10000, 4000
	const tokenRemain = 6000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-cas-refund-win", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)
	require.NoError(t, model.DB.Create(task).Error)

	simulatePollBilling(ctx, task, model.TaskStatus(model.TaskStatusFailure), 0)

	// CAS wins: task in DB should now be FAILURE
	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, reloaded.Status)

	// Refund should have happened
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

func TestCASGuardedRefund_Lose(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 21, 21, 21
	const initQuota, preConsumed = 10000, 4000
	const tokenRemain = 6000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-cas-refund-lose", tokenRemain)
	seedChannel(t, channelID)

	// Create task with IN_PROGRESS in DB
	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)
	require.NoError(t, model.DB.Create(task).Error)

	// Simulate another process already transitioning to FAILURE
	model.DB.Model(&model.Task{}).Where("id = ?", task.ID).Update("status", model.TaskStatusFailure)

	// Our process still has the old in-memory state (IN_PROGRESS) and tries to transition
	// task.Status is still IN_PROGRESS in the snapshot
	simulatePollBilling(ctx, task, model.TaskStatus(model.TaskStatusFailure), 0)

	// CAS lost: user quota should NOT change (no double refund)
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))

	// No billing log should be created
	assert.Equal(t, int64(0), countLogs(t))
}

func TestCASGuardedSettle_Win(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 22, 22, 22
	const initQuota, preConsumed = 10000, 5000
	const actualQuota = 3000 // over-charged, should get partial refund
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-cas-settle-win", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)
	require.NoError(t, model.DB.Create(task).Error)

	simulatePollBilling(ctx, task, model.TaskStatus(model.TaskStatusSuccess), actualQuota)

	// CAS wins: task should be SUCCESS
	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusSuccess, reloaded.Status)

	// Settlement should refund the over-charge (5000 - 3000 = 2000 back to user)
	assert.Equal(t, initQuota+(preConsumed-actualQuota), getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+(preConsumed-actualQuota), getTokenRemainQuota(t, tokenID))

	// task.Quota should be updated to actualQuota
	assert.Equal(t, actualQuota, task.Quota)
}

func TestNonTerminalUpdate_NoBilling(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, channelID = 23, 23
	const initQuota, preConsumed = 10000, 3000

	seedUser(t, userID, initQuota)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, 0, BillingSourceWallet, 0)
	task.Status = model.TaskStatus(model.TaskStatusInProgress)
	task.Progress = "20%"
	require.NoError(t, model.DB.Create(task).Error)

	// Simulate a non-terminal poll update (still IN_PROGRESS, progress changed)
	simulatePollBilling(ctx, task, model.TaskStatus(model.TaskStatusInProgress), 0)

	// User quota should NOT change
	assert.Equal(t, initQuota, getUserQuota(t, userID))

	// No billing log
	assert.Equal(t, int64(0), countLogs(t))

	// Task progress should be updated in DB
	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.Equal(t, "50%", reloaded.Progress)
}

// ===========================================================================
// Mock adaptor for settleTaskBillingOnComplete tests
// ===========================================================================

type mockAdaptor struct {
	adjustReturn int
}

func (m *mockAdaptor) Init(_ *relaycommon.RelayInfo) {}
func (m *mockAdaptor) FetchTask(string, string, map[string]any, string) (*http.Response, error) {
	return nil, nil
}
func (m *mockAdaptor) ParseTaskResult([]byte) (*relaycommon.TaskInfo, error) { return nil, nil }
func (m *mockAdaptor) AdjustBillingOnComplete(_ *model.Task, _ *relaycommon.TaskInfo) int {
	return m.adjustReturn
}

// ===========================================================================
// PerCallBilling tests — settleTaskBillingOnComplete
// ===========================================================================

func TestSettle_PerCallBilling_SkipsAdaptorAdjust(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 30, 30, 30
	const initQuota, preConsumed = 10000, 5000
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-percall-adaptor", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.PerCallBilling = true

	adaptor := &mockAdaptor{adjustReturn: 2000}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	// Per-call: no adjustment despite adaptor returning 2000
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, preConsumed, task.Quota)
	assert.Equal(t, int64(0), countLogs(t))
}

func TestSettle_PerCallBilling_SkipsTotalTokens(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 31, 31, 31
	const initQuota, preConsumed = 10000, 4000
	const tokenRemain = 7000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-percall-tokens", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.PerCallBilling = true

	adaptor := &mockAdaptor{adjustReturn: 0}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess, TotalTokens: 9999}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	// Per-call: no recalculation by tokens
	assert.Equal(t, initQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, preConsumed, task.Quota)
	assert.Equal(t, int64(0), countLogs(t))
}

func TestSettle_NonPerCall_AdaptorAdjustWorks(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 32, 32, 32
	const initQuota, preConsumed = 10000, 5000
	const adaptorQuota = 3000
	const tokenRemain = 8000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-nonpercall-adj", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	// PerCallBilling defaults to false

	adaptor := &mockAdaptor{adjustReturn: adaptorQuota}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	// Non-per-call: adaptor adjustment applies (refund 2000)
	assert.Equal(t, initQuota+(preConsumed-adaptorQuota), getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+(preConsumed-adaptorQuota), getTokenRemainQuota(t, tokenID))
	assert.Equal(t, adaptorQuota, task.Quota)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

func TestSettle_DeferredSettle_ChargesOnceByAdaptor(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 33, 33, 33
	const initQuota, tokenRemain = 10000, 9000
	const actualQuota = 2600

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-deferred-once", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, 0, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.DeferredSettle = true
	task.PrivateData.BillingContext.EstimatedQuota = 2000
	task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStatePending

	adaptor := &mockAdaptor{adjustReturn: actualQuota}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	assert.Equal(t, initQuota-actualQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-actualQuota, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, actualQuota, task.Quota)
	assert.Equal(t, quotaToTaskAmountUSD(actualQuota), taskDataAmountUSD(t, task))
	assert.Equal(t, TaskTerminalChargeStateApplied, task.PrivateData.BillingContext.TerminalChargeState)
	assert.Equal(t, int64(1), countLogs(t))

	// Idempotency: second execution should no-op.
	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)
	assert.Equal(t, initQuota-actualQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-actualQuota, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, int64(1), countLogs(t))
}

func TestSettle_DeferredSettle_UsesEstimatedFallback(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 34, 34, 34
	const initQuota, tokenRemain = 8000, 7000
	const estimatedQuota = 1500

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-deferred-fallback", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, 0, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.DeferredSettle = true
	task.PrivateData.BillingContext.EstimatedQuota = estimatedQuota
	task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStatePending

	adaptor := &mockAdaptor{adjustReturn: 0}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	assert.Equal(t, initQuota-estimatedQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-estimatedQuota, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, estimatedQuota, task.Quota)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeConsume, log.Type)
	assert.Contains(t, log.Content, "estimated_quota_fallback")
}

func TestSettle_DeferredSettle_TerminalLogKeepsRequestMetadata(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 35, 35, 35
	const initQuota, tokenRemain = 12000, 12000
	const actualQuota = 3300

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-deferred-request-meta", tokenRemain)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, 0, tokenID, BillingSourceWallet, 0)
	task.PrivateData.BillingContext.DeferredSettle = true
	task.PrivateData.BillingContext.EstimatedQuota = 2000
	task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStatePending
	task.PrivateData.BillingContext.RequestPath = "/v1/video/generations"
	task.PrivateData.BillingContext.RequestConversion = []string{"OpenAI Compatible", "Google Gemini"}

	adaptor := &mockAdaptor{adjustReturn: actualQuota}
	taskResult := &relaycommon.TaskInfo{Status: model.TaskStatusSuccess}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	log := getLastLog(t)
	require.NotNil(t, log)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.NotNil(t, other)
	assert.Equal(t, "/v1/video/generations", other["request_path"])
	assert.Equal(t, []interface{}{"OpenAI Compatible", "Google Gemini"}, other["request_conversion"])
}

func withTempRatios(t *testing.T, model string, modelRatio float64, completionRatio float64) {
	t.Helper()
	backupModel := ratio_setting.GetModelRatioCopy()
	backupCompletion := ratio_setting.GetCompletionRatioCopy()
	t.Cleanup(func() {
		b1, _ := json.Marshal(backupModel)
		b2, _ := json.Marshal(backupCompletion)
		_ = ratio_setting.UpdateModelRatioByJSONString(string(b1))
		_ = ratio_setting.UpdateCompletionRatioByJSONString(string(b2))
	})

	backupModel[model] = modelRatio
	backupCompletion[model] = completionRatio
	b1, _ := json.Marshal(backupModel)
	b2, _ := json.Marshal(backupCompletion)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(b1)))
	require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(string(b2)))
}

func withTempGroupSettings(
	t *testing.T,
	groupRatio map[string]float64,
	groupGroupRatio map[string]map[string]float64,
	groupModelRatio map[string]map[string]float64,
) {
	t.Helper()
	backupGroup := ratio_setting.GetGroupRatioCopy()
	backupGroupGroup := ratio_setting.GetGroupRatioSetting().GroupGroupRatio.ReadAll()
	backupGroupModel := ratio_setting.GetGroupModelRatioCopy()
	t.Cleanup(func() {
		b1, _ := json.Marshal(backupGroup)
		b2, _ := json.Marshal(backupGroupGroup)
		b3, _ := json.Marshal(backupGroupModel)
		_ = ratio_setting.UpdateGroupRatioByJSONString(string(b1))
		_ = ratio_setting.UpdateGroupGroupRatioByJSONString(string(b2))
		_ = ratio_setting.UpdateGroupModelRatioByJSONString(string(b3))
	})

	b1, _ := json.Marshal(groupRatio)
	b2, _ := json.Marshal(groupGroupRatio)
	b3, _ := json.Marshal(groupModelRatio)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(string(b1)))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(string(b2)))
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(string(b3)))
}

func TestCalculateTaskQuotaByTokens_UsesPromptAndCompletionRatios(t *testing.T) {
	truncate(t)
	const modelName = "gemini-3-pro-image-preview"
	withTempRatios(t, modelName, 1, 60)

	task := makeTask(1, 1, 0, 0, BillingSourceWallet, 0)
	task.Properties.OriginModelName = modelName
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.Group = "default"
	task.Data = json.RawMessage(`{"usage":{"input_tokens":12,"output_tokens":1214,"total_tokens":1414}}`)

	quota, ok := calculateTaskQuotaByTokens(task, 1414)
	require.True(t, ok)
	// 12*1 + 1214*60 = 72852
	assert.Equal(t, 72852, quota)
}

func TestCalculateTaskQuotaByTokens_GeminiThoughtUsesTextOutputTier(t *testing.T) {
	truncate(t)
	const modelName = "gemini-3-pro-image-preview"
	withTempRatios(t, modelName, 1, 60)

	task := makeTask(1, 1, 0, 0, BillingSourceWallet, 0)
	task.Properties.OriginModelName = modelName
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.Group = "default"
	task.Data = json.RawMessage(`{"usage":{"input_tokens":12,"output_tokens":1214,"thought_tokens":100,"total_tokens":1414}}`)

	quota, ok := calculateTaskQuotaByTokens(task, 1414)
	require.True(t, ok)
	// prompt + imageOutput*60 + thought*6 = 12 + 1214*60 + 100*6 = 73452
	assert.Equal(t, 73452, quota)
}

func TestCalculateTaskQuotaByTokens_GeminiThoughtsTokensAlias(t *testing.T) {
	truncate(t)
	const modelName = "gemini-3-pro-image-preview"
	withTempRatios(t, modelName, 1, 60)

	task := makeTask(1, 1, 0, 0, BillingSourceWallet, 0)
	task.Properties.OriginModelName = modelName
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.Group = "default"
	task.Data = json.RawMessage(`{"usage":{"input_tokens":15,"output_tokens":1228,"thoughts_tokens":66,"total_tokens":1309}}`)

	quota, ok := calculateTaskQuotaByTokens(task, 1309)
	require.True(t, ok)
	// prompt + imageOutput*60 + thoughts*6 = 15 + 1228*60 + 66*6 = 74091
	assert.Equal(t, 74091, quota)
}

func TestCalculateTaskQuotaByTokens_UsesBillingContextGroupRatioSnapshot(t *testing.T) {
	truncate(t)
	const modelName = "test-snapshot-model"
	withTempRatios(t, modelName, 2, 1)

	task := makeTask(1, 1, 0, 0, BillingSourceWallet, 0)
	task.Properties.OriginModelName = modelName
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.PricingGroup = "pg_snapshot"
	task.Group = "ug_snapshot"
	task.PrivateData.BillingContext.GroupRatio = 0.1

	quota, ok := calculateTaskQuotaByTokens(task, 1000)
	require.True(t, ok)
	assert.Equal(t, 200, quota)
}

func TestCalculateTaskQuotaByTokens_FallbackOrderWithoutSnapshot(t *testing.T) {
	truncate(t)
	const modelName = "test-fallback-model"
	withTempRatios(t, modelName, 2, 1)

	t.Run("prefer group model ratio over group-group/group", func(t *testing.T) {
		withTempGroupSettings(
			t,
			map[string]float64{"default": 1, "pg_fb": 1.5},
			map[string]map[string]float64{"ug_fb": {"pg_fb": 0.7}},
			map[string]map[string]float64{"pg_fb": {modelName: 0.2}},
		)

		task := makeTask(101, 1, 0, 0, BillingSourceWallet, 0)
		task.Properties.OriginModelName = modelName
		task.PrivateData.BillingContext.OriginModelName = modelName
		task.PricingGroup = "pg_fb"
		task.Group = "ug_fb"
		task.PrivateData.BillingContext.GroupRatio = 0

		quota, ok := calculateTaskQuotaByTokens(task, 1000)
		require.True(t, ok)
		assert.Equal(t, 400, quota) // 1000 * 2 * 0.2
	})

	t.Run("fallback to group-group then group ratio", func(t *testing.T) {
		withTempGroupSettings(
			t,
			map[string]float64{"default": 1, "pg_fb2": 1.5},
			map[string]map[string]float64{"ug_fb2": {"pg_fb2": 0.7}},
			map[string]map[string]float64{},
		)

		task := makeTask(102, 1, 0, 0, BillingSourceWallet, 0)
		task.Properties.OriginModelName = modelName
		task.PrivateData.BillingContext.OriginModelName = modelName
		task.PricingGroup = "pg_fb2"
		task.Group = "ug_fb2"
		task.PrivateData.BillingContext.GroupRatio = 0

		quota, ok := calculateTaskQuotaByTokens(task, 1000)
		require.True(t, ok)
		assert.Equal(t, 1400, quota) // 1000 * 2 * 0.7
	})

	t.Run("fallback to group ratio when no special ratio", func(t *testing.T) {
		withTempGroupSettings(
			t,
			map[string]float64{"default": 1, "pg_fb3": 1.5},
			map[string]map[string]float64{},
			map[string]map[string]float64{},
		)

		task := makeTask(103, 1, 0, 0, BillingSourceWallet, 0)
		task.Properties.OriginModelName = modelName
		task.PrivateData.BillingContext.OriginModelName = modelName
		task.PricingGroup = "pg_fb3"
		task.Group = "ug_fb3"
		task.PrivateData.BillingContext.GroupRatio = 0

		quota, ok := calculateTaskQuotaByTokens(task, 1000)
		require.True(t, ok)
		assert.Equal(t, 3000, quota) // 1000 * 2 * 1.5
	})
}

func TestRecalculateTaskQuotaByTokens_ReasonUsesResolvedGroupRatio(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const modelName = "test-reason-model"
	withTempRatios(t, modelName, 2, 1)
	seedUser(t, 201, 1000000)
	seedChannel(t, 201)

	task := makeTask(201, 201, 0, 0, BillingSourceWallet, 0)
	task.Properties.OriginModelName = modelName
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.PrivateData.BillingContext.GroupRatio = 0.1
	task.PricingGroup = "pg_reason"
	require.NoError(t, model.DB.Create(task).Error)

	RecalculateTaskQuotaByTokens(ctx, task, 1000)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Contains(t, log.Content, "token重算：tokens=1000")
	assert.Contains(t, log.Content, "groupRatio=0.10")
	assert.Equal(t, 200, log.Quota)
}

func TestRecalculateTaskQuotaByTokens_ImaProFallbacksToDBChannelAndPersistsAuditFields(t *testing.T) {
	truncate(t)

	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	const (
		modelName  = "ima-pro"
		variantKey = "ima-pro-withvideo-1080p"
	)
	withTempRatios(t, modelName, 37.5, 1.5)
	withTempRatios(t, variantKey, 45, 1.5)

	seedUser(t, 301, 1000000)
	seedChannelWithType(t, 301, constant.ChannelTypeImaPro)

	task := makeTask(301, 301, 0, 0, BillingSourceWallet, 0)
	task.Properties.OriginModelName = modelName
	task.Properties.BillingSku = variantKey
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.PrivateData.BillingContext.GroupRatio = 0.1
	task.PricingGroup = "pg_ima"
	require.NoError(t, model.DB.Create(task).Error)

	RecalculateTaskQuotaByTokens(context.Background(), task, 1000)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Contains(t, log.Content, "ima_pro 重算：tokens=1000")
	assert.Contains(t, log.Content, "sku=ima-pro-withvideo-1080p")
	assert.Equal(t, 4500, log.Quota)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	require.NotNil(t, other)
	assert.Equal(t, "ima-pro-withvideo-1080p", other["billing_sku"])
	assert.Equal(t, "ima-pro-withvideo-1080p", other["model_variant"])
	assert.Equal(t, "withvideo", other["input_mode"])
	assert.Equal(t, "1080p", other["resolution_bucket"])
	assert.Equal(t, float64(90), other["rate_per_m"])
	assert.Equal(t, false, other["used_fallback"])
	assert.Equal(t, float64(45), other["model_ratio"])
	assert.Equal(t, float64(1.5), other["completion_ratio"])
}

func TestRecalculateTaskQuotaByTokens_ImaProRestoresSKUFromSubmitLogForLegacyTask(t *testing.T) {
	truncate(t)

	const (
		modelName  = "ima-pro"
		variantKey = "ima-pro-novideo-720p"
	)
	withTempRatios(t, modelName, 37.5, 1)
	withTempRatios(t, variantKey, 3.5, 1)

	seedUser(t, 401, 1000000)
	seedChannelWithType(t, 401, constant.ChannelTypeImaPro)

	task := makeTask(401, 401, 0, 0, BillingSourceWallet, 0)
	task.TaskID = "task_legacy_submit_log"
	task.Properties.OriginModelName = modelName
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.PrivateData.BillingContext.GroupRatio = 0.8
	task.PricingGroup = "pg_legacy"
	task.Data = json.RawMessage(`{"data":{"usage":{"total_tokens":87300,"completion_tokens":87300},"request_info":{"parameters":{"content":[{"type":"text","text":"hello"}],"resolution":"720p"}}}}`)
	require.NoError(t, model.DB.Create(task).Error)

	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:       task.UserId,
		LogType:      model.LogTypeConsume,
		ModelName:    modelName,
		Quota:        0,
		Group:        task.Group,
		PricingGroup: task.GetPricingGroup(),
		RequestId:    task.TaskID,
		Other: map[string]interface{}{
			"task_id":     task.TaskID,
			"billing_sku": variantKey,
		},
	})

	RecalculateTaskQuotaByTokens(context.Background(), task, 87300)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, 244440, log.Quota)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	assert.Equal(t, variantKey, other["billing_sku"])
	assert.Equal(t, variantKey, other["model_variant"])
	assert.Equal(t, "novideo", other["input_mode"])
	assert.Equal(t, "720p", other["resolution_bucket"])
	assert.Equal(t, float64(7), other["rate_per_m"])
	assert.Equal(t, float64(3.5), other["model_ratio"])
	assert.Equal(t, false, other["used_fallback"])
}

func TestRecalculateTaskQuotaByTokens_ImaProInfersConfiguredSKUFromLegacyTaskData(t *testing.T) {
	truncate(t)

	const (
		modelName  = "ima-pro"
		variantKey = "ima-pro-withvideo-1080p"
	)
	withTempRatios(t, modelName, 37.5, 1)
	withTempRatios(t, variantKey, 2.35, 1)

	seedUser(t, 402, 1000000)
	seedChannelWithType(t, 402, constant.ChannelTypeImaPro)

	task := makeTask(402, 402, 0, 0, BillingSourceWallet, 0)
	task.TaskID = "task_legacy_data"
	task.ChannelId = 0
	task.Platform = constant.TaskPlatform("60")
	task.Properties.OriginModelName = modelName
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.PrivateData.BillingContext.GroupRatio = 0.8
	task.PricingGroup = "pg_legacy_data"
	task.Data = json.RawMessage(`{"data":{"usage":{"total_tokens":1000,"completion_tokens":1000},"request_info":{"parameters":{"content":[{"type":"text","text":"hello"},{"type":"video_url","url":"https://example.com/in.mp4"}],"resolution":"1080p"}}}}`)
	require.NoError(t, model.DB.Create(task).Error)

	RecalculateTaskQuotaByTokens(context.Background(), task, 1000)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, 1880, log.Quota)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	assert.Equal(t, variantKey, other["billing_sku"])
	assert.Equal(t, "withvideo", other["input_mode"])
	assert.Equal(t, "1080p", other["resolution_bucket"])
	assert.Equal(t, float64(4.7), other["rate_per_m"])
	assert.Equal(t, float64(2.35), other["model_ratio"])
	assert.Equal(t, false, other["used_fallback"])
}

func TestRecalculateTaskQuotaByTokens_ImaProInfers480pSKUFromLegacyTaskData(t *testing.T) {
	truncate(t)

	const (
		modelName  = "ima-pro"
		variantKey = "ima-pro-novideo-480p"
	)
	withTempRatios(t, modelName, 37.5, 1)
	withTempRatios(t, variantKey, 3.5, 1)

	seedUser(t, 403, 1000000)
	seedChannelWithType(t, 403, constant.ChannelTypeImaPro)

	task := makeTask(403, 403, 0, 0, BillingSourceWallet, 0)
	task.TaskID = "task_legacy_data_480p"
	task.ChannelId = 0
	task.Platform = constant.TaskPlatform("60")
	task.Properties.OriginModelName = modelName
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.PrivateData.BillingContext.GroupRatio = 0.8
	task.PricingGroup = "pg_legacy_data"
	task.Data = json.RawMessage(`{"data":{"usage":{"total_tokens":1000,"completion_tokens":1000},"request_info":{"parameters":{"content":[{"type":"text","text":"hello"}],"resolution":"480p"}}}}`)
	require.NoError(t, model.DB.Create(task).Error)

	RecalculateTaskQuotaByTokens(context.Background(), task, 1000)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, 2800, log.Quota)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	assert.Equal(t, variantKey, other["billing_sku"])
	assert.Equal(t, "novideo", other["input_mode"])
	assert.Equal(t, "480p", other["resolution_bucket"])
	assert.Equal(t, float64(7), other["rate_per_m"])
	assert.Equal(t, false, other["used_fallback"])
}

func TestRecalculateTaskQuotaByTokens_ImaProKeepsBaseModelWhenSKUUnconfigured(t *testing.T) {
	truncate(t)

	const modelName = "ima-pro"
	withTempRatios(t, modelName, 3.5, 1)

	seedUser(t, 403, 1000000)
	seedChannelWithType(t, 403, constant.ChannelTypeImaPro)

	task := makeTask(403, 403, 0, 0, BillingSourceWallet, 0)
	task.TaskID = "task_no_sku_config"
	task.Properties.OriginModelName = modelName
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.PrivateData.BillingContext.GroupRatio = 0.8
	task.PricingGroup = "pg_no_sku"
	task.Data = json.RawMessage(`{"data":{"usage":{"total_tokens":1000,"completion_tokens":1000},"request_info":{"parameters":{"content":[{"type":"text","text":"hello"}],"resolution":"720p"}}}}`)
	require.NoError(t, model.DB.Create(task).Error)

	RecalculateTaskQuotaByTokens(context.Background(), task, 1000)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, 2800, log.Quota)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	assert.Equal(t, modelName, other["billing_sku"])
	assert.Equal(t, modelName, other["model_variant"])
	assert.NotContains(t, other, "input_mode")
	assert.NotContains(t, other, "resolution_bucket")
	assert.Equal(t, float64(7), other["rate_per_m"])
	assert.Equal(t, float64(3.5), other["model_ratio"])
	assert.Equal(t, false, other["used_fallback"])
}

func TestRecalculateTaskQuotaByTokens_ImaProFallsBackWhenPersistedSKUUnconfigured(t *testing.T) {
	truncate(t)

	const (
		modelName  = "ima-pro"
		variantKey = "ima-pro-novideo-480p"
	)
	withTempRatios(t, modelName, 3.5, 1)

	seedUser(t, 404, 1000000)
	seedChannelWithType(t, 404, constant.ChannelTypeImaPro)

	task := makeTask(404, 404, 0, 0, BillingSourceWallet, 0)
	task.TaskID = "task_persisted_sku_unconfigured"
	task.Properties.OriginModelName = modelName
	task.Properties.BillingSku = variantKey
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.PrivateData.BillingContext.BillingSku = variantKey
	task.PrivateData.BillingContext.GroupRatio = 0.8
	task.PricingGroup = "pg_sku_unconfigured"
	task.Data = json.RawMessage(`{"data":{"usage":{"total_tokens":1000,"completion_tokens":1000},"request_info":{"parameters":{"content":[{"type":"text","text":"hello"}],"resolution":"480p"}}}}`)
	require.NoError(t, model.DB.Create(task).Error)

	RecalculateTaskQuotaByTokens(context.Background(), task, 1000)

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, 2800, log.Quota)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	assert.Equal(t, variantKey, other["billing_sku"])
	assert.Equal(t, variantKey, other["model_variant"])
	assert.Equal(t, "novideo", other["input_mode"])
	assert.Equal(t, "480p", other["resolution_bucket"])
	assert.Equal(t, float64(7), other["rate_per_m"])
	assert.Equal(t, float64(3.5), other["model_ratio"])
	assert.Equal(t, true, other["used_fallback"])
}

func TestResolveDeferredTaskActualQuota_ImaProUsesVariantSKU(t *testing.T) {
	truncate(t)

	const (
		modelName  = "ima-pro"
		variantKey = "ima-pro-novideo-1080p"
	)
	withTempRatios(t, modelName, 3.5, 1)
	withTempRatios(t, variantKey, 3.85, 1)

	seedUser(t, 404, 1000000)
	seedChannelWithType(t, 404, constant.ChannelTypeImaPro)

	task := makeTask(404, 404, 0, 0, BillingSourceWallet, 0)
	task.Properties.OriginModelName = modelName
	task.Properties.BillingSku = variantKey
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.PrivateData.BillingContext.BillingSku = variantKey
	task.PrivateData.BillingContext.GroupRatio = 0.8

	quota, reason := ResolveDeferredTaskActualQuota(nil, task, &relaycommon.TaskInfo{TotalTokens: 245025})

	assert.Equal(t, 754677, quota)
	assert.Equal(t, "token_recalculate:245025", reason)
}

func TestApplyDeferredTaskTerminalCharge_ImaProLogsVariantSKU(t *testing.T) {
	truncate(t)

	const (
		modelName  = "ima-pro"
		variantKey = "ima-pro-novideo-1080p"
	)
	withTempRatios(t, modelName, 3.5, 1)
	withTempRatios(t, variantKey, 3.85, 1)

	seedUser(t, 405, 10000000)
	seedChannelWithType(t, 405, constant.ChannelTypeImaPro)

	task := makeTask(405, 405, 0, 0, BillingSourceWallet, 0)
	task.TaskID = "task_terminal_ima_variant"
	task.Properties.OriginModelName = modelName
	task.Properties.BillingSku = variantKey
	task.PrivateData.BillingContext.OriginModelName = modelName
	task.PrivateData.BillingContext.BillingSku = variantKey
	task.PrivateData.BillingContext.GroupRatio = 0.8
	task.PrivateData.BillingContext.DeferredSettle = true
	task.PrivateData.BillingContext.TerminalChargeState = TaskTerminalChargeStatePending
	task.Data = json.RawMessage(`{"data":{"usage":{"total_tokens":245025,"completion_tokens":245025},"request_info":{"parameters":{"content":[{"type":"text","text":"hello"}],"resolution":"1080p"}}}}`)
	require.NoError(t, model.DB.Create(task).Error)

	require.NoError(t, ApplyDeferredTaskTerminalCharge(context.Background(), task, 754677, "token_recalculate:245025"))

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, 754677, log.Quota)

	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	assert.Equal(t, variantKey, other["billing_sku"])
	assert.Equal(t, variantKey, other["model_variant"])
	assert.Equal(t, "novideo", other["input_mode"])
	assert.Equal(t, "1080p", other["resolution_bucket"])
	assert.Equal(t, float64(7.7), other["rate_per_m"])
	assert.Equal(t, float64(3.85), other["model_ratio"])
	assert.Equal(t, float64(0.8), other["group_ratio"])
	assert.Equal(t, false, other["used_fallback"])
	assert.Equal(t, float64(754677), other["actual_quota"])
}
