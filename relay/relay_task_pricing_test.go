package relay

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestCalculatePerCallQuotaWithRatios_UsesExactDecimalMath(t *testing.T) {
	quota := calculatePerCallQuotaWithRatios(0.03, 1.0, map[string]float64{
		"duration":   5,
		"resolution": 8.0 / 6.0,
		"audio":      10.0 / 8.0,
	})
	if quota != 125000 {
		t.Fatalf("quota = %d, want 125000", quota)
	}

	quota = calculatePerCallQuotaWithRatios(0.025, 1.0, map[string]float64{
		"duration":   5,
		"resolution": 7.0 / 5.0,
		"audio":      9.0 / 7.0,
	})
	if quota != 112500 {
		t.Fatalf("quota = %d, want 112500", quota)
	}
}

func TestCalculatePerCallQuotaWithRatios_ZeroGroupRatioKeepsFreeModelFree(t *testing.T) {
	quota := calculatePerCallQuotaWithRatios(0.03, 0, map[string]float64{
		"duration":   5,
		"resolution": 8.0 / 6.0,
		"audio":      10.0 / 8.0,
	})
	if quota != 0 {
		t.Fatalf("quota = %d, want 0", quota)
	}
}

func TestShouldUsePerCallBillingForTaskModel_ImaProAlwaysToken(t *testing.T) {
	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	originalModelRatio := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(originalModelPrice); err != nil {
			t.Fatalf("restore model price map failed: %v", err)
		}
		if err := ratio_setting.UpdateModelRatioByJSONString(originalModelRatio); err != nil {
			t.Fatalf("restore model ratio map failed: %v", err)
		}
	})
	priceMap := map[string]float64{
		"unit-per-call-model": 0.123,
	}
	ratioMap := map[string]float64{
		"unit-token-model": 1.7,
	}
	priceJSON, _ := json.Marshal(priceMap)
	ratioJSON, _ := json.Marshal(ratioMap)
	if err := ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)); err != nil {
		t.Fatalf("update model price map failed: %v", err)
	}
	if err := ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)); err != nil {
		t.Fatalf("update model ratio map failed: %v", err)
	}

	original := constant.TaskPricePatches
	constant.TaskPricePatches = []string{"ima-pro", "unit-token-model", "unknown-task-model-for-patch-fallback"}
	t.Cleanup(func() {
		constant.TaskPricePatches = original
	})

	if shouldUsePerCallBillingForTaskModel("ima-pro") {
		t.Fatalf("ima-pro should not use per-call billing")
	}
	if !shouldUsePerCallBillingForTaskModel("unit-per-call-model") {
		t.Fatalf("unit-per-call-model should use per-call billing")
	}
	if shouldUsePerCallBillingForTaskModel("unit-token-model") {
		t.Fatalf("unit-token-model should keep token billing even if listed in TASK_PRICE_PATCH")
	}
	if !shouldUsePerCallBillingForTaskModel("unknown-task-model-for-patch-fallback") {
		t.Fatalf("unknown patch model should fallback to per-call billing")
	}
}

func TestShouldUsePerCallBillingForTaskModel_ViduDeferredButPerCallWhenPriceExists(t *testing.T) {
	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	originalModelRatio := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(originalModelPrice); err != nil {
			t.Fatalf("restore model price map failed: %v", err)
		}
		if err := ratio_setting.UpdateModelRatioByJSONString(originalModelRatio); err != nil {
			t.Fatalf("restore model ratio map failed: %v", err)
		}
	})

	priceMap := map[string]float64{
		"viduq1": 0.40,
	}
	ratioMap := map[string]float64{
		"viduq1": 1.0,
	}
	priceJSON, _ := json.Marshal(priceMap)
	ratioJSON, _ := json.Marshal(ratioMap)
	if err := ratio_setting.UpdateModelPriceByJSONString(string(priceJSON)); err != nil {
		t.Fatalf("update model price map failed: %v", err)
	}
	if err := ratio_setting.UpdateModelRatioByJSONString(string(ratioJSON)); err != nil {
		t.Fatalf("update model ratio map failed: %v", err)
	}

	if !shouldUseDeferredSettleForTaskModel("viduq1") {
		t.Fatalf("viduq1 should keep deferred settle strategy")
	}
	if shouldUseTokenBillingForTaskModel("viduq1") {
		t.Fatalf("viduq1 should not be forced to token billing")
	}
	if !shouldUsePerCallBillingForTaskModel("viduq1") {
		t.Fatalf("viduq1 should use per-call billing when model_price exists")
	}
}

func TestShouldUseDeferredSettleForTaskModel_AsyncImageTaskModels(t *testing.T) {
	if !shouldUseDeferredSettleForTaskModel("ima-pro") {
		t.Fatalf("ima-pro should use deferred settle strategy")
	}
	if !shouldUseDeferredSettleForTaskModel("gemini-3-pro-image-preview") {
		t.Fatalf("gemini-3-pro-image-preview should use deferred settle strategy")
	}
	if !shouldUseDeferredSettleForTaskModel("gemini-3.1-flash-image-preview") {
		t.Fatalf("gemini-3.1-flash-image-preview should use deferred settle strategy")
	}
	if shouldUseDeferredSettleForTaskModel("sora-2") {
		t.Fatalf("non async-image model should not use deferred settle strategy")
	}
}

func TestExtractConsumedModelFromTaskRequest_HailuoIncludesDurationAndResolution(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
	}
	body := []byte(`{"model":"MiniMax-Hailuo-2.3-Fast","duration":6,"resolution":"768P"}`)

	got := extractConsumedModelFromTaskRequest(body, info)

	if got != "MiniMax-Hailuo-2.3-Fast-6s-768p" {
		t.Fatalf("consumed model = %q, want %q", got, "MiniMax-Hailuo-2.3-Fast-6s-768p")
	}
}

