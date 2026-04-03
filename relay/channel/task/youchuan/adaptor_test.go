package youchuan

import "testing"

func TestParseSpeedModeAndRatio(t *testing.T) {
	tests := []struct {
		name       string
		prompt     string
		wantMode   string
		wantRatio  float64
	}{
		{name: "empty prompt", prompt: "", wantMode: "normal", wantRatio: 1},
		{name: "fast mode", prompt: "a cat --fast", wantMode: "fast", wantRatio: 2},
		{name: "turbo mode", prompt: "--turbo cinematic", wantMode: "turbo", wantRatio: 2},
		{name: "draft mode", prompt: "night city --draft", wantMode: "draft", wantRatio: 0.5},
		{name: "case insensitive", prompt: "portrait --FAST", wantMode: "fast", wantRatio: 2},
		{name: "ignore substring faster", prompt: "portrait --faster", wantMode: "normal", wantRatio: 1},
		{name: "ignore glued token", prompt: "portraitx--fast", wantMode: "normal", wantRatio: 1},
		{name: "prefer turbo when both", prompt: "a --fast b --turbo", wantMode: "turbo", wantRatio: 2},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mode, ratio := parseSpeedModeAndRatio(tc.prompt)
			if mode != tc.wantMode {
				t.Fatalf("mode mismatch: got %q want %q", mode, tc.wantMode)
			}
			if ratio != tc.wantRatio {
				t.Fatalf("ratio mismatch: got %v want %v", ratio, tc.wantRatio)
			}
		})
	}
}
