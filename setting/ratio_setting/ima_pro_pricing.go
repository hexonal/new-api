package ratio_setting

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

// ============================================================================
// IMA Pro / BytePlus Seedance 2.0 Pricing
//
// Source of truth for variant ratios:
//   docs/byteplus-seedance-2-pricing.md §4.7 (30 keys total)
//
// Channel-fork integration (caller side):
//   service/task_billing.go:RecalculateTaskQuotaByTokens
//     → ImaProPricingApplies(channel.Type, originModel)  // gate
//     → CalculateQuota(...)                              // execute
//
// Pricing formula (token-based):
//   quota = tokens × variantRatio × completionRatio × groupRatio
//
// Variant key layout: "{family}-{novideo|withvideo}-{480p|720p|1080p}"
//   e.g. "seedance-2.0-novideo-480p", "ima-pro-fast-withvideo-720p"
//
// Fallback ladder (variant ratio not configured):
//   1. variantKey ratio (configured? use it)
//   2. base model ratio (e.g. "seedance-2.0")
//   3. default 37.5 (existing GetModelRatio behavior on miss)
// ============================================================================

// imaProModels is the exact allowlist of 6 model IDs that the IMA Pro
// channel (type 60 / 61) serves under token-based pricing (B7 hotfix:
// prefix matching has been replaced by this explicit allowlist so that
// no future model named e.g. "seedance-2.0-experimental" is accidentally
// included without a deliberate entry here).
//
// Sourced from Phase 1 audit of the 5 hardcoded sites:
//
//	relay_task.go:taskForcedTokenBillingModels,
//	sora/constants.go:IMAProModelList,
//	openai/constant.go:IMAProModelList,
//	relay/common/relay_utils.go:81,
//	service/task_deferred_billing.go.
//
// NOTE: Gemini image preview models share the same forced-token-billing
// list but DO NOT use IMA Pro variant pricing — they are explicitly
// rejected by ImaProPricingApplies (see below).
var imaProModels = map[string]struct{}{
	"ima-pro":              {},
	"ima-pro-fast":         {},
	"seedance-2.0":         {},
	"seedance-2.0-fast":    {},
	"seedance-2.0-cn":      {},
	"seedance-2.0-fast-cn": {},
}

// geminiImageModels are forced-token-billing models that are NOT subject
// to IMA Pro variant pricing (they have their own per-model ratio setup).
var geminiImageModels = map[string]struct{}{
	"gemini-3-pro-image-preview":     {},
	"gemini-3.1-flash-image-preview": {},
}

// CalculateQuotaParams gathers all inputs needed for IMA Pro variant pricing.
// Phase 4 / 4.5 hotfixes: since task.Properties.{Size,Duration,Metadata} do
// not exist, terminal callers pass the pre-resolved VariantKey directly
// (persisted at submit time in task.Properties.BillingSku — see §0.5).
// B5: Resolution / Metadata fields intentionally removed — the submit-time
// adaptor is the single source of truth for variantKey construction via
// ResolveVariantKey + HasVideoInput + NormalizeResolutionBucket.
// B3: GroupRatio MUST be >= 0 (zero is a valid free-group value; only
// negative values are rejected by CalculateQuota).
type CalculateQuotaParams struct {
	OriginModelName string  // "seedance-2.0", "ima-pro", etc.
	VariantKey      string  // pre-resolved variantKey, e.g. "seedance-2.0-novideo-720p"
	Tokens          int     // upstream usage.total_tokens
	GroupRatio      float64 // resolved group ratio (>= 0; 0 == free group)
	RequestPath     string  // optional, logged
}

// QuotaResult is returned by CalculateQuota and is used to populate log.Other.
type QuotaResult struct {
	Quota            int64
	BillingSku       string  // = VariantKey (consumed-model audit trail)
	VariantKey       string  // resolved variant lookup key
	InputMode        string  // "novideo" | "withvideo"
	ResolutionBucket string  // "480p" | "720p" | "1080p" | ""
	RatePerM         float64 // ratio × 2  (USD per 1M tokens)
	ModelRatio       float64 // ratio actually applied (variant or base)
	CompletionRatio  float64 // completion ratio actually applied
	UsedFallback     bool    // true if variant key missed, base used
}

