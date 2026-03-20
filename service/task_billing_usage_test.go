package service

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestExtractTaskTokenUsage(t *testing.T) {
	tests := []struct {
		name string
		data string
		want struct {
			prompt     int
			completion int
			total      int
		}
	}{
		{
			name: "top_level_usage",
			data: `{"usage":{"prompt_tokens":12,"completion_tokens":34,"total_tokens":46}}`,
			want: struct {
				prompt     int
				completion int
				total      int
			}{prompt: 12, completion: 34, total: 46},
		},
		{
			name: "nested_usage_only_total",
			data: `{"data":{"usage":{"total_tokens":324900}}}`,
			want: struct {
				prompt     int
				completion int
				total      int
			}{prompt: 0, completion: 324900, total: 324900},
		},
		{
			name: "nested_usage_without_total",
			data: `{"response":{"usage":{"prompt_tokens":"7","completion_tokens":"8"}}}`,
			want: struct {
				prompt     int
				completion int
				total      int
			}{prompt: 7, completion: 8, total: 15},
		},
		{
			name: "input_output_usage_alias",
			data: `{"usage":{"input_tokens":9,"output_tokens":1505,"total_tokens":1514}}`,
			want: struct {
				prompt     int
				completion int
				total      int
			}{prompt: 9, completion: 1505, total: 1514},
		},
		{
			name: "nested_input_output_string_alias",
			data: `{"response":{"usage":{"input_tokens":"11","output_tokens":"22"}}}`,
			want: struct {
				prompt     int
				completion int
				total      int
			}{prompt: 11, completion: 22, total: 33},
		},
		{
			name: "empty_payload",
			data: `{}`,
			want: struct {
				prompt     int
				completion int
				total      int
			}{prompt: 0, completion: 0, total: 0},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task := &model.Task{Data: json.RawMessage(tt.data)}
			prompt, completion, total := extractTaskTokenUsage(task)
			if prompt != tt.want.prompt || completion != tt.want.completion || total != tt.want.total {
				t.Fatalf("extractTaskTokenUsage() = (%d, %d, %d), want (%d, %d, %d)",
					prompt, completion, total, tt.want.prompt, tt.want.completion, tt.want.total)
			}
		})
	}
}
