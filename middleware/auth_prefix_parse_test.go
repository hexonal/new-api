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
			name:     "standard sk prefix strips sk-",
			input:    "sk-abc123-extra",
			wantKey:  "abc123-extra",
			wantPart: []string{"abc123-extra"},
		},
		{
			name:     "no-prefix token kept as-is",
			input:    "ima_abc123",
			wantKey:  "ima_abc123",
			wantPart: []string{"ima_abc123"},
		},
		{
			name:     "raw token without any prefix",
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
		{
			name:     "no-prefix token with underscores and digits",
			input:    "org_test_key_99",
			wantKey:  "org_test_key_99",
			wantPart: []string{"org_test_key_99"},
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

func TestSplitTokenKeyAndSuffix(t *testing.T) {
	cases := []struct {
		name      string
		input     string
		wantKey   string
		wantParts []string
		wantOK    bool
	}{
		{
			name:      "token with explicit suffix",
			input:     "abc-def-16",
			wantKey:   "abc-def",
			wantParts: []string{"abc-def", "16"},
			wantOK:    true,
		},
		{
			name:   "token without suffix",
			input:  "abcdef",
			wantOK: false,
		},
		{
			name:   "leading hyphen invalid",
			input:  "-abcdef",
			wantOK: false,
		},
		{
			name:   "trailing hyphen invalid",
			input:  "abcdef-",
			wantOK: false,
		},
	}

	for _, tc := range cases {
		gotKey, gotParts, gotOK := splitTokenKeyAndSuffix(tc.input)
		if gotOK != tc.wantOK {
			t.Fatalf("%s: ok = %v, want %v", tc.name, gotOK, tc.wantOK)
		}
		if !gotOK {
			continue
		}
		if gotKey != tc.wantKey {
			t.Fatalf("%s: key = %q, want %q", tc.name, gotKey, tc.wantKey)
		}
		if len(gotParts) != len(tc.wantParts) {
			t.Fatalf("%s: parts length = %d, want %d", tc.name, len(gotParts), len(tc.wantParts))
		}
		for i := range gotParts {
			if gotParts[i] != tc.wantParts[i] {
				t.Fatalf("%s: parts[%d] = %q, want %q", tc.name, i, gotParts[i], tc.wantParts[i])
			}
		}
	}
}

func TestDetectTokenAuthPrefix(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{name: "sk prefix", input: "sk-abc123", want: "sk-"},
		{name: "raw token", input: "ima_abc123", want: ""},
		{name: "empty", input: "", want: ""},
	}

	for _, tc := range cases {
		got := detectTokenAuthPrefix(tc.input)
		if got != tc.want {
			t.Fatalf("%s: prefix = %q, want %q", tc.name, got, tc.want)
		}
	}
}
