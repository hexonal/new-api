package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestResponsesResponseToChatCompletionsResponse_KeepToolCallsWhenTextExists(t *testing.T) {
	resp := &dto.OpenAIResponsesResponse{
		Model:     "gpt-5.3-codex",
		CreatedAt: 1772600000,
		Output: []dto.ResponsesOutput{
			{
				Type: "message",
				Role: "assistant",
				Content: []dto.ResponsesOutputContent{
					{Type: "output_text", Text: "I can do that."},
				},
			},
			{
				ID:        "fc_123",
				Type:      "function_call",
				CallId:    "call_123",
				Name:      "sessions_spawn",
				Arguments: `{"agent":"default"}`,
			},
		},
	}

	chatResp, usage, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl-test")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if chatResp == nil || usage == nil {
		t.Fatalf("expected non-nil response and usage")
	}
	if len(chatResp.Choices) != 1 {
		t.Fatalf("expected 1 choice, got %d", len(chatResp.Choices))
	}

	choice := chatResp.Choices[0]
	if choice.FinishReason != "tool_calls" {
		t.Fatalf("expected finish_reason=tool_calls, got %s", choice.FinishReason)
	}
	if choice.Message.Content != nil {
		t.Fatalf("expected message content to be null when tool_calls exists, got %#v", choice.Message.Content)
	}

	toolCalls := choice.Message.ParseToolCalls()
	if len(toolCalls) != 1 {
		t.Fatalf("expected 1 tool_call, got %d", len(toolCalls))
	}
	if toolCalls[0].Function.Name != "sessions_spawn" {
		t.Fatalf("unexpected tool name: %s", toolCalls[0].Function.Name)
	}
	if toolCalls[0].Function.Arguments != `{"agent":"default"}` {
		t.Fatalf("unexpected tool arguments: %s", toolCalls[0].Function.Arguments)
	}
}

func TestResponsesResponseToChatCompletionsResponse_TextOnly(t *testing.T) {
	resp := &dto.OpenAIResponsesResponse{
		Model:     "gpt-5.3-codex",
		CreatedAt: 1772600001,
		Output: []dto.ResponsesOutput{
			{
				Type: "message",
				Role: "assistant",
				Content: []dto.ResponsesOutputContent{
					{Type: "output_text", Text: "hello"},
				},
			},
		},
	}

	chatResp, _, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl-test-2")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	choice := chatResp.Choices[0]
	if choice.FinishReason != "stop" {
		t.Fatalf("expected finish_reason=stop, got %s", choice.FinishReason)
	}
	if !choice.Message.IsStringContent() || choice.Message.StringContent() != "hello" {
		t.Fatalf("unexpected content: %#v", choice.Message.Content)
	}
}
