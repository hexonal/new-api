package ratio_setting

import (
	"context"
	"testing"
)

// ---------- IsIMAProModel ----------

func TestIsIMAProModel(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"ima-pro", true},
		{"ima-pro-fast", true},
		{"IMA-PRO", true},                      // case insensitive
		{"  seedance-2.0  ", true},             // trim
		{"seedance-2.0", true},
		{"seedance-2.0-fast", true},
		{"seedance-2.0-cn", true},
		{"seedance-2.0-fast-cn", true},
		{"seedance-3.0", false},                // wrong family
		{"seedance-2.0-experimental", false},   // B7: allowlist rejects unknown suffixes
		{"ima-pro-v2", false},                  // B7: allowlist rejects unknown suffixes
		{"gemini-3-pro-image-preview", false},  // explicitly excluded
		{"gemini-3.1-flash-image-preview", false},
		{"gpt-4", false},
		{"", false},
	}
	for _, c := range cases {
		if got := IsIMAProModel(c.in); got != c.want {
			t.Errorf("IsIMAProModel(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

// ---------- ImaProPricingApplies ----------

func TestImaProPricingApplies(t *testing.T) {
	cases := []struct {
		channel int
		model   string
		want    bool
	}{
		{60, "ima-pro", true},
		{61, "seedance-2.0", true},
		{60, "gemini-3-pro-image-preview", false}, // Gemini excluded
		{60, "gpt-4", false},                      // model mismatch
		{45, "seedance-2.0", false},               // wrong channel
		{0, "ima-pro", false},                     // no channel
	}
	for _, c := range cases {
		if got := ImaProPricingApplies(c.channel, c.model); got != c.want {
			t.Errorf("ImaProPricingApplies(%d, %q) = %v, want %v",
				c.channel, c.model, got, c.want)
		}
	}
}

// ---------- HasVideoInput ----------

func TestHasVideoInput(t *testing.T) {
	if HasVideoInput(nil) {
		t.Error("nil → false")
	}
	if HasVideoInput(map[string]interface{}{}) {
		t.Error("empty → false")
	}
	if HasVideoInput(map[string]interface{}{"reference_video_urls": []interface{}{}}) {
		t.Error("empty array → false")
	}
	if !HasVideoInput(map[string]interface{}{"reference_video_urls": []interface{}{"https://x"}}) {
		t.Error("non-empty array → true")
	}
	if !HasVideoInput(map[string]interface{}{"reference_video_urls": []string{"x"}}) {
		t.Error("string slice supported")
	}
	// B2: singular string variants
	if !HasVideoInput(map[string]interface{}{"video_url": "https://x/v.mp4"}) {
		t.Error("video_url string must count")
	}
	if !HasVideoInput(map[string]interface{}{"reference_video_url": "https://x/v.mp4"}) {
		t.Error("reference_video_url string must count")
	}
	if !HasVideoInput(map[string]interface{}{"video_urls": []interface{}{"https://x/v.mp4"}}) {
		t.Error("video_urls array must count")
	}
	// B2: empty strings / whitespace-only values must not trigger
	if HasVideoInput(map[string]interface{}{"video_url": ""}) {
		t.Error("empty video_url must be false")
	}
	if HasVideoInput(map[string]interface{}{"video_url": "   "}) {
		t.Error("whitespace video_url must be false")
	}
	if HasVideoInput(map[string]interface{}{"video_urls": []interface{}{"", "  "}}) {
		t.Error("array of only empty strings must be false")
	}
	// images don't count
	if HasVideoInput(map[string]interface{}{"images": []interface{}{"x"}}) {
		t.Error("images alone must be false (per BytePlus rule §3.3)")
	}
	// C1 hotfix: object-form URL — `{"url": "..."}` — must count
	if !HasVideoInput(map[string]interface{}{
		"reference_video_urls": []interface{}{
			map[string]interface{}{"url": "https://x/v.mp4"},
		},
	}) {
		t.Error("array of {url:...} objects must count (upstream hasTaskResourceURL parity)")
	}
	if !HasVideoInput(map[string]interface{}{
		"video_url": map[string]interface{}{"url": "https://x/v.mp4"},
	}) {
		t.Error("single {url:...} object under video_url must count")
	}
	// C1: empty object-URL must not count
	if HasVideoInput(map[string]interface{}{
		"video_url": map[string]interface{}{"url": ""},
	}) {
		t.Error("{url:\"\"} must be false")
	}
}

// ---------- NormalizeResolutionBucket ----------

func TestNormalizeResolutionBucket(t *testing.T) {
	cases := []struct {
		size, resolution, want string
	}{
		// resolution wins when present
		{"", "480p", "720p"}, // 480p folds into 720p bucket (BytePlus §4.1)
		{"", "720p", "720p"},
		{"", "1080p", "1080p"},
		{"", "  720P  ", "720p"}, // case insensitive, trim
		// size fallback
		{"1280x720", "", "720p"},
		{"720x1280", "", "720p"}, // portrait
		{"1920x1080", "", "1080p"},
		{"1080x1920", "", "1080p"},
		{"854x480", "", "720p"}, // 480p folds in
		// M4 hotfix: non-standard aspect ratios whose short side is
		// below the 1080 threshold do NOT get promoted to 1080p.
		// 1792x1024 → short=1024 < 1080 → "720p" bucket.
		{"1792x1024", "", "720p"},
		{"1024x1792", "", "720p"},
		// unresolved
		{"", "", ""},
		{"100x100", "", ""},
		{"abcxdef", "", ""},
		// Unicode "×" + B8: asterisk separator
		{"1280×720", "", "720p"},
		{"1280*720", "", "720p"},
		{"1920*1080", "", "1080p"},
	}
	for _, c := range cases {
		if got := NormalizeResolutionBucket(c.size, c.resolution); got != c.want {
			t.Errorf("NormalizeResolutionBucket(%q, %q) = %q, want %q",
				c.size, c.resolution, got, c.want)
		}
	}
}

// ---------- ResolveVariantKey ----------

func TestResolveVariantKey(t *testing.T) {
	cases := []struct {
		model, mode, bucket, want string
	}{
		{"seedance-2.0", "novideo", "720p", "seedance-2.0-novideo-720p"},
		{"SEEDANCE-2.0", "withvideo", "1080p", "seedance-2.0-withvideo-1080p"},
		{"ima-pro-fast", "withvideo", "720p", "ima-pro-fast-withvideo-720p"},
		// missing bucket → return base model
		{"seedance-2.0", "novideo", "", "seedance-2.0"},
		// missing mode → return base model
		{"seedance-2.0", "", "720p", "seedance-2.0"},
		// empty model
		{"", "novideo", "720p", ""},
	}
	for _, c := range cases {
		if got := ResolveVariantKey(c.model, c.mode, c.bucket); got != c.want {
			t.Errorf("ResolveVariantKey(%q, %q, %q) = %q, want %q",
				c.model, c.mode, c.bucket, got, c.want)
		}
	}
}

// ---------- ValidateIMAProRequest ----------

func TestValidateIMAProRequest(t *testing.T) {
	// Allowed: anything not 1080p, OR non-fast at 1080p
	if err := ValidateIMAProRequest("seedance-2.0", "1080p"); err != nil {
		t.Errorf("Pro+1080p must be allowed, got %v", err)
	}
	if err := ValidateIMAProRequest("ima-pro", "1080p"); err != nil {
		t.Errorf("ima-pro+1080p must be allowed, got %v", err)
	}
	if err := ValidateIMAProRequest("seedance-2.0-fast", "720p"); err != nil {
		t.Errorf("fast+720p must be allowed, got %v", err)
	}
	if err := ValidateIMAProRequest("ima-pro-fast", ""); err != nil {
		t.Errorf("fast with empty bucket must be allowed (no constraint), got %v", err)
	}
	// Rejected: any *fast* variant at 1080p
	if err := ValidateIMAProRequest("ima-pro-fast", "1080p"); err == nil {
		t.Error("ima-pro-fast+1080p must be rejected")
	}
	if err := ValidateIMAProRequest("seedance-2.0-fast", "1080p"); err == nil {
		t.Error("seedance-2.0-fast+1080p must be rejected")
	}
	if err := ValidateIMAProRequest("seedance-2.0-fast-cn", "1080p"); err == nil {
		t.Error("seedance-2.0-fast-cn+1080p must be rejected")
	}
}

// ---------- CalculateQuota: 18-variant table-driven ----------

// installVariantRatios swaps the in-process ratio map for a deterministic
// fixture covering all 18 keys. Restores the original snapshot on cleanup.
//
// B5 hotfix: types.RWMap exposes no Delete method
// (see types/rw_map.go:27-90: Get/Set/AddAll/Clear/ReadAll/Len/AnyKey only).
// The correct restore pattern is snapshot via ReadAll → Clear → AddAll(fixture)
// → on cleanup, Clear → AddAll(snapshot).
func installVariantRatios(t *testing.T) {
	t.Helper()
	fixture := map[string]float64{
		"seedance-2.0-novideo-720p":           3.50,
		"seedance-2.0-novideo-1080p":          3.85,
		"seedance-2.0-withvideo-720p":         2.15,
		"seedance-2.0-withvideo-1080p":        2.35,
		"seedance-2.0-fast-novideo-720p":      2.80,
		"seedance-2.0-fast-withvideo-720p":    1.65,
		"seedance-2.0-cn-novideo-720p":        3.50,
		"seedance-2.0-cn-novideo-1080p":       3.85,
		"seedance-2.0-cn-withvideo-720p":      2.15,
		"seedance-2.0-cn-withvideo-1080p":     2.35,
		"seedance-2.0-fast-cn-novideo-720p":   2.80,
		"seedance-2.0-fast-cn-withvideo-720p": 1.65,
		"ima-pro-novideo-720p":                3.50,
		"ima-pro-novideo-1080p":               3.85,
		"ima-pro-withvideo-720p":              2.15,
		"ima-pro-withvideo-1080p":             2.35,
		"ima-pro-fast-novideo-720p":           2.80,
		"ima-pro-fast-withvideo-720p":         1.65,
		// Base fallbacks (for fallback test below)
		"ima-pro": 3.0,
	}
	// M1 hotfix (Round-2): completionRatioMap must also snapshot/restore —
	// CalculateQuota audits GetCompletionRatio(appliedKey), which reads
	// completionRatioMap. Without snapshotting that map, tests leak state
	// into each other. Mirrors real-world withTempRatios pattern at
	// service/task_billing_test.go:1444-1462 (JSON round-trip there,
	// ReadAll/Clear/AddAll here since we already have direct map access
	// inside the ratio_setting package).
	modelSnapshot := modelRatioMap.ReadAll() // deep-enough copy (map of primitives)
	completionSnapshot := completionRatioMap.ReadAll()
	modelRatioMap.Clear()
	completionRatioMap.Clear()
	modelRatioMap.AddAll(modelSnapshot)       // restore originals
	completionRatioMap.AddAll(completionSnapshot)
	modelRatioMap.AddAll(fixture) // layer test fixture on top
	t.Cleanup(func() {
		modelRatioMap.Clear()
		completionRatioMap.Clear()
		modelRatioMap.AddAll(modelSnapshot)
		completionRatioMap.AddAll(completionSnapshot)
	})
}

// installBaseRatio sets a single base-model ratio and restores the snapshot
// on cleanup. Used by TestCalculateQuota_FallbackToBase where we want the
// variant keys absent.
//
// M1 hotfix (Round-2): snapshot/restore BOTH modelRatioMap and
// completionRatioMap so completionRatio state does not leak across tests.
func installBaseRatio(t *testing.T, model string, ratio float64) {
	t.Helper()
	modelSnapshot := modelRatioMap.ReadAll()
	completionSnapshot := completionRatioMap.ReadAll()
	modelRatioMap.Clear()
	completionRatioMap.Clear()
	modelRatioMap.AddAll(modelSnapshot)
	completionRatioMap.AddAll(completionSnapshot)
	modelRatioMap.Set(model, ratio)
	t.Cleanup(func() {
		modelRatioMap.Clear()
		completionRatioMap.Clear()
		modelRatioMap.AddAll(modelSnapshot)
		completionRatioMap.AddAll(completionSnapshot)
	})
}

func TestCalculateQuota_AllVariants(t *testing.T) {
	installVariantRatios(t)

	type row struct {
		model     string
		mode      string // "novideo"/"withvideo"
		bucket    string // "720p"/"1080p"
		wantRatio float64
	}
	rows := []row{
		{"seedance-2.0", "novideo", "720p", 3.50},
		{"seedance-2.0", "novideo", "1080p", 3.85},
		{"seedance-2.0", "withvideo", "720p", 2.15},
		{"seedance-2.0", "withvideo", "1080p", 2.35},

		{"seedance-2.0-fast", "novideo", "720p", 2.80},
		{"seedance-2.0-fast", "withvideo", "720p", 1.65},

		{"seedance-2.0-cn", "novideo", "720p", 3.50},
		{"seedance-2.0-cn", "novideo", "1080p", 3.85},
		{"seedance-2.0-cn", "withvideo", "720p", 2.15},
		{"seedance-2.0-cn", "withvideo", "1080p", 2.35},

		{"seedance-2.0-fast-cn", "novideo", "720p", 2.80},
		{"seedance-2.0-fast-cn", "withvideo", "720p", 1.65},

		{"ima-pro", "novideo", "720p", 3.50},
		{"ima-pro", "novideo", "1080p", 3.85},
		{"ima-pro", "withvideo", "720p", 2.15},
		{"ima-pro", "withvideo", "1080p", 2.35},

		{"ima-pro-fast", "novideo", "720p", 2.80},
		{"ima-pro-fast", "withvideo", "720p", 1.65},
	}

	const tokens = 1_000_000
	const groupRatio = 1.0

	for _, r := range rows {
		// B5 hotfix: CalculateQuotaParams no longer carries Resolution /
		// Metadata (submit-time resolution is persisted in Properties.BillingSku;
		// see §0.5). Tests must supply the pre-resolved VariantKey directly.
		variantKey := ResolveVariantKey(r.model, r.mode, r.bucket)
		params := CalculateQuotaParams{
			OriginModelName: r.model,
			VariantKey:      variantKey,
			Tokens:          tokens,
			GroupRatio:      groupRatio,
		}
		res, err := CalculateQuota(context.Background(), params)
		if err != nil {
			t.Fatalf("[%s/%s/%s] unexpected error: %v", r.model, r.mode, r.bucket, err)
		}
		wantQuota := int64(float64(tokens) * r.wantRatio * 1.0 * groupRatio)
		if res.Quota != wantQuota {
			t.Errorf("[%s/%s/%s] quota = %d, want %d (ratio %.4f)",
				r.model, r.mode, r.bucket, res.Quota, wantQuota, r.wantRatio)
		}
		wantKey := r.model + "-" + r.mode + "-" + r.bucket
		if res.VariantKey != wantKey {
			t.Errorf("[%s/%s/%s] variantKey = %q, want %q",
				r.model, r.mode, r.bucket, res.VariantKey, wantKey)
		}
		if res.UsedFallback {
			t.Errorf("[%s/%s/%s] should NOT use fallback (variant configured)",
				r.model, r.mode, r.bucket)
		}
	}
}

// ---------- CalculateQuota: variant miss falls back to base ratio ----------

func TestCalculateQuota_FallbackToBase(t *testing.T) {
	// Only base "ima-pro" ratio is installed; variant key is absent so
	// GetModelRatioExact returns hit=false and CalculateQuota falls back.
	installBaseRatio(t, "ima-pro", 3.0)

	res, err := CalculateQuota(context.Background(), CalculateQuotaParams{
		OriginModelName: "ima-pro",
		VariantKey:      "ima-pro-novideo-720p", // variant key, but not configured
		Tokens:          1000,
		GroupRatio:      1.0,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.UsedFallback {
		t.Error("expected UsedFallback=true when variant key missing")
	}
	if res.ModelRatio != 3.0 {
		t.Errorf("expected base ratio 3.0, got %.4f", res.ModelRatio)
	}
	wantQuota := int64(1000 * 3.0 * 1.0 * 1.0)
	if res.Quota != wantQuota {
		t.Errorf("quota = %d, want %d", res.Quota, wantQuota)
	}
}

// ---------- CalculateQuota: not an IMA Pro model rejected ----------

func TestCalculateQuota_NonImaProRejected(t *testing.T) {
	_, err := CalculateQuota(context.Background(), CalculateQuotaParams{
		OriginModelName: "gpt-4",
		Tokens:          100,
		GroupRatio:      1.0,
	})
	if err == nil {
		t.Error("expected error for non-ima-pro model")
	}
}

// ---------- CalculateQuota: zero tokens rejected ----------

func TestCalculateQuota_ZeroTokens(t *testing.T) {
	_, err := CalculateQuota(context.Background(), CalculateQuotaParams{
		OriginModelName: "ima-pro",
		Tokens:          0,
		GroupRatio:      1.0,
	})
	if err == nil {
		t.Error("expected error for tokens=0")
	}
}

// ---------- novideo/withvideo switching driven by metadata ----------

func TestCalculateQuota_NoVideoVsWithVideo(t *testing.T) {
	installVariantRatios(t)

	// B5 hotfix: caller resolves the variantKey at submit-time (HasVideoInput
	// + NormalizeResolutionBucket live in the sora adaptor) — the pricing
	// module consumes the pre-resolved key.
	noVid, _ := CalculateQuota(context.Background(), CalculateQuotaParams{
		OriginModelName: "seedance-2.0",
		VariantKey:      "seedance-2.0-novideo-720p",
		Tokens:          1000,
		GroupRatio:      1.0,
	})
	withVid, _ := CalculateQuota(context.Background(), CalculateQuotaParams{
		OriginModelName: "seedance-2.0",
		VariantKey:      "seedance-2.0-withvideo-720p",
		Tokens:          1000,
		GroupRatio:      1.0,
	})
	if noVid.InputMode != "novideo" || withVid.InputMode != "withvideo" {
		t.Fatalf("input modes: noVid=%s withVid=%s", noVid.InputMode, withVid.InputMode)
	}
	if !(withVid.Quota < noVid.Quota) {
		t.Errorf("withvideo (2.15) should be cheaper than novideo (3.50): %d vs %d",
			withVid.Quota, noVid.Quota)
	}
}
