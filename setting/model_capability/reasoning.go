package model_capability

import (
	"encoding/json"
	"strings"
	"sync/atomic"
)

var modelReasoningMap atomic.Value

func init() {
	modelReasoningMap.Store(map[string]bool{})
}

func UpdateModelReasoningByJSONString(value string) error {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		modelReasoningMap.Store(map[string]bool{})
		return nil
	}

	var raw map[string]any
	if err := json.Unmarshal([]byte(trimmed), &raw); err != nil {
		return err
	}

	normalized := make(map[string]bool, len(raw))
	for model, val := range raw {
		name := strings.TrimSpace(strings.ToLower(model))
		if name == "" {
			continue
		}
		b, ok := val.(bool)
		if !ok {
			continue
		}
		normalized[name] = b
	}
	modelReasoningMap.Store(normalized)
	return nil
}

func GetModelReasoning(modelName string) (bool, bool) {
	models := modelReasoningMap.Load().(map[string]bool)
	value, ok := models[strings.TrimSpace(strings.ToLower(modelName))]
	return value, ok
}
