package model_capability

import (
	"encoding/json"
	"strings"
	"sync/atomic"
)

var modelFunctionCallingMap atomic.Value

func init() {
	modelFunctionCallingMap.Store(map[string]bool{})
}

// UpdateModelFunctionCallingByJSONString 从 JSON 字符串更新 function calling 配置
func UpdateModelFunctionCallingByJSONString(value string) error {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		modelFunctionCallingMap.Store(map[string]bool{})
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
	modelFunctionCallingMap.Store(normalized)
	return nil
}

// GetModelFunctionCalling 查询指定模型是否支持 function calling
func GetModelFunctionCalling(modelName string) (bool, bool) {
	models := modelFunctionCallingMap.Load().(map[string]bool)
	value, ok := models[strings.TrimSpace(strings.ToLower(modelName))]
	return value, ok
}