// IsIMAProModel reports whether the model name is one of the 6 IMA Pro
// model IDs (case-insensitive, exact allowlist match).
// B7 hotfix: prefix matching replaced with map lookup.
// M1: the redundant second `if m == p` branch in the old loop is gone.
func IsIMAProModel(model string) bool {
	m := strings.ToLower(strings.TrimSpace(model))
	if m == "" {
		return false
	}
	if _, isGemini := geminiImageModels[m]; isGemini {
		return false
	}
	_, ok := imaProModels[m]
	return ok
}

// GetModelRatioExact bypasses GetModelRatio's SelfUseModeEnabled sentinel
// and CompactWildcard fallback, returning ONLY whether the exact variant
// key is configured in the ratio map. Required by B1 hotfix because
// GetModelRatio may report hit=true on a miss when SelfUseModeEnabled is
// true (see model_ratio.go:416: `return 37.5, operation_setting.SelfUseModeEnabled, name`).
// Same package, so direct map access is permitted.
func GetModelRatioExact(name string) (float64, bool) {
	name = FormatMatchingModelName(name)
	return modelRatioMap.Get(name)
}

// ImaProPricingApplies is the channel-fork gate.
// Returns true ONLY when the channel is IMA Pro (60/61) AND the model is
// one of the 6 IMA Pro families. Gemini image models are explicitly excluded
// even though they share the channel.
func ImaProPricingApplies(channelType int, model string) bool {
	const (
		imaProChannelType  = 60
		imaProOverseasType = 61
	)
	if channelType != imaProChannelType && channelType != imaProOverseasType {
		return false
	}
	return IsIMAProModel(model)
}

// HasVideoInput inspects task metadata for video-bearing keys. Per
// byteplus-seedance-2-pricing.md §3.3, presence of a non-empty video URL
// triggers the "Video included in input" tier. Image inputs DO NOT count.
//
// B2 hotfix: accept all 4 keys actually consumed by upstream
// (verified sora/adaptor.go:553-556 and task_input_type.go:9-12):
//
//	reference_video_urls (array), video_urls (array),
//	reference_video_url (string), video_url (string).
//
// Empty strings / empty arrays / arrays of only empty strings do NOT count.
//
// C1 hotfix (Round-2): upstream hasTaskResourceURL (task_input_type.go:83-107)
// also accepts object-form URLs — `{"url":"https://..."}` and arrays of such
// objects. HasVideoInput was missing those branches, which would under-bill
// any request that wraps the URL in an object. Now every element branch
// routes through itemHasValidURL, mirroring the upstream recursive shape.
func HasVideoInput(metadata map[string]interface{}) bool {
	if metadata == nil {
		return false
	}
	keys := []string{"reference_video_urls", "video_urls", "reference_video_url", "video_url"}
	for _, key := range keys {
		v, ok := metadata[key]
		if !ok {
			continue
		}
		if itemHasValidURL(v) {
			return true
		}
	}
	return false
}

// itemHasValidURL is the recursive helper mirroring upstream
// relay/common/task_input_type.go:hasTaskResourceURL. Recognizes:
//   - string (non-empty after trim)
//   - []string / []interface{} (any non-empty element)
//   - map[string]interface{} with key "url" → recurse
//   - []map[string]interface{} — any element whose "url" key is non-empty.
func itemHasValidURL(v interface{}) bool {
	switch val := v.(type) {
	case string:
		return strings.TrimSpace(val) != ""
	case map[string]interface{}:
		if u, ok := val["url"]; ok {
			return itemHasValidURL(u)
		}
		return false
	case []interface{}:
		for _, item := range val {
			if itemHasValidURL(item) {
				return true
			}
		}
	case []string:
		for _, s := range val {
			if strings.TrimSpace(s) != "" {
				return true
			}
		}
	case []map[string]interface{}:
		for _, m := range val {
			if itemHasValidURL(m) {
				return true
			}
		}
	}
	return false
}

type IMAProResolutionResult struct {
	Resolution  string
	Source      string
	AspectRatio string
}

const (
	IMAProResolutionSourceRequestSize        = "request_size"
	IMAProResolutionSourceMetadataSize       = "metadata_size"
	IMAProResolutionSourceMetadataResolution = "metadata_resolution"
	IMAProResolutionSourceDefault            = "default"
)

