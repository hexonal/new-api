package model_capability

import (
	"encoding/json"
	"strings"
	"sync/atomic"
)

var modelNSFWMap atomic.Value

func init() {
	modelNSFWMap.Store(map[string]bool{})
}

func UpdateModelNSFWByJSONString(value string) error {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		modelNSFWMap.Store(map[string]bool{})
		return nil
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(trimmed), &raw); err != nil {
		return err
	}

	normalized := make(map[string]bool, len(raw))
	for modelName, rawValue := range raw {
		name := strings.TrimSpace(strings.ToLower(modelName))
		if name == "" {
			continue
		}

		var enabled bool
		if err := json.Unmarshal(rawValue, &enabled); err != nil {
			continue
		}
		normalized[name] = enabled
	}
	modelNSFWMap.Store(normalized)
	return nil
}

func GetModelNSFW(modelName string) (bool, bool) {
	models := modelNSFWMap.Load().(map[string]bool)
	value, ok := models[strings.TrimSpace(strings.ToLower(modelName))]
	return value, ok
}
