package relay

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestBuildImageFetchResponseIncludesUsageInputOutputTotal(t *testing.T) {
	task := &model.Task{
		TaskID: "task_demo_1",
		Status: model.TaskStatusSuccess,
		Data:   json.RawMessage(`{"usage":{"input_tokens":9,"output_tokens":1505,"total_tokens":1514}}`),
	}

	raw, err := buildImageFetchResponse(task)
	if err != nil {
		t.Fatalf("buildImageFetchResponse error: %v", err)
	}

	var resp map[string]any
	if err := json.Unmarshal(raw, &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	data, ok := resp["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data object: %#v", resp)
	}
	usage, ok := data["usage"].(map[string]any)
	if !ok {
		t.Fatalf("missing usage object: %#v", data)
	}

	assertNumberField(t, usage, "input_tokens", 9)
	assertNumberField(t, usage, "output_tokens", 1505)
	assertNumberField(t, usage, "total_tokens", 1514)
}

func TestBuildImageFetchResponseUsageFallbackOnlyTotal(t *testing.T) {
	task := &model.Task{
		TaskID: "task_demo_2",
		Status: model.TaskStatusInProgress,
		Data:   json.RawMessage(`{"data":{"usage":{"total_tokens":324900}}}`),
	}

	raw, err := buildImageFetchResponse(task)
	if err != nil {
		t.Fatalf("buildImageFetchResponse error: %v", err)
	}

	var resp map[string]any
	if err := json.Unmarshal(raw, &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	data := resp["data"].(map[string]any)
	usage := data["usage"].(map[string]any)

	assertNumberField(t, usage, "input_tokens", 0)
	assertNumberField(t, usage, "output_tokens", 324900)
	assertNumberField(t, usage, "total_tokens", 324900)
}

func assertNumberField(t *testing.T, payload map[string]any, key string, want int64) {
	t.Helper()
	v, ok := payload[key]
	if !ok {
		t.Fatalf("missing field %s in %#v", key, payload)
	}
	got, ok := v.(float64)
	if !ok {
		t.Fatalf("field %s type %T, want number", key, v)
	}
	if int64(got) != want {
		t.Fatalf("field %s = %d, want %d", key, int64(got), want)
	}
}

