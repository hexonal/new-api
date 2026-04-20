package relay

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRelayTaskVideoFetchTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)

	prevDB := model.DB
	prevLogDB := model.LOG_DB
	prevSQLite := common.UsingSQLite
	prevMySQL := common.UsingMySQL
	prevPostgreSQL := common.UsingPostgreSQL
	prevRedis := common.RedisEnabled
	prevMemoryCache := common.MemoryCacheEnabled

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.MemoryCacheEnabled = false

	dsn := "file:relay_task_video_fetch_test?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.Task{},
		&model.Channel{},
		&model.Log{},
		&model.GenerationRecord{},
	))
	model.DB = db
	model.LOG_DB = db

	t.Cleanup(func() {
		model.DB = prevDB
		model.LOG_DB = prevLogDB
		common.UsingSQLite = prevSQLite
		common.UsingMySQL = prevMySQL
		common.UsingPostgreSQL = prevPostgreSQL
		common.RedisEnabled = prevRedis
		common.MemoryCacheEnabled = prevMemoryCache
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func TestVideoFetchByIDRealtimeFetchesLatestUpstreamStatus(t *testing.T) {
	db := setupRelayTaskVideoFetchTestDB(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/videos/upstream-task-1", r.URL.Path)
		require.Equal(t, "Bearer sk-video", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"upstream-task-1","object":"video","model":"sora-2-max","status":"completed","progress":100,"video_url":"https://example.com/video.mp4","created_at":1,"completed_at":2}`))
	}))
	defer server.Close()

	baseURL := server.URL
	channel := &model.Channel{
		Id:          1,
		Type:        constant.ChannelTypeOpenAI,
		Key:         "sk-video",
		Name:        "video-test",
		Status:      common.ChannelStatusEnabled,
		BaseURL:     &baseURL,
		Models:      "sora3",
		Group:       "default",
		CreatedTime: time.Now().Unix(),
	}
	require.NoError(t, db.Create(channel).Error)

	task := &model.Task{
		TaskID:     "task_public_1",
		Platform:   constant.TaskPlatform("1"),
		UserId:     1,
		Group:      "default",
		ChannelId:  1,
		Action:     constant.TaskActionTextGenerate,
		Status:     model.TaskStatusQueued,
		SubmitTime: time.Now().Unix(),
		CreatedAt:  time.Now().Unix(),
		UpdatedAt:  time.Now().Unix(),
		Progress:   "20%",
		Properties: model.Properties{
			OriginModelName:   "sora3",
			UpstreamModelName: "sora3",
		},
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "upstream-task-1",
		},
		Data: []byte(`{"id":"task_public_1","object":"video","model":"sora3","status":"queued","progress":0,"created_at":1}`),
	}
	require.NoError(t, db.Create(task).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/videos/task_public_1", nil)
	ctx.Set("id", 1)
	ctx.Params = gin.Params{{Key: "task_id", Value: "task_public_1"}}

	respBody, taskErr := videoFetchByIDRespBodyBuilder(ctx)
	require.Nil(t, taskErr)

	body := string(respBody)
	assert.Contains(t, body, `"status":"completed"`)
	assert.Contains(t, body, `"video_url":"https://example.com/video.mp4"`)

	var updated model.Task
	require.NoError(t, db.Where("task_id = ?", "task_public_1").First(&updated).Error)
	assert.EqualValues(t, model.TaskStatusSuccess, updated.Status)
	assert.Equal(t, "https://example.com/video.mp4", strings.TrimSpace(updated.GetResultURL()))
}
