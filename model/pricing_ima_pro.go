package model

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

type PricingVariant struct {
	Key              string  `json:"key"`
	InputMode        string  `json:"input_mode"`
	ResolutionBucket string  `json:"resolution_bucket"`
	ModelRatio       float64 `json:"model_ratio"`
	RatePerM         float64 `json:"rate_per_m"`
}

// GetIMAProVariantPrices exposes configured IMA Pro ratio variants to /api/pricing
// so the model plaza can show the same price bands used by settlement.
func GetIMAProVariantPrices(modelName string) []PricingVariant {
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	if !ratio_setting.IsIMAProModel(modelName) {
		return nil
	}

	inputModes := []string{"novideo", "withvideo"}
	resolutionBuckets := []string{"720p", "1080p"}
	rows := make([]PricingVariant, 0, len(inputModes)*len(resolutionBuckets))
	for _, inputMode := range inputModes {
		for _, bucket := range resolutionBuckets {
			key := ratio_setting.ResolveVariantKey(modelName, inputMode, bucket)
			ratio, ok := ratio_setting.GetModelRatioExact(key)
			if !ok || ratio <= 0 {
				continue
			}
			rows = append(rows, PricingVariant{
				Key:              key,
				InputMode:        inputMode,
				ResolutionBucket: bucket,
				ModelRatio:       ratio,
				RatePerM:         ratio * 2,
			})
		}
	}
	if len(rows) == 0 {
		return nil
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].InputMode != rows[j].InputMode {
			return rows[i].InputMode < rows[j].InputMode
		}
		ri := imaProResolutionOrder(rows[i].ResolutionBucket)
		rj := imaProResolutionOrder(rows[j].ResolutionBucket)
		if ri != rj {
			return ri < rj
		}
		return rows[i].Key < rows[j].Key
	})
	return rows
}

func imaProResolutionOrder(bucket string) int {
	switch bucket {
	case "720p":
		return 1
	case "1080p":
		return 2
	default:
		return 99
	}
}