func TestExtractConsumedModelFromTaskRequest_HailuoUsesSizeAsResolution(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
	}
	body := []byte(`{"model":"MiniMax-Hailuo-2.3-Fast","duration":6,"size":"1080p"}`)

	got := extractConsumedModelFromTaskRequest(body, info)

	if got != "MiniMax-Hailuo-2.3-Fast-6s-1080p" {
		t.Fatalf("consumed model = %q, want %q", got, "MiniMax-Hailuo-2.3-Fast-6s-1080p")
	}
}

func TestExtractConsumedModelFromTaskRequest_NonHailuoKeepsModelName(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
	}
	body := []byte(`{"model":"speech-02-hd"}`)

	got := extractConsumedModelFromTaskRequest(body, info)

	if got != "speech-02-hd" {
		t.Fatalf("consumed model = %q, want %q", got, "speech-02-hd")
	}
}

func TestValidateHailuoPricingRequestRejectsUnconfiguredSKUCombo(t *testing.T) {
	// 768p and 1080p are priced; 720p is not — request for 720p must be rejected.
	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(originalModelPrice); err != nil {
			t.Fatalf("restore model price map failed: %v", err)
		}
	})
	if err := ratio_setting.UpdateModelPriceByJSONString(`{"MiniMax-Hailuo-2.3-Fast-6s-768p":0.198529,"MiniMax-Hailuo-2.3-Fast-6s-1080p":0.382353}`); err != nil {
		t.Fatalf("update model price map failed: %v", err)
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
	}

	taskErr := validateHailuoPricingRequest([]byte(`{"model":"MiniMax-Hailuo-2.3-Fast","duration":6,"resolution":"720P"}`), info)

	if taskErr == nil {
		t.Fatal("expected validation error for unpriced combo, got nil")
	}
	if taskErr.Code != "invalid_request" {
		t.Fatalf("code = %q, want %q", taskErr.Code, "invalid_request")
	}
	// Error must mention the unpriced SKU key so operators know what to add.
	if got := taskErr.Message; !strings.Contains(got, "MiniMax-Hailuo-2.3-Fast-6s-720p") {
		t.Fatalf("unexpected message: %q", got)
	}
}

func TestValidateHailuoPricingRequestRejectsUnpricedSKU(t *testing.T) {
	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(originalModelPrice); err != nil {
			t.Fatalf("restore model price map failed: %v", err)
		}
	})
	if err := ratio_setting.UpdateModelPriceByJSONString(`{"MiniMax-Hailuo-2.3-Fast":0.198529}`); err != nil {
		t.Fatalf("update model price map failed: %v", err)
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
	}

	taskErr := validateHailuoPricingRequest([]byte(`{"model":"MiniMax-Hailuo-2.3-Fast","duration":6,"resolution":"1080P"}`), info)

	if taskErr != nil {
		t.Fatalf("expected fallback to base model price, got %#v", taskErr)
	}
}

func TestValidateHailuoPricingRequestAllowsConfiguredSKU(t *testing.T) {
	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(originalModelPrice); err != nil {
			t.Fatalf("restore model price map failed: %v", err)
		}
	})
	if err := ratio_setting.UpdateModelPriceByJSONString(`{"MiniMax-Hailuo-2.3-Fast":0.198529,"MiniMax-Hailuo-2.3-Fast-6s-1080p":0.382353}`); err != nil {
		t.Fatalf("update model price map failed: %v", err)
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
	}

	taskErr := validateHailuoPricingRequest([]byte(`{"model":"MiniMax-Hailuo-2.3-Fast","duration":6,"resolution":"1080P"}`), info)

	if taskErr != nil {
		t.Fatalf("expected nil error, got %#v", taskErr)
	}
}

func TestValidateHailuoPricingRequestRejectsWhenNoPricingConfigured(t *testing.T) {
	// Neither SKU prices nor base model price exist.
	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(originalModelPrice); err != nil {
			t.Fatalf("restore model price map failed: %v", err)
		}
	})
	if err := ratio_setting.UpdateModelPriceByJSONString(`{}`); err != nil {
		t.Fatalf("update model price map failed: %v", err)
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
	}

	taskErr := validateHailuoPricingRequest([]byte(`{"model":"MiniMax-Hailuo-2.3-Fast","duration":6,"resolution":"1080P"}`), info)

	if taskErr == nil {
		t.Fatal("expected missing price error, got nil")
	}
	if taskErr.Code != "invalid_request" {
		t.Fatalf("code = %q, want %q", taskErr.Code, "invalid_request")
	}
	if got := taskErr.Message; got == "" || !containsAll(got, []string{"MiniMax-Hailuo-2.3-Fast", "not configured"}) {
		t.Fatalf("unexpected message: %q", got)
	}
}

func TestValidateHailuoPricingRequestUsesSizeField(t *testing.T) {
	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(originalModelPrice); err != nil {
			t.Fatalf("restore model price map failed: %v", err)
		}
	})
	if err := ratio_setting.UpdateModelPriceByJSONString(`{"MiniMax-Hailuo-2.3-Fast-6s-1080p":0.382353}`); err != nil {
		t.Fatalf("update model price map failed: %v", err)
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeMiniMax,
		},
	}

	taskErr := validateHailuoPricingRequest([]byte(`{"model":"MiniMax-Hailuo-2.3-Fast","duration":6,"size":"1080P"}`), info)

	if taskErr != nil {
		t.Fatalf("expected nil error, got %#v", taskErr)
	}
}

func containsAll(text string, subs []string) bool {
	for _, sub := range subs {
		if !strings.Contains(text, sub) {
			return false
		}
	}
	return true
}
