package model

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

type PricingSKU struct {
	SKU            string  `json:"sku"`
	Duration       int     `json:"duration"`
	Resolution     string  `json:"resolution"`
	OfficialPoints float64 `json:"official_points"`
	ModelPrice     float64 `json:"model_price"`
}

// GetModelSKUPrices scans the provided priceMap for SKU keys matching
// "{modelName}-{N}s-{res}" and returns enriched pricing rows.
// OfficialPoints = round(skuPrice / baseRate × 10) / 10, where baseRate is
// the lowest configured SKU price for this model (= 1 official credit).
// Using the minimum price as the reference is fully DB-driven: any new
// resolution or duration is handled automatically without code changes.
// Returns nil when no matching SKUs are found.
func GetModelSKUPrices(modelName string, priceMap map[string]float64) []PricingSKU {
	prefix := modelName + "-"
	rows := make([]PricingSKU, 0)
	var baseRate float64 // lowest SKU price = 1 credit reference
	for key, price := range priceMap {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		duration, resolution, err := parseHailuoSKUSuffix(key[len(prefix):])
		if err != nil {
			continue
		}
		if baseRate == 0 || price < baseRate {
			baseRate = price
		}
		rows = append(rows, PricingSKU{
			SKU:        key,
			Duration:   duration,
			Resolution: resolution,
			ModelPrice: price,
		})
	}
	if len(rows) == 0 {
		return nil
	}
	if baseRate > 0 {
		for i := range rows {
			rows[i].OfficialPoints = math.Round(rows[i].ModelPrice/baseRate*10) / 10
		}
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Duration != rows[j].Duration {
			return rows[i].Duration < rows[j].Duration
		}
		// Compare resolution numerically (strip trailing 'p') so that
		// 512p < 768p < 1080p rather than the string order 1080p < 512p < 768p.
		ri := parseResolutionHeight(rows[i].Resolution)
		rj := parseResolutionHeight(rows[j].Resolution)
		if ri != rj {
			return ri < rj
		}
		return rows[i].Resolution < rows[j].Resolution // fallback for non-standard values
	})
	return rows
}

// HasHailuoSKUPricingConfigured reports whether any valid Hailuo SKU price
// is configured for modelName. It uses parseHailuoSKUSuffix to filter out
// keys that share the prefix but are not valid SKUs (e.g. "MiniMax-Hailuo-02-Pro").
// This is the authoritative check — callers should prefer this over a plain
// prefix scan to avoid false positives.
func HasHailuoSKUPricingConfigured(modelName string) bool {
	prefix := modelName + "-"
	return ratio_setting.AnyModelPrice(func(k string) bool {
		if !strings.HasPrefix(k, prefix) {
			return false
		}
		_, _, err := parseHailuoSKUSuffix(k[len(prefix):])
		return err == nil
	})
}

// parseResolutionHeight extracts the numeric height from a resolution string
// like "512p", "768p", "1080p". Returns 0 for unrecognised formats so they
// sort consistently at the front.
func parseResolutionHeight(res string) int {
	s := strings.TrimSuffix(res, "p")
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

// parseHailuoSKUSuffix parses the "{N}s-{res}" portion of a Hailuo SKU key.
// For example "6s-512p" → (6, "512p", nil).
func parseHailuoSKUSuffix(suffix string) (duration int, resolution string, err error) {
	parts := strings.SplitN(suffix, "-", 2)
	if len(parts) != 2 {
		return 0, "", fmt.Errorf("unexpected suffix: %q", suffix)
	}
	durationStr := strings.TrimSuffix(parts[0], "s")
	duration, err = strconv.Atoi(durationStr)
	if err != nil || duration <= 0 {
		return 0, "", fmt.Errorf("invalid duration segment: %q", parts[0])
	}
	resolution = parts[1]
	if resolution == "" {
		return 0, "", fmt.Errorf("empty resolution in suffix: %q", suffix)
	}
	return duration, resolution, nil
}
