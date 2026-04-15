package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveAssetUploadBilling_UsesGroupModelRatio(t *testing.T) {
	originalModelPrices := ratio_setting.ModelPrice2JSONString()
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	originalGroupModelRatios := ratio_setting.GroupModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(originalModelPrices))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
		require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(originalGroupModelRatios))
	})

	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"ima-pro-upload":0.00149}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"qagroup_01":1}`))
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(`{"qagroup_01":{"ima-pro-upload":3}}`))

	billing := resolveAssetUploadBilling("qagroup_01", "qagroup_01", "ima-pro-upload")

	assert.Equal(t, 2235, billing.Quota)
	assert.Equal(t, 0.00149, billing.ModelPrice)
	assert.Equal(t, 3.0, billing.GroupRatio)
	assert.Equal(t, "group_model", billing.GroupRatioSource)
}

func TestResolveAssetUploadBilling_FallsBackToGroupRatio(t *testing.T) {
	originalModelPrices := ratio_setting.ModelPrice2JSONString()
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	originalGroupModelRatios := ratio_setting.GroupModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(originalModelPrices))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
		require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(originalGroupModelRatios))
	})

	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"ima-pro-upload":0.00149}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"shizeing3":0.8}`))
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(`{}`))

	billing := resolveAssetUploadBilling("shizeing3", "shizeing3", "ima-pro-upload")

	assert.Equal(t, 596, billing.Quota)
	assert.Equal(t, 0.00149, billing.ModelPrice)
	assert.Equal(t, 0.8, billing.GroupRatio)
	assert.Equal(t, "group_default", billing.GroupRatioSource)
}

func TestResolveAssetUploadBilling_HonorsZeroGroupModelRatio(t *testing.T) {
	originalModelPrices := ratio_setting.ModelPrice2JSONString()
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	originalGroupModelRatios := ratio_setting.GroupModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(originalModelPrices))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
		require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(originalGroupModelRatios))
	})

	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"ima-pro-upload":0.00149}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"shizeing3":3}`))
	require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(`{"shizeing3":{"ima-pro-upload":0}}`))

	billing := resolveAssetUploadBilling("shizeing3", "shizeing3", "ima-pro-upload")

	assert.Equal(t, 0, billing.Quota)
	assert.Equal(t, 0.0, billing.GroupRatio)
	assert.Equal(t, "group_model", billing.GroupRatioSource)
}

func TestResolveAssetBillingGroups(t *testing.T) {
	tests := []struct {
		name        string
		token       *model.Token
		userGroup   string
		wantGroup   string
		wantPricing string
	}{
		{
			name:        "prefer using group when present",
			token:       &model.Token{Group: "shizeying"},
			userGroup:   "default",
			wantGroup:   "default",
			wantPricing: "default",
		},
		{
			name:        "fallback to user group when token group empty",
			token:       &model.Token{Group: ""},
			userGroup:   "default",
			wantGroup:   "default",
			wantPricing: "default",
		},
		{
			name:        "fallback to default when both empty",
			token:       &model.Token{Group: ""},
			userGroup:   "",
			wantGroup:   "default",
			wantPricing: "default",
		},
		{
			name:        "nil token uses user group",
			token:       nil,
			userGroup:   "vip",
			wantGroup:   "vip",
			wantPricing: "vip",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotGroup, gotPricing := resolveAssetBillingGroups(tc.token, tc.userGroup)
			if gotGroup != tc.wantGroup {
				t.Fatalf("group mismatch: got %q, want %q", gotGroup, tc.wantGroup)
			}
			if gotPricing != tc.wantPricing {
				t.Fatalf("pricing group mismatch: got %q, want %q", gotPricing, tc.wantPricing)
			}
		})
	}
}

func TestBuildAssetBillingLogOther_IncludesRequestMetadata(t *testing.T) {
	other := buildAssetBillingLogOther(710, 0.00142, 1.1, "group_model", RequestLogMetadata{
		RequestPath:       "/v1/assets",
		RequestConversion: []string{"OpenAI Compatible"},
	})

	assert.Equal(t, 0.00142, other["model_price"])
	assert.Equal(t, 1.1, other["group_ratio"])
	assert.Equal(t, "group_model", other["group_ratio_source"])
	assert.Equal(t, 710, other["actual_quota"])
	assert.Equal(t, "asset_upload", other["billing_stage"])
	assert.Equal(t, "/v1/assets", other["request_path"])
	assert.Equal(t, []string{"OpenAI Compatible"}, other["request_conversion"])
}
