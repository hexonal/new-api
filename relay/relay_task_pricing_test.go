package relay

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/constant"
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
