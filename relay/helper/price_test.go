package helper

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func TestHandleGroupRatio_PrefersUserGroupOverLegacyPricingGroup(t *testing.T) {
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	originalGroupModelRatios := ratio_setting.GroupModelRatio2JSONString()
	defer func() {
		if err := ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios); err != nil {
			t.Fatalf("restore group ratios: %v", err)
		}
		if err := ratio_setting.UpdateGroupModelRatioByJSONString(originalGroupModelRatios); err != nil {
			t.Fatalf("restore group model ratios: %v", err)
		}
	}()

	if err := ratio_setting.UpdateGroupRatioByJSONString(`{"shizeying2":1,"shizeing3":3}`); err != nil {
		t.Fatalf("update group ratios: %v", err)
	}
	if err := ratio_setting.UpdateGroupModelRatioByJSONString(`{"shizeying2":{"gpt-5.1":1},"shizeing3":{"gpt-5.1":1.2}}`); err != nil {
		t.Fatalf("update group model ratios: %v", err)
	}

	ctx, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		OriginModelName:  "gpt-5.1",
		UsingGroup:       "shizeing3",
		UserGroup:        "shizeing3",
		UserPricingGroup: "shizeying2",
	}

	groupRatio := HandleGroupRatio(ctx, info)
	if groupRatio.GroupRatio != 1.2 {
		t.Fatalf("group ratio = %v, want 1.2", groupRatio.GroupRatio)
	}
	if groupRatio.GroupRatioSource != "group_model" {
		t.Fatalf("group ratio source = %q, want group_model", groupRatio.GroupRatioSource)
	}
}

func TestCalculateFixedPerCallQuota_RoundsHalfUp(t *testing.T) {
	quota := CalculateFixedPerCallQuota(0.198529, 1)
	if quota != 99265 {
		t.Fatalf("quota = %d, want 99265", quota)
	}
}

func TestCalculateFixedPerCallQuota_ZeroGroupRatioKeepsFree(t *testing.T) {
	quota := CalculateFixedPerCallQuota(0.198529, 0)
	if quota != 0 {
		t.Fatalf("quota = %d, want 0", quota)
	}
}

func TestResolvePerCallPricingModelName_PrefersConfiguredHailuoSKU(t *testing.T) {
	original := ratio_setting.ModelPrice2JSONString()
	defer func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(original); err != nil {
			t.Fatalf("restore model price map: %v", err)
		}
	}()
	if err := ratio_setting.UpdateModelPriceByJSONString(`{"MiniMax-Hailuo-2.3-Fast":0.198529,"MiniMax-Hailuo-2.3-Fast-6s-1080p":0.3397058824}`); err != nil {
		t.Fatalf("update model price map: %v", err)
	}

	info := &relaycommon.RelayInfo{
		OriginModelName: "MiniMax-Hailuo-2.3-Fast",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			ConsumedModel: "MiniMax-Hailuo-2.3-Fast-6s-1080p",
		},
	}

	got := resolvePerCallPricingModelName(info)
	if got != "MiniMax-Hailuo-2.3-Fast-6s-1080p" {
		t.Fatalf("pricing model = %q, want sku key", got)
	}
}

func TestResolvePerCallPricingModelName_FallsBackToOriginWhenSKUMissing(t *testing.T) {
	original := ratio_setting.ModelPrice2JSONString()
	defer func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(original); err != nil {
			t.Fatalf("restore model price map: %v", err)
		}
	}()
	if err := ratio_setting.UpdateModelPriceByJSONString(`{"MiniMax-Hailuo-2.3-Fast":0.198529}`); err != nil {
		t.Fatalf("update model price map: %v", err)
	}

	info := &relaycommon.RelayInfo{
		OriginModelName: "MiniMax-Hailuo-2.3-Fast",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			ConsumedModel: "MiniMax-Hailuo-2.3-Fast-6s-1080p",
		},
	}

	got := resolvePerCallPricingModelName(info)
	if got != "MiniMax-Hailuo-2.3-Fast" {
		t.Fatalf("pricing model = %q, want origin model", got)
	}
}

func TestModelPriceHelperPerCall_UsesSKUGroupRatioForHailuo(t *testing.T) {
	originalModelPrices := ratio_setting.ModelPrice2JSONString()
	originalGroupModelRatios := ratio_setting.GroupModelRatio2JSONString()
	defer func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(originalModelPrices); err != nil {
			t.Fatalf("restore model prices: %v", err)
		}
		if err := ratio_setting.UpdateGroupModelRatioByJSONString(originalGroupModelRatios); err != nil {
			t.Fatalf("restore group model ratios: %v", err)
		}
	}()

	if err := ratio_setting.UpdateModelPriceByJSONString(`{"MiniMax-Hailuo-2.3-Fast":0.198529,"MiniMax-Hailuo-2.3-Fast-6s-1080p":0.34}`); err != nil {
		t.Fatalf("update model prices: %v", err)
	}
	if err := ratio_setting.UpdateGroupModelRatioByJSONString(`{"vip":{"MiniMax-Hailuo-2.3-Fast-6s-1080p":0.5,"MiniMax-Hailuo-2.3-Fast":2}}`); err != nil {
		t.Fatalf("update group model ratios: %v", err)
	}

	ctx, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		OriginModelName:  "MiniMax-Hailuo-2.3-Fast",
		UsingGroup:       "vip",
		UserPricingGroup: "vip",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			ConsumedModel: "MiniMax-Hailuo-2.3-Fast-6s-1080p",
		},
	}

	priceData, err := ModelPriceHelperPerCall(ctx, info)
	if err != nil {
		t.Fatalf("ModelPriceHelperPerCall error: %v", err)
	}

	if priceData.GroupRatioInfo.GroupRatio != 0.5 {
		t.Fatalf("group ratio = %v, want 0.5", priceData.GroupRatioInfo.GroupRatio)
	}
	if priceData.ModelPrice != 0.34 {
		t.Fatalf("model price = %v, want 0.34", priceData.ModelPrice)
	}
	if priceData.Quota != 85000 {
		t.Fatalf("quota = %d, want 85000", priceData.Quota)
	}
}