// ResolveIMAProResolution is the single normalization point for IMA Pro
// output resolution. Request size wins, then metadata.size, then
// metadata.resolution, then the adaptor default of 720p.
func ResolveIMAProResolution(requestSize, metadataSize, metadataResolution string) IMAProResolutionResult {
	if resolution, aspectRatio, ok := normalizeIMAProSize(requestSize); ok {
		return IMAProResolutionResult{
			Resolution:  resolution,
			Source:      IMAProResolutionSourceRequestSize,
			AspectRatio: aspectRatio,
		}
	}
	if resolution, aspectRatio, ok := normalizeIMAProSize(metadataSize); ok {
		return IMAProResolutionResult{
			Resolution:  resolution,
			Source:      IMAProResolutionSourceMetadataSize,
			AspectRatio: aspectRatio,
		}
	}
	if resolution := normalizeIMAProResolutionLabel(metadataResolution); resolution != "" {
		return IMAProResolutionResult{
			Resolution:  resolution,
			Source:      IMAProResolutionSourceMetadataResolution,
			AspectRatio: "16:9",
		}
	}
	return IMAProResolutionResult{
		Resolution:  "720p",
		Source:      IMAProResolutionSourceDefault,
		AspectRatio: "16:9",
	}
}

// NormalizeResolutionBucket folds (size, resolution) into one of:
//
//	"480p"  — 480p output
//	"720p"  — 720p output, also the default when no size/resolution is supplied
//	"1080p" — 1080p output
func NormalizeResolutionBucket(size, resolution string) string {
	return ResolveIMAProResolution(size, "", resolution).Resolution
}

func normalizeIMAProResolutionLabel(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "480p":
		return "480p"
	case "720p":
		return "720p"
	case "1080p":
		return "1080p"
	default:
		return ""
	}
}

func normalizeIMAProSize(size string) (resolution string, aspectRatio string, ok bool) {
	s := strings.ToLower(strings.TrimSpace(size))
	if resolution := normalizeIMAProResolutionLabel(s); resolution != "" {
		return resolution, "16:9", true
	}
	if s == "" {
		return "", "", false
	}
	s = strings.ReplaceAll(s, "×", "x")
	s = strings.ReplaceAll(s, "*", "x")
	parts := strings.Split(s, "x")
	if len(parts) != 2 {
		return "", "", false
	}
	w, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
	h, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return "", "", false
	}
	longSide, shortSide := w, h
	if shortSide > longSide {
		longSide, shortSide = shortSide, longSide
	}
	aspectRatio = ratioFromDimensions(w, h)
	switch {
	case longSide >= 1920 && shortSide >= 1080:
		return "1080p", aspectRatio, true
	case longSide >= 1280 && shortSide >= 720 && shortSide < 1080:
		return "720p", aspectRatio, true
	case longSide >= 854 && shortSide >= 480 && shortSide < 720:
		return "480p", aspectRatio, true
	default:
		return "", "", false
	}
}

func ratioFromDimensions(w, h int) string {
	if w <= 0 || h <= 0 {
		return "16:9"
	}
	g := gcdInt(w, h)
	if g <= 0 {
		return "16:9"
	}
	return fmt.Sprintf("%d:%d", w/g, h/g)
}

func gcdInt(a int, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	if a < 0 {
		return -a
	}
	return a
}

// ResolveVariantKey composes the variant key from the model + input mode
// + resolution bucket. If bucket is empty, returns the base model name
// (caller must handle fallback via base ratio lookup).
func ResolveVariantKey(model, inputMode, bucket string) string {
	m := strings.ToLower(strings.TrimSpace(model))
	if m == "" {
		return ""
	}
	if bucket == "" || inputMode == "" {
		return m
	}
	return fmt.Sprintf("%s-%s-%s", m, inputMode, bucket)
}

// ValidateIMAProRequest enforces upstream constraints early (before billing).
// Currently: fast variants do not support 1080p output (BytePlus rule).
func ValidateIMAProRequest(model, bucket string) error {
	if bucket != "1080p" {
		return nil
	}
	m := strings.ToLower(strings.TrimSpace(model))
	// "fast" appears either as suffix "-fast" (ima-pro-fast) or
	// embedded "-fast-" (seedance-2.0-fast-cn).
	if strings.Contains(m, "-fast") {
		return fmt.Errorf("model %q does not support 1080p output", model)
	}
	return nil
}

