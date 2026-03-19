package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func truncateOptionTable(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		DB.Exec("DELETE FROM options")
	})
}

func TestReloadPricingOptionsFromDatabase_AutoCreateMissingKeys(t *testing.T) {
	truncateTables(t)
	truncateOptionTable(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))

	// Prepare in-memory defaults as fallback source for missing records.
	InitOptionMap()

	// Keep one key in DB and leave others missing.
	require.NoError(t, DB.Create(&Option{
		Key:   "ModelRatio",
		Value: `{"unit-test-model":1.23}`,
	}).Error)

	err := ReloadPricingOptionsFromDatabase()
	require.NoError(t, err)

	var count int64
	require.NoError(t, DB.Model(&Option{}).Where("key IN ?", pricingOptionKeys).Count(&count).Error)
	assert.EqualValues(t, len(pricingOptionKeys), count)

	var groupGroup Option
	require.NoError(t, DB.Where("key = ?", "GroupGroupRatio").First(&groupGroup).Error)
	assert.NotEmpty(t, groupGroup.Value)
}
