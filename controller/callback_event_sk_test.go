package controller

import (
	"strings"
	"testing"
)

func TestNormalizeSKKeepsCustomPrefixes(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{name: "no-prefix token kept as-is", input: "ima_abc123", want: "ima_abc123"},
		{name: "already sk", input: "sk-abc123", want: "sk-abc123"},
		{name: "plain key no prefix", input: "abc123", want: "abc123"},
		{name: "empty", input: "", want: ""},
	}

	for _, tc := range cases {
		got := normalizeSK(tc.input)
		if got != tc.want {
			t.Fatalf("%s: got %q want %q", tc.name, got, tc.want)
		}
	}
}

func TestBuildMaskedSKKeepsPrefix(t *testing.T) {
	cases := []struct {
		name        string
		input       string
		wantPrefix  string
		wantContain string
	}{
		{name: "sk prefix", input: "sk-abcdefgh12345678", wantPrefix: "sk-", wantContain: "***"},
		{name: "no-prefix long token", input: "ima_abcdefgh12345678", wantPrefix: "", wantContain: "***"},
		{name: "no-prefix short token", input: "ima_abc", wantPrefix: "", wantContain: "ima_abc"},
	}

	for _, tc := range cases {
		got := buildMaskedSK(tc.input)
		if len(got) == 0 {
			t.Fatalf("%s: empty result", tc.name)
		}
		if tc.wantPrefix != "" && got[:len(tc.wantPrefix)] != tc.wantPrefix {
			t.Fatalf("%s: prefix mismatch got %q want prefix %q", tc.name, got, tc.wantPrefix)
		}
		if !strings.Contains(got, tc.wantContain) {
			t.Fatalf("%s: expected %q in %q", tc.name, tc.wantContain, got)
		}
	}
}

func TestSplitSKPrefixAndKey(t *testing.T) {
	cases := []struct {
		name       string
		input      string
		wantPrefix string
		wantKey    string
	}{
		{name: "sk prefix", input: "sk-abc123", wantPrefix: "sk-", wantKey: "abc123"},
		{name: "no prefix", input: "ima_abc123", wantPrefix: "", wantKey: "ima_abc123"},
		{name: "empty", input: "", wantPrefix: "", wantKey: ""},
	}

	for _, tc := range cases {
		gotPrefix, gotKey := splitSKPrefixAndKey(tc.input)
		if gotPrefix != tc.wantPrefix || gotKey != tc.wantKey {
			t.Fatalf("%s: got (%q, %q) want (%q, %q)", tc.name, gotPrefix, gotKey, tc.wantPrefix, tc.wantKey)
		}
	}
}