// CalculateQuota is the single entry point invoked by the channel-fork in
// service/task_billing.go. Signature is intentionally context-aware to allow
// future tracing/cancellation but currently does not block on context.
func CalculateQuota(ctx context.Context, p CalculateQuotaParams) (*QuotaResult, error) {
	_ = ctx // reserved for future tracing
	if !IsIMAProModel(p.OriginModelName) {
		return nil, fmt.Errorf("not an ima pro model: %q", p.OriginModelName)
	}
	if p.Tokens <= 0 {
		return nil, fmt.Errorf("tokens must be > 0, got %d", p.Tokens)
	}
	// B3 hotfix: groupRatio==0 is a legitimate value (free group).
	// Only reject negative ratios; preserve zero verbatim.
	if p.GroupRatio < 0 {
		return nil, fmt.Errorf("invalid group ratio: %f", p.GroupRatio)
	}
	groupRatio := p.GroupRatio

	// Use caller-supplied VariantKey (submit-time resolution persisted in
	// task.Properties.BillingSku — see §0.5). If missing (old task / back-
	// compat), fall through to base-model ratio directly.
	variantKey := strings.ToLower(strings.TrimSpace(p.VariantKey))
	baseKey := strings.ToLower(strings.TrimSpace(p.OriginModelName))
	if variantKey == "" {
		variantKey = baseKey
	}

	// 1) Try variant ratio first. B1 hotfix: use GetModelRatioExact (same
	//    package, reads modelRatioMap.Get directly) instead of GetModelRatio,
	//    because GetModelRatio returns hit=true on miss when
	//    operation_setting.SelfUseModeEnabled=true (see model_ratio.go:416).
	//    That would trick us into billing at the 37.5 sentinel and never
	//    falling back to the base ratio.
	ratio, hit := GetModelRatioExact(variantKey)
	usedFallback := false
	appliedKey := variantKey
	inputMode := "" // parsed from variantKey suffix for audit, best-effort
	bucket := ""
	if parts := strings.Split(variantKey, "-"); len(parts) >= 3 {
		last := parts[len(parts)-1]
		prev := parts[len(parts)-2]
		if last == "480p" || last == "720p" || last == "1080p" {
			bucket = last
			if prev == "novideo" || prev == "withvideo" {
				inputMode = prev
			}
		}
	}
	if !hit {
		// 2) Variant unconfigured → fall back to base ratio via the public
		//    GetModelRatio, which preserves the existing 37.5 default on
		//    full miss. The fallback path intentionally honors
		//    SelfUseModeEnabled semantics for parity with legacy billing.
		usedFallback = true
		appliedKey = baseKey
		ratio, _, _ = GetModelRatio(appliedKey)
	}

	// I1 hotfix (Round-2): quota formula MUST match architecture §S3 E5
	// contract — `actualQuota = totalTokens × modelRatio × groupRatio`.
	// Earlier draft multiplied in completionRatio as well, which diverged
	// from the generic service/task_billing.go:839 pre-token-usage branch
	// and over-billed by the completion multiplier whenever the caller
	// handed us an already-aggregated totalTokens (no prompt/completion
	// split). completionRatio is retained in QuotaResult for audit only;
	// real per-type weighting happens in the structured usage branch in
	// calculateTaskQuotaByTokens, not here.
	completionRatio := GetCompletionRatio(appliedKey) // audit only; not used in quota
	if completionRatio <= 0 {
		completionRatio = 1.0
	}

	weighted := float64(p.Tokens) * ratio * groupRatio
	if weighted < 0 {
		weighted = 0
	}
	quota := int64(weighted)

	return &QuotaResult{
		Quota:            quota,
		BillingSku:       variantKey,
		VariantKey:       variantKey,
		InputMode:        inputMode,
		ResolutionBucket: bucket,
		RatePerM:         ratio * 2.0, // ratio→USD/1M conversion (1.0 == $2/M)
		ModelRatio:       ratio,
		CompletionRatio:  completionRatio,
		UsedFallback:     usedFallback,
	}, nil
}
