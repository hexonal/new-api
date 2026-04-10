package model_capability

import "encoding/json"

type ParameterSchemaKind string

const (
	ParameterSchemaKindScalar ParameterSchemaKind = "scalar"
	ParameterSchemaKindEnum   ParameterSchemaKind = "enum"
	ParameterSchemaKindFile   ParameterSchemaKind = "file"
	ParameterSchemaKindArray  ParameterSchemaKind = "array"
	ParameterSchemaKindObject ParameterSchemaKind = "object"
	ParameterSchemaKindUnion  ParameterSchemaKind = "union"
)

type EndpointParameterSchema struct {
	Kind      ParameterSchemaKind                `json:"kind"`
	ValueType string                             `json:"value_type"`
	Options   []string                           `json:"options"`
	Items     *EndpointParameterSchema           `json:"items"`
	Fields    map[string]EndpointParameterDef    `json:"fields"`
	Variants  []EndpointParameterSchema          `json:"variants"`
}

type EndpointParameterDef struct {
	Required    bool                    `json:"required"`
	Default     json.RawMessage         `json:"default"`
	Description string                  `json:"description"`
	Schema      EndpointParameterSchema `json:"schema"`
}

type ModelEndpointSchema struct {
	Supported     bool                            `json:"supported"`
	RequestFormat string                          `json:"request_format"`
	SDKMethod     string                          `json:"sdk_method"`
	Parameters    map[string]EndpointParameterDef `json:"parameters"`

	Path          string                          `json:"path"`
	Method        string                          `json:"method"`
	ProviderStyle string                          `json:"provider_style"`
	Async         bool                            `json:"async"`
}

func NormalizeCapabilityKeys(key string) []string {
	switch key {
	case "image-generation":
		return []string{"text_to_image", "image_to_image"}
	case "jimeng":
		return []string{"text_to_image"}
	case "openai-video", "video_generation":
		return []string{"text_to_video"}
	case "kling", "kling_video":
		return []string{"text_to_video", "image_to_video"}
	default:
		return []string{key}
	}
}
