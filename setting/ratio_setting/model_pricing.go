package ratio_setting

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/types"
)

// modelPricingMap stores per-model raw JSON pricing payload.
// Each value is the raw bytes of an object like {"unit": "...", "ratios": {...}},
// which is passed through to clients without parsing the inner structure.
// This is purely a display-side setting and is NOT used by the billing path.
var modelPricingMap = types.NewRWMap[string, json.RawMessage]()

// GetModelPricing returns the raw pricing payload for the given model name.
// Returns (nil, false) when the model has no configured pricing.
func GetModelPricing(name string) (json.RawMessage, bool) {
	return modelPricingMap.Get(name)
}

// GetModelPricingMap returns a snapshot of the full pricing map.
func GetModelPricingMap() map[string]json.RawMessage {
	return modelPricingMap.ReadAll()
}

// ModelPricing2JSONString serializes the full pricing map to a JSON string.
func ModelPricing2JSONString() string {
	return modelPricingMap.MarshalJSONString()
}

// UpdateModelPricingByJSONString loads the pricing map from a JSON string.
// The expected shape is map[string]{"unit": string, "ratios": any}, but the
// inner object is preserved as json.RawMessage for transparent pass-through.
func UpdateModelPricingByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(modelPricingMap, jsonStr, InvalidateExposedDataCache)
}
