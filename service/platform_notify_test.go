package service

import "testing"

func TestNormalizeOperatorCallbackSK(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "standard sk", in: "sk-abc123", want: "sk-abc123"},
		{name: "customer sk", in: "customer-sk-abc123", want: "customer-sk-abc123"},
		{name: "ima key", in: "ima_61f24b472a5640a8b5860944b6178abf", want: "ima_61f24b472a5640a8b5860944b6178abf"},
		{name: "trim whitespace", in: "  ima_abc  ", want: "ima_abc"},
	}
	for _, tt := range tests {
		if got := normalizeOperatorCallbackSK(tt.in); got != tt.want {
			t.Fatalf("%s: got=%q want=%q", tt.name, got, tt.want)
		}
	}
}

