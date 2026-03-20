package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestShouldUsePerCallBillingForTaskModel_ImaProAlwaysToken(t *testing.T) {
	original := constant.TaskPricePatches
	constant.TaskPricePatches = []string{"ima-pro", "sora-2"}
	t.Cleanup(func() {
		constant.TaskPricePatches = original
	})

	if shouldUsePerCallBillingForTaskModel("ima-pro") {
		t.Fatalf("ima-pro should not use per-call billing")
	}
	if !shouldUsePerCallBillingForTaskModel("sora-2") {
		t.Fatalf("sora-2 should use per-call billing when configured in TASK_PRICE_PATCH")
	}
}

func TestShouldUseDeferredSettleForTaskModel_ImaProOnly(t *testing.T) {
	if !shouldUseDeferredSettleForTaskModel("ima-pro") {
		t.Fatalf("ima-pro should use deferred settle strategy")
	}
	if shouldUseDeferredSettleForTaskModel("gemini-3-pro-image-preview") {
		t.Fatalf("gemini image model should not use deferred settle strategy")
	}
	if shouldUseDeferredSettleForTaskModel("sora-2") {
		t.Fatalf("non ima-pro model should not use deferred settle strategy")
	}
}
