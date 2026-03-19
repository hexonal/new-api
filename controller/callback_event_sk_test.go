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
		{name: "default sk", input: "abc123", want: "sk-abc123"},
		{name: "already sk", input: "sk-abc123", want: "sk-abc123"},
		{name: "customer sk", input: "customer-sk-abc123", want: "customer-sk-abc123"},
		{name: "custom sk", input: "custom-sk-abc123", want: "custom-sk-abc123"},
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
		{name: "customer prefix", input: "customer-sk-abcdefgh12345678", wantPrefix: "customer-sk-", wantContain: "***"},
		{name: "custom prefix", input: "custom-sk-abcdefgh12345678", wantPrefix: "custom-sk-", wantContain: "***"},
	}

	for _, tc := range cases {
		got := buildMaskedSK(tc.input)
		if len(got) == 0 {
			t.Fatalf("%s: empty result", tc.name)
		}
		if got[:len(tc.wantPrefix)] != tc.wantPrefix {
			t.Fatalf("%s: prefix mismatch got %q want prefix %q", tc.name, got, tc.wantPrefix)
		}
		if !strings.Contains(got, tc.wantContain) {
			t.Fatalf("%s: expected masked marker in %q", tc.name, got)
		}
	}
}
