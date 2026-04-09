package model_capability

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type ModelParameterDef struct {
	Type        string   `json:"type"`
	Required    bool     `json:"required,omitempty"`
	Description string   `json:"description,omitempty"`
	Default     any      `json:"default,omitempty"`
	Enum        []string `json:"enum,omitempty"`
	Min         *float64 `json:"min,omitempty"`
	Max         *float64 `json:"max,omitempty"`
}

type modelParameterTemplate struct {
	prefix string
	params map[string]ModelParameterDef
}

var defaultParameterTemplates = []modelParameterTemplate{
	{
		prefix: "kling-video-",
		params: map[string]ModelParameterDef{
			"duration": {
				Type:        "integer",
				Description: "Video duration in seconds.",
				Default:     5,
				Min:         float64Ptr(5),
				Max:         float64Ptr(10),
			},
			"size": {
				Type:        "string",
				Description: "Target output size.",
				Default:     "1280x720",
				Enum:        []string{"512x512", "1024x1024", "1280x720", "720x1280", "1920x1080", "1080x1920"},
			},
			"mode": {
				Type:        "string",
				Description: "Generation mode.",
				Default:     "std",
			},
		},
	},
	{
		prefix: "kling-v",
		params: map[string]ModelParameterDef{
			"duration": {
				Type:        "integer",
				Description: "Video duration in seconds.",
				Default:     5,
				Min:         float64Ptr(5),
				Max:         float64Ptr(10),
			},
			"size": {
				Type:        "string",
				Description: "Target output size.",
				Default:     "1280x720",
				Enum:        []string{"512x512", "1024x1024", "1280x720", "720x1280", "1920x1080", "1080x1920"},
			},
			"mode": {
				Type:        "string",
				Description: "Generation mode.",
				Default:     "std",
			},
		},
	},
	{
		prefix: "kling-image-",
		params: map[string]ModelParameterDef{
			"size": {
				Type:        "string",
				Description: "Target image size.",
				Default:     "1024x1024",
				Enum:        []string{"512x512", "1024x1024", "1280x720", "720x1280", "1920x1080", "1080x1920"},
			},
			"n": {
				Type:        "integer",
				Description: "Number of images to generate.",
				Default:     1,
				Min:         float64Ptr(1),
			},
			"image_fidelity": {
				Type:        "number",
				Description: "Image fidelity for reference image generation.",
				Min:         float64Ptr(0),
				Max:         float64Ptr(1),
			},
		},
	},
	{
		prefix: "jimeng_high_",
		params: map[string]ModelParameterDef{
			"response_format": {
				Type:        "string",
				Description: "Image response format.",
				Default:     "url",
				Enum:        []string{"url", "b64_json"},
			},
			"width": {
				Type:        "integer",
				Description: "Output image width.",
				Default:     512,
				Min:         float64Ptr(256),
				Max:         float64Ptr(768),
			},
			"height": {
				Type:        "integer",
				Description: "Output image height.",
				Default:     512,
				Min:         float64Ptr(256),
				Max:         float64Ptr(768),
			},
			"use_pre_llm": {
				Type:        "boolean",
				Description: "Enable prompt rewriting before generation.",
				Default:     true,
			},
			"use_sr": {
				Type:        "boolean",
				Description: "Enable super resolution.",
				Default:     true,
			},
		},
	},
	{
		prefix: "text-embedding-",
		params: map[string]ModelParameterDef{
			"encoding_format": {
				Type:        "string",
				Description: "Encoding format for embedding vectors.",
				Default:     "float",
				Enum:        []string{"float", "base64"},
			},
		},
	},
	{
		prefix: "gpt-3.5",
		params: map[string]ModelParameterDef{
			"temperature": {
				Type:        "number",
				Description: "Sampling temperature.",
				Default:     1.0,
				Min:         float64Ptr(0),
				Max:         float64Ptr(2),
			},
			"max_tokens": {
				Type:        "integer",
				Description: "Maximum output tokens.",
				Min:         float64Ptr(1),
			},
			"tools": {
				Type:        "boolean",
				Description: "Supports tool calling.",
				Default:     false,
			},
			"response_format": {
				Type:        "string",
				Description: "Supported structured response formats.",
				Enum:        []string{"text", "json_object", "json_schema"},
				Default:     "text",
			},
			"vision": {
				Type:        "boolean",
				Description: "Supports vision inputs.",
				Default:     false,
			},
			"stream": {
				Type:        "boolean",
				Description: "Supports streaming responses.",
				Default:     false,
			},
		},
	},
	{
		prefix: "gpt-4",
		params: map[string]ModelParameterDef{
			"temperature": {
				Type:        "number",
				Description: "Sampling temperature.",
				Default:     1.0,
				Min:         float64Ptr(0),
				Max:         float64Ptr(2),
			},
			"max_tokens": {
				Type:        "integer",
				Description: "Maximum output tokens.",
				Min:         float64Ptr(1),
			},
			"tools": {
				Type:        "boolean",
				Description: "Supports tool calling.",
				Default:     false,
			},
			"response_format": {
				Type:        "string",
				Description: "Supported structured response formats.",
				Enum:        []string{"text", "json_object", "json_schema"},
				Default:     "text",
			},
			"vision": {
				Type:        "boolean",
				Description: "Supports vision inputs.",
				Default:     false,
			},
			"stream": {
				Type:        "boolean",
				Description: "Supports streaming responses.",
				Default:     false,
			},
		},
	},
	{
		prefix: "claude-",
		params: map[string]ModelParameterDef{
			"temperature": {
				Type:        "number",
				Description: "Sampling temperature.",
				Default:     1.0,
				Min:         float64Ptr(0),
				Max:         float64Ptr(1),
			},
			"max_tokens": {
				Type:        "integer",
				Description: "Maximum output tokens.",
				Min:         float64Ptr(1),
			},
			"tools": {
				Type:        "boolean",
				Description: "Supports tool calling.",
				Default:     false,
			},
			"stream": {
				Type:        "boolean",
				Description: "Supports streaming responses.",
				Default:     false,
			},
		},
	},
	{
		prefix: "dall-e-",
		params: map[string]ModelParameterDef{
			"size": {
				Type:        "string",
				Description: "Target image size.",
				Default:     "1024x1024",
				Enum:        []string{"1024x1024", "1792x1024", "1024x1792"},
			},
			"quality": {
				Type:        "string",
				Description: "Image quality.",
				Default:     "standard",
				Enum:        []string{"standard", "hd"},
			},
			"style": {
				Type:        "string",
				Description: "Image style.",
				Default:     "vivid",
				Enum:        []string{"vivid", "natural"},
			},
			"n": {
				Type:        "integer",
				Description: "Number of images to generate.",
				Default:     1,
				Min:         float64Ptr(1),
				Max:         float64Ptr(1),
			},
		},
	},
	{
		prefix: "whisper-",
		params: map[string]ModelParameterDef{
			"language": {
				Type:        "string",
				Description: "Audio language hint.",
			},
			"response_format": {
				Type:        "string",
				Description: "Transcription response format.",
				Default:     "json",
				Enum:        []string{"json", "text", "srt", "vtt"},
			},
			"temperature": {
				Type:        "number",
				Description: "Sampling temperature.",
				Default:     0.0,
				Min:         float64Ptr(0),
				Max:         float64Ptr(1),
			},
		},
	},
	{
		prefix: "tts-",
		params: map[string]ModelParameterDef{
			"voice": {
				Type:        "string",
				Description: "Voice preset.",
				Default:     "alloy",
				Enum:        []string{"alloy", "echo", "fable", "onyx", "nova", "shimmer"},
			},
			"response_format": {
				Type:        "string",
				Description: "Audio response format.",
				Default:     "mp3",
				Enum:        []string{"mp3", "opus", "aac", "flac"},
			},
			"speed": {
				Type:        "number",
				Description: "Speech speed.",
				Default:     1.0,
				Min:         float64Ptr(0.25),
				Max:         float64Ptr(4.0),
			},
		},
	},
	{
		prefix: "gemini-",
		params: map[string]ModelParameterDef{
			"temperature": {
				Type:        "number",
				Description: "Sampling temperature.",
				Default:     1.0,
				Min:         float64Ptr(0),
				Max:         float64Ptr(2),
			},
			"max_tokens": {
				Type:        "integer",
				Description: "Maximum output tokens.",
				Min:         float64Ptr(1),
			},
			"tools": {
				Type:        "boolean",
				Description: "Supports tool calling.",
				Default:     false,
			},
			"response_format": {
				Type:        "string",
				Description: "Supported structured response formats.",
				Enum:        []string{"text", "json_object", "json_schema"},
				Default:     "text",
			},
			"vision": {
				Type:        "boolean",
				Description: "Supports vision inputs.",
				Default:     false,
			},
			"stream": {
				Type:        "boolean",
				Description: "Supports streaming responses.",
				Default:     false,
			},
		},
	},
}

