package controller

import (
	"testing"

	"github.com/tidwall/gjson"
)

func TestNormalizeImaProFinishAt(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want int64
	}{
		{
			name: "seconds_number",
			raw:  `{"finish_at":1710000000}`,
			want: 1710000000,
		},
		{
			name: "millis_number",
			raw:  `{"finish_at":1710000000123}`,
			want: 1710000000,
		},
		{
			name: "seconds_string",
			raw:  `{"finish_at":"1710000000"}`,
			want: 1710000000,
		},
		{
			name: "rfc3339",
			raw:  `{"finish_at":"2026-03-13T10:00:00Z"}`,
			want: 1773396000,
		},
		{
			name: "missing",
			raw:  `{}`,
			want: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := gjson.Get(tt.raw, "finish_at")
			if got := normalizeImaProFinishAt(v); got != tt.want {
				t.Fatalf("normalizeImaProFinishAt() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestExtractImaProCallbackString(t *testing.T) {
	body := []byte(`{"data":{"id_task":"tk_data_123"},"id_task":""}`)
	got := extractImaProCallbackString(body, "id_task", "data.id_task")
	if got != "tk_data_123" {
		t.Fatalf("extractImaProCallbackString() = %q, want tk_data_123", got)
	}
}

func TestExtractImaProCallbackResult(t *testing.T) {
	body := []byte(`{"response":{"finish_at":"2026-03-13T10:00:00Z"}}`)
	got := extractImaProCallbackResult(body, "finish_at", "data.finish_at", "response.finish_at")
	if !got.Exists() {
		t.Fatalf("extractImaProCallbackResult() should exist")
	}
	if got.String() != "2026-03-13T10:00:00Z" {
		t.Fatalf("extractImaProCallbackResult() = %q, want 2026-03-13T10:00:00Z", got.String())
	}
}
