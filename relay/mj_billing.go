package relay

import (
	"math"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/types"
)

var (
	mjTurboModeRegex = regexp.MustCompile(`(?i)(^|\s)--turbo(\s|$)`)
	mjFastModeRegex  = regexp.MustCompile(`(?i)(^|\s)--fast(\s|$)`)
	mjDraftModeRegex = regexp.MustCompile(`(?i)(^|\s)--draft(\s|$)`)
)

func parseMjSpeedModeAndRatio(prompt string) (string, float64) {
	p := strings.TrimSpace(prompt)
	if p == "" {
		return "normal", 1
	}
	switch {
	case mjTurboModeRegex.MatchString(p):
		return "turbo", 2
	case mjFastModeRegex.MatchString(p):
		return "fast", 2
	case mjDraftModeRegex.MatchString(p):
		return "draft", 0.5
	default:
		return "normal", 1
	}
}

func applyMjSpeedRatioForImagine(action, prompt string, priceData types.PriceData) types.PriceData {
	if action != constant.MjActionImagine {
		return priceData
	}
	mode, ratio := parseMjSpeedModeAndRatio(prompt)
	if ratio == 1 {
		return priceData
	}
	priceData.ModelPrice = priceData.ModelPrice * ratio
	priceData.Quota = int(math.Round(float64(priceData.Quota) * ratio))
	priceData.AddOtherRatio("speed_ratio", ratio)
	switch mode {
	case "turbo":
		priceData.AddOtherRatio("speed_mode", 3)
	case "fast":
		priceData.AddOtherRatio("speed_mode", 2)
	case "draft":
		priceData.AddOtherRatio("speed_mode", 0.5)
	}
	return priceData
}