func GetDefaultParameters(modelName string) map[string]ModelParameterDef {
	name := strings.TrimSpace(strings.ToLower(modelName))
	if name == "" {
		return map[string]ModelParameterDef{}
	}

	var matched map[string]ModelParameterDef
	matchedLen := -1
	for _, template := range defaultParameterTemplates {
		if strings.HasPrefix(name, template.prefix) && len(template.prefix) > matchedLen {
			matched = template.params
			matchedLen = len(template.prefix)
		}
	}
	return cloneParameters(matched)
}

func MergeParameters(base, override map[string]ModelParameterDef) map[string]ModelParameterDef {
	merged := cloneParameters(base)
	for name, def := range cloneParameters(override) {
		merged[name] = def
	}
	return merged
}

func cloneParameters(src map[string]ModelParameterDef) map[string]ModelParameterDef {
	if len(src) == 0 {
		return map[string]ModelParameterDef{}
	}

	data, err := common.Marshal(src)
	if err != nil {
		return map[string]ModelParameterDef{}
	}

	var cloned map[string]ModelParameterDef
	if err := common.Unmarshal(data, &cloned); err != nil || cloned == nil {
		return map[string]ModelParameterDef{}
	}
	return cloned
}

func float64Ptr(v float64) *float64 {
	return &v
}
