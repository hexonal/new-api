package dto

import (
	"encoding/json"
	"testing"
)

func TestOpenAIResponsesResponse_UnmarshalToolChoiceObject(t *testing.T) {
	payload := []byte(`{
		"id":"resp_1",
		"object":"response",
		"created_at":1772600000,
		"status":"completed",
		"instructions":"",
		"max_output_tokens":64,
		"model":"gpt-5.3-codex",
		"output":[],
		"parallel_tool_calls":true,
		"previous_response_id":"",
		"reasoning":null,
		"store":false,
		"temperature":1,
		"tool_choice":{"type":"function","name":"sessions_spawn"},
		"tools":[],
		"top_p":1,
		"truncation":"disabled",
		"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}
	}`)

	var resp OpenAIResponsesResponse
	if err := json.Unmarshal(payload, &resp); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}

	toolChoiceObj, ok := resp.ToolChoice.(map[string]any)
	if !ok {
		t.Fatalf("expected tool_choice object, got %#v", resp.ToolChoice)
	}
	if toolChoiceObj["type"] != "function" {
		t.Fatalf("unexpected tool_choice.type: %v", toolChoiceObj["type"])
	}
}
