package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPricingAddsHailuoSKUPrices(t *testing.T) {
	truncateTables(t)
	t.Cleanup(func() {
		DB.Exec("DELETE FROM abilities")
		DB.Exec("DELETE FROM models")
		DB.Exec("DELETE FROM vendors")
	})
	require.NoError(t, DB.AutoMigrate(&Ability{}, &Model{}, &Vendor{}))

	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(originalModelPrice))
		lastGetPricingTime = time.Time{}
	})

	// Set up ModelPrice with base rate SKU and child SKUs.
	// OfficialPoints are derived as skuPrice / baseRate where baseRate is the
	// minimum-priced SKU (MiniMax-Hailuo-02-6s-512p = 0.088235 = 1 credit here).
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{
		"MiniMax-Hailuo-02":0.294118,
		"MiniMax-Hailuo-02-6s-512p":0.088235,
		"MiniMax-Hailuo-02-10s-512p":0.147059,
		"MiniMax-Hailuo-02-6s-768p":0.294118,
		"MiniMax-Hailuo-02-10s-768p":0.588236,
		"MiniMax-Hailuo-02-6s-1080p":0.588236
	}`))

	require.NoError(t, DB.Create(&Channel{
		Id:     1,
		Type:   constant.ChannelTypeMiniMax,
		Key:    "test-key",
		Status: common.ChannelStatusEnabled,
		Name:   "hailuo",
		Group:  "shizeing3",
		Models: "MiniMax-Hailuo-02",
	}).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "shizeing3",
		Model:     "MiniMax-Hailuo-02",
		ChannelId: 1,
		Enabled:   true,
	}).Error)
	require.NoError(t, DB.Create(&Model{
		ModelName: "MiniMax-Hailuo-02",
		Status:    1,
	}).Error)

	lastGetPricingTime = time.Time{}
	RefreshPricing()

	pricing := GetPricing()
	require.Len(t, pricing, 1)
	require.Len(t, pricing[0].SKUPrices, 5)

	// Sorted by duration asc then resolution asc:
	// 6s-512p, 6s-768p, 6s-1080p, 10s-512p, 10s-768p
	sku := pricing[0].SKUPrices[0]
	assert.Equal(t, "MiniMax-Hailuo-02-6s-512p", sku.SKU)
	assert.Equal(t, 6, sku.Duration)
	assert.Equal(t, "512p", sku.Resolution)
	assert.InDelta(t, 1.0, sku.OfficialPoints, 0.05) // base rate = cheapest SKU: 0.088235/0.088235 = 1.0
	assert.InDelta(t, 0.088235, sku.ModelPrice, 1e-9)

	sku1080 := pricing[0].SKUPrices[2]
	assert.Equal(t, "MiniMax-Hailuo-02-6s-1080p", sku1080.SKU)
	assert.InDelta(t, 6.7, sku1080.OfficialPoints, 0.05) // 0.588236/0.088235 ≈ 6.7
	assert.InDelta(t, 0.588236, sku1080.ModelPrice, 1e-9)
}

func TestGetPricingAddsIMAProVariantPrices(t *testing.T) {
	truncateTables(t)
	t.Cleanup(func() {
		DB.Exec("DELETE FROM abilities")
		DB.Exec("DELETE FROM models")
		DB.Exec("DELETE FROM vendors")
	})
	require.NoError(t, DB.AutoMigrate(&Ability{}, &Model{}, &Vendor{}))

	originalModelRatio := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalModelRatio))
		lastGetPricingTime = time.Time{}
	})

	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{
		"ima-pro":3.5,
		"ima-pro-novideo-480p":3.5,
		"ima-pro-novideo-720p":3.5,
		"ima-pro-novideo-1080p":3.85,
		"ima-pro-withvideo-480p":2.15,
		"ima-pro-withvideo-720p":2.15,
		"ima-pro-withvideo-1080p":2.35
	}`))

	require.NoError(t, DB.Create(&Channel{
		Id:     1,
		Type:   constant.ChannelTypeOpenAI,
		Key:    "test-key",
		Status: common.ChannelStatusEnabled,
		Name:   "ima",
		Group:  "default",
		Models: "ima-pro",
	}).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "ima-pro",
		ChannelId: 1,
		Enabled:   true,
	}).Error)
	require.NoError(t, DB.Create(&Model{
		ModelName: "ima-pro",
		Status:    1,
	}).Error)

	lastGetPricingTime = time.Time{}
	RefreshPricing()

	pricing := GetPricing()
	require.Len(t, pricing, 1)
	require.Len(t, pricing[0].VariantPrices, 6)

	assert.Equal(t, "ima-pro-novideo-480p", pricing[0].VariantPrices[0].Key)
	assert.Equal(t, "novideo", pricing[0].VariantPrices[0].InputMode)
	assert.Equal(t, "480p", pricing[0].VariantPrices[0].ResolutionBucket)
	assert.InDelta(t, 3.5, pricing[0].VariantPrices[0].ModelRatio, 1e-9)
	assert.InDelta(t, 7.0, pricing[0].VariantPrices[0].RatePerM, 1e-9)

	assert.Equal(t, "ima-pro-withvideo-1080p", pricing[0].VariantPrices[5].Key)
	assert.Equal(t, "withvideo", pricing[0].VariantPrices[5].InputMode)
	assert.Equal(t, "1080p", pricing[0].VariantPrices[5].ResolutionBucket)
	assert.InDelta(t, 2.35, pricing[0].VariantPrices[5].ModelRatio, 1e-9)
	assert.InDelta(t, 4.7, pricing[0].VariantPrices[5].RatePerM, 1e-9)
}
