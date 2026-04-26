package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestTaskGetAllUserTask_Filters(t *testing.T) {
	setupTaskQueryTestDB(t)

	t.Run("空数据", func(t *testing.T) {
		items := TaskGetAllUserTask(1, 0, 10, SyncTaskQueryParams{})
		total := TaskCountAllUserTask(1, SyncTaskQueryParams{})
		assert.Empty(t, items)
		assert.EqualValues(t, 0, total)
	})

	t.Run("分页", func(t *testing.T) {
		clearTaskQueryTables(t)
		for i := 0; i < 5; i++ {
			createTaskQueryTask(t, int64(i+1), 1, TaskStatusSuccess, int64(100+i), 1)
		}

		items := TaskGetAllUserTask(1, 0, 2, SyncTaskQueryParams{})
		total := TaskCountAllUserTask(1, SyncTaskQueryParams{})
		require.Len(t, items, 2)
		assert.EqualValues(t, 5, total)
		assert.EqualValues(t, 5, items[0].ID)
		assert.EqualValues(t, 4, items[1].ID)
	})

	t.Run("Status 过滤", func(t *testing.T) {
		clearTaskQueryTables(t)
		createTaskQueryTask(t, 1, 1, TaskStatusSuccess, 100, 1)
		createTaskQueryTask(t, 2, 1, TaskStatusFailure, 101, 1)
		createTaskQueryTask(t, 3, 1, TaskStatusFailure, 102, 1)

		params := SyncTaskQueryParams{
			Status: string(TaskStatusFailure),
		}
		items := TaskGetAllUserTask(1, 0, 10, params)
		total := TaskCountAllUserTask(1, params)
		require.Len(t, items, 2)
		assert.EqualValues(t, 2, total)
		for _, item := range items {
			assert.EqualValues(t, TaskStatusFailure, item.Status)
		}
	})

	t.Run("越权", func(t *testing.T) {
		clearTaskQueryTables(t)
		createTaskQueryTask(t, 1, 1, TaskStatusSuccess, 100, 1)
		createTaskQueryTask(t, 2, 2, TaskStatusSuccess, 101, 1)

		items := TaskGetAllUserTask(1, 0, 10, SyncTaskQueryParams{})
		total := TaskCountAllUserTask(1, SyncTaskQueryParams{})
		require.Len(t, items, 1)
		assert.EqualValues(t, 1, total)
		assert.Equal(t, 1, items[0].UserId)
	})

	t.Run("ChannelID 过滤", func(t *testing.T) {
		clearTaskQueryTables(t)
		createTaskQueryTask(t, 1, 1, TaskStatusSuccess, 100, 1)
		createTaskQueryTask(t, 2, 1, TaskStatusSuccess, 101, 1)
		createTaskQueryTask(t, 3, 1, TaskStatusSuccess, 102, 2)

		params := SyncTaskQueryParams{
			ChannelID: "1",
		}
		items := TaskGetAllUserTask(1, 0, 10, params)
		total := TaskCountAllUserTask(1, params)
		require.Len(t, items, 2)
		assert.EqualValues(t, 2, total)
		for _, item := range items {
			assert.EqualValues(t, 1, item.ChannelId)
		}
	})
}

func setupTaskQueryTestDB(t *testing.T) {
	t.Helper()

	prevDB := DB
	prevLogDB := LOG_DB
	prevSQLite := common.UsingSQLite
	prevMySQL := common.UsingMySQL
	prevPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(":memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	InitColumnNames()

	require.NoError(t, db.AutoMigrate(&Task{}))
	clearTaskQueryTables(t)

	t.Cleanup(func() {
		DB = prevDB
		LOG_DB = prevLogDB
		common.UsingSQLite = prevSQLite
		common.UsingMySQL = prevMySQL
		common.UsingPostgreSQL = prevPostgreSQL
	})
}

func clearTaskQueryTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.Exec("DELETE FROM tasks").Error)
}

func createTaskQueryTask(
	t *testing.T,
	id int64,
	userID int,
	status TaskStatus,
	submitTime int64,
	channelID int,
) {
	t.Helper()

	task := &Task{
		ID:         id,
		TaskID:     taskQueryTaskID(id),
		Platform:   constant.TaskPlatform("suno"),
		UserId:     userID,
		ChannelId:  channelID,
		Action:     "generate",
		Status:     status,
		SubmitTime: submitTime,
		CreatedAt:  time.Now().Unix(),
		UpdatedAt:  time.Now().Unix(),
		Properties: Properties{
			Input: "test",
		},
	}

	require.NoError(t, DB.Create(task).Error)
}

func taskQueryTaskID(id int64) string {
	return "task_query_" + time.Unix(id, 0).Format("150405")
}
