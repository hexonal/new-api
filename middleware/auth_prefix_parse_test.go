package middleware

import "testing"

func TestExtractTokenKeyAndParts(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		wantKey  string
		wantPart []string
	}{
		{
			name:     "standard sk prefix",
			input:    "sk-abc123-extra",
			wantKey:  "abc123",
			wantPart: []string{"abc123", "extra"},
		},
		{
			name:     "customer sk prefix",
			input:    "customer-sk-xyz789-seg",
			wantKey:  "xyz789",
			wantPart: []string{"xyz789", "seg"},
		},
		{
			name:     "raw token",
			input:    "rawtoken",
			wantKey:  "rawtoken",
			wantPart: []string{"rawtoken"},
		},
		{
			name:     "empty token",
			input:    "",
			wantKey:  "",
			wantPart: []string{""},
		},
	}

	for _, tc := range cases {
		gotKey, gotParts := extractTokenKeyAndParts(tc.input)
		if gotKey != tc.wantKey {
			t.Fatalf("%s: key = %q, want %q", tc.name, gotKey, tc.wantKey)
		}
		if len(gotParts) != len(tc.wantPart) {
			t.Fatalf("%s: parts length = %d, want %d", tc.name, len(gotParts), len(tc.wantPart))
		}
		for i := range gotParts {
			if gotParts[i] != tc.wantPart[i] {
				t.Fatalf("%s: parts[%d] = %q, want %q", tc.name, i, gotParts[i], tc.wantPart[i])
			}
		}
	}
}
