package model

import "testing"

func TestFormatTokenKeyForError(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "empty", in: "", want: "***"},
		{name: "standard sk", in: "sk-abcdefghi", want: "sk-abc***ghi"},
		{name: "customer sk", in: "customer-sk-abcdefghi", want: "customer-sk-abc***ghi"},
		{name: "ima no prefix", in: "ima_61f24b472a5640a8b5860944b6178abf", want: "ima***abf"},
		{name: "short key no prefix", in: "ima_12", want: "ima_12"},
	}
	for _, tt := range tests {
		if got := formatTokenKeyForError(tt.in); got != tt.want {
			t.Fatalf("%s: got=%q want=%q", tt.name, got, tt.want)
		}
	}
}

