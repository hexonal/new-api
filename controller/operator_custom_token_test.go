package controller

import (
	"strings"
	"testing"
)

func TestValidateOperatorProvisionToken(t *testing.T) {
	cases := []struct {
		name  string
		token string
		want  bool
	}{
		{name: "valid letters", token: "abcXYZ", want: true},
		{name: "valid alphanumeric", token: "a1B2c3", want: true},
		{name: "min length", token: "a", want: true},
		{name: "max length", token: strings.Repeat("a", 48), want: true},
		{name: "empty", token: "", want: false},
		{name: "too long", token: strings.Repeat("a", 49), want: false},
		{name: "contains dash", token: "abc-123", want: true},
		{name: "contains underscore", token: "abc_123", want: true},
		{name: "allows sk prefix", token: "sk-custom_token_123", want: true},
		{name: "allows customer sk prefix", token: "customer-sk-custom_token_123", want: true},
		{name: "contains space", token: "abc 123", want: false},
		{name: "contains unicode", token: "令牌", want: false},
	}

	for _, tc := range cases {
		got := validateOperatorProvisionToken(tc.token)
		if got != tc.want {
			t.Fatalf("%s: validateOperatorProvisionToken(%q) = %v, want %v", tc.name, tc.token, got, tc.want)
		}
	}
}
