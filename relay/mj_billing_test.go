package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/types"
)

func TestParseMjSpeedModeAndRatio(t *testing.T) {
	tests := []struct {
		name      string
		prompt    string
		wantMode  string
		wantRatio float64
	}{
		{name: "normal", prompt: "a cat --v 7", wantMode: "normal", wantRatio: 1},
		{name: "fast", prompt: "a cat --fast --v 7", wantMode: "fast", wantRatio: 2},
		{name: "turbo", prompt: "a cat --turbo --v 7", wantMode: "turbo", wantRatio: 2},
		{name: "draft", prompt: "a cat --draft --v 7", wantMode: "draft", wantRatio: 0.5},
		{name: "ignore substring", prompt: "a cat --faster --v 7", wantMode: "normal", wantRatio: 1},
		{name: "prefer turbo over fast", prompt: "a cat --fast --turbo --v 7", wantMode: "turbo", wantRatio: 2},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mode, ratio := parseMjSpeedModeAndRatio(tc.prompt)
			if mode != tc.wantMode {
				t.Fatalf("mode mismatch: got %q want %q", mode, tc.wantMode)
			}
			if ratio != tc.wantRatio {
				t.Fatalf("ratio mismatch: got %v want %v", ratio, tc.wantRatio)
			}
		})
	}
}

func TestApplyMjSpeedRatioForImagine(t *testing.T) {
	base := types.PriceData{ModelPrice: 0.1, Quota: 50000}

	fast := applyMjSpeedRatioForImagine(constant.MjActionImagine, "x --fast", base)
	if fast.Quota != 100000 {
		t.Fatalf("fast quota mismatch: got %d want %d", fast.Quota, 100000)
	}

	draft := applyMjSpeedRatioForImagine(constant.MjActionImagine, "x --draft", base)
	if draft.Quota != 25000 {
		t.Fatalf("draft quota mismatch: got %d want %d", draft.Quota, 25000)
	}

	unchanged := applyMjSpeedRatioForImagine(constant.MjActionUpscale, "x --turbo", base)
	if unchanged.Quota != 50000 {
		t.Fatalf("non-imagine should keep quota: got %d want %d", unchanged.Quota, 50000)
	}
}
