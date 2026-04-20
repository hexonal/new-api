package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func resetModelMetaTestTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.Exec("DELETE FROM models").Error)
	t.Cleanup(func() {
		_ = DB.Exec("DELETE FROM models").Error
	})
}

func seedModelMeta(t *testing.T, item *Model) {
	t.Helper()
	require.NoError(t, DB.Create(item).Error)
}

func TestGetAllModelsOrdersBySortOrderThenId(t *testing.T) {
	resetModelMetaTestTables(t)

	seedModelMeta(t, &Model{Id: 301, ModelName: "highest-priority", SortOrder: 10, Status: 1})
	seedModelMeta(t, &Model{Id: 305, ModelName: "low-priority", SortOrder: 1, Status: 1})
	seedModelMeta(t, &Model{Id: 303, ModelName: "highest-priority-later", SortOrder: 10, Status: 1})

	models, err := GetAllModels(0, 10)
	require.NoError(t, err)
	require.Len(t, models, 3)
	require.Equal(t, []int{303, 301, 305}, []int{models[0].Id, models[1].Id, models[2].Id})
}

func TestSearchModelsOrdersBySortOrderThenId(t *testing.T) {
	resetModelMetaTestTables(t)

	seedModelMeta(t, &Model{Id: 401, ModelName: "search-target-a", Description: "alpha", SortOrder: 8, Status: 1})
	seedModelMeta(t, &Model{Id: 409, ModelName: "search-target-b", Description: "beta", SortOrder: 2, Status: 1})
	seedModelMeta(t, &Model{Id: 403, ModelName: "search-target-c", Description: "gamma", SortOrder: 8, Status: 1})

	models, total, err := SearchModels("search-target", "", 0, 10)
	require.NoError(t, err)
	require.EqualValues(t, 3, total)
	require.Len(t, models, 3)
	require.Equal(t, []int{403, 401, 409}, []int{models[0].Id, models[1].Id, models[2].Id})
}
