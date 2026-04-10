package dto

import (
	"encoding/json"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/model_capability"
)

type CapabilityParameterSchema = model_capability.EndpointParameterSchema
type CapabilityParameter = model_capability.EndpointParameterDef
type CapabilitySpec = model_capability.ModelEndpointSchema
type CapabilityMap map[string]CapabilitySpec

type legacyCapabilitySpec struct {
	Path          string                              `json:"path"`
	Method        string                              `json:"method"`
	ProviderStyle string                              `json:"provider_style"`
	Async         bool                                `json:"async"`
	Parameters    map[string]legacyCapabilityParameter `json:"parameters"`
}

type legacyCapabilityParameter struct {
	Type        string          `json:"type"`
	Required    bool            `json:"required"`
	Default     json.RawMessage `json:"default"`
	Enum        []string        `json:"enum"`
	Description string          `json:"description"`
}

func BuildCapabilityMapFromRawEndpoints(raw map[string]json.RawMessage) CapabilityMap {
	if len(raw) == 0 {
		return CapabilityMap{}
	}

	result := make(CapabilityMap, len(raw))
	for key, value := range raw {
		for _, normalizedKey := range model_capability.NormalizeCapabilityKeys(key) {
			spec, ok := parseCapabilitySpec(normalizedKey, value)
			if !ok {
				continue
			}
			result[normalizedKey] = spec
		}
	}
	return result
}

func BuildCapabilityMapFromEndpointTypes(endpointTypes []constant.EndpointType) CapabilityMap {
	if len(endpointTypes) == 0 {
		return CapabilityMap{}
	}

	result := CapabilityMap{}
	for _, endpointType := range endpointTypes {
		for key, spec := range capabilitySpecsFromEndpointType(endpointType) {
			result[key] = spec
		}
	}
	return result
}

func SupportedEndpointTypes(capabilities CapabilityMap) []constant.EndpointType {
	if len(capabilities) == 0 {
		return []constant.EndpointType{}
	}

	keys := make([]string, 0, len(capabilities))
	for key := range capabilities {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	endpointTypes := make([]constant.EndpointType, 0, len(keys))
	for _, key := range keys {
		endpointTypes = append(endpointTypes, constant.EndpointType(key))
	}
	return endpointTypes
}

func parseCapabilitySpec(capabilityKey string, raw json.RawMessage) (CapabilitySpec, bool) {
	if len(raw) == 0 {
		return CapabilitySpec{}, false
	}

	var spec CapabilitySpec
	if err := json.Unmarshal(raw, &spec); err != nil {
		return parseLegacyCapabilitySpec(capabilityKey, raw)
	}
	if spec.Path == "" && spec.RequestFormat == "" && spec.SDKMethod == "" {
		return parseLegacyCapabilitySpec(capabilityKey, raw)
	}
	if spec.Path == "" {
		spec.Path = inferPath(capabilityKey, "")
	}
	spec.ProviderStyle = inferProviderStyle(capabilityKey, spec.Path, spec.ProviderStyle)
	spec.Method = inferMethod(spec.Method)
	spec.RequestFormat = inferRequestFormat(capabilityKey, spec.Path, spec.Method, spec.ProviderStyle)
	spec.SDKMethod = inferSDKMethod(capabilityKey, spec.Path, spec.ProviderStyle)
	if spec.Parameters == nil {
		spec.Parameters = map[string]CapabilityParameter{}
	}
	spec.Async = spec.Async || inferAsync(capabilityKey, spec.ProviderStyle)
	return spec, true
}

func parseLegacyCapabilitySpec(capabilityKey string, raw json.RawMessage) (CapabilitySpec, bool) {
	var legacy legacyCapabilitySpec
	if err := json.Unmarshal(raw, &legacy); err != nil {
		return CapabilitySpec{}, false
	}
	if legacy.Path == "" {
		return CapabilitySpec{}, false
	}

	spec := CapabilitySpec{
		Supported:     true,
		Path:          inferPath(capabilityKey, legacy.Path),
		Method:        inferMethod(legacy.Method),
		ProviderStyle: strings.TrimSpace(legacy.ProviderStyle),
		Async:         legacy.Async || inferAsync(capabilityKey, legacy.ProviderStyle),
		RequestFormat: inferRequestFormat(capabilityKey, legacy.Path, legacy.Method, legacy.ProviderStyle),
		SDKMethod:     inferSDKMethod(capabilityKey, legacy.Path, legacy.ProviderStyle),
		Parameters:    convertLegacyParameters(legacy.Parameters),
	}
	return spec, true
}

func convertLegacyParameters(parameters map[string]legacyCapabilityParameter) map[string]CapabilityParameter {
	if len(parameters) == 0 {
		return map[string]CapabilityParameter{}
	}

	result := make(map[string]CapabilityParameter, len(parameters))
	for name, parameter := range parameters {
		result[name] = CapabilityParameter{
			Required:    parameter.Required,
			Default:     parameter.Default,
			Description: parameter.Description,
			Schema:      capabilityParameterSchemaFromLegacy(parameter.Type, parameter.Enum),
		}
	}
	return result
}

func capabilityParameterSchemaFromLegacy(typeName string, enumValues []string) CapabilityParameterSchema {
	if len(enumValues) > 0 {
		return CapabilityParameterSchema{
			Kind:      model_capability.ParameterSchemaKindEnum,
			ValueType: "string",
			Options:   append([]string(nil), enumValues...),
		}
	}

	valueType := strings.TrimSpace(typeName)
	if valueType == "" {
		valueType = "string"
	}
	if valueType == "file" {
		return CapabilityParameterSchema{Kind: model_capability.ParameterSchemaKindFile}
	}

	return CapabilityParameterSchema{
		Kind:      model_capability.ParameterSchemaKindScalar,
		ValueType: valueType,
	}
}

func inferRequestFormat(capabilityKey string, path string, method string, providerStyle string) string {
	trimmedPath := strings.TrimSpace(path)
	if capabilityKey == "image_to_image" || strings.Contains(trimmedPath, "/edits") ||
		providerStyle == "openai-image" && strings.Contains(trimmedPath, "/images/edits") {
		return "multipart"
	}
	if trimmedPath == "/v1/audio/speech" {
		return "blob_response"
	}
	if trimmedPath == "/v1/realtime" {
		return "websocket"
	}
	if method == "" {
		return "json"
	}
	return "json"
}

func inferPath(capabilityKey string, legacyPath string) string {
	switch capabilityKey {
	case "image_to_image":
		return "/v1/images/edits"
	case "text_to_video", "image_to_video":
		return "/v1/videos"
	default:
		trimmedPath := strings.TrimSpace(legacyPath)
		if trimmedPath != "" {
			return trimmedPath
		}
		return legacyPath
	}
}

func inferMethod(method string) string {
	trimmedMethod := strings.TrimSpace(method)
	if trimmedMethod == "" {
		return "POST"
	}
	return trimmedMethod
}

func inferAsync(capabilityKey string, providerStyle string) bool {
	switch capabilityKey {
	case "text_to_video", "image_to_video":
		return true
	}
	return strings.TrimSpace(providerStyle) == "jimeng"
}

func inferProviderStyle(capabilityKey string, path string, providerStyle string) string {
	trimmedProviderStyle := strings.TrimSpace(providerStyle)
	if trimmedProviderStyle != "" {
		return trimmedProviderStyle
	}

	switch capabilityKey {
	case "chat", "speech_to_text", "text_to_speech", "audio_translation", "moderation", "embeddings":
		return "openai"
	case "text_to_image", "image_to_image":
		return "openai-image"
	case "text_to_video", "image_to_video":
		return "openai-video"
	case "music_generation":
		return "suno"
	case "midjourney_generation":
		return "midjourney"
	case "rerank":
		return "jina"
	case "realtime":
		return "openai"
	}

	switch {
	case strings.Contains(path, "/images/generations"), strings.Contains(path, "/images/edits"):
		return "openai-image"
	case strings.Contains(path, "/videos"):
		return "openai-video"
	default:
		return "openai"
	}
}

func inferSDKMethod(capabilityKey string, path string, providerStyle string) string {
	switch capabilityKey {
	case "text_to_image":
		return "aiApi.imageGenerations"
	case "image_to_image":
		return "aiApi.imageEdits"
	case "text_to_video", "image_to_video":
		return "aiApi.videoGenerations"
	}

	switch {
	case strings.Contains(path, "/images/generations"):
		return "aiApi.imageGenerations"
	case strings.Contains(path, "/images/edits"):
		return "aiApi.imageEdits"
	case strings.Contains(path, "/videos"):
		return "aiApi.videoGenerations"
	case strings.Contains(path, "/audio/transcriptions"):
		return "aiApi.audioTranscriptions"
	case strings.Contains(path, "/audio/translations"):
		return "aiApi.audioTranslations"
	case strings.Contains(path, "/audio/speech"):
		return "aiApi.audioSpeech"
	case strings.Contains(path, "/embeddings"):
		return "aiApi.embeddings"
	case strings.Contains(path, "/rerank"):
		return "aiApi.rerank"
	case strings.Contains(path, "/moderations"):
		return "aiApi.moderations"
	case strings.Contains(path, "/realtime"):
		return "N/A"
	default:
		if providerStyle == "openai-image" {
			return "aiApi.imageGenerations"
		}
		return "aiApi.chatCompletions"
	}
}

func capabilitySpecsFromEndpointType(endpointType constant.EndpointType) map[string]CapabilitySpec {
	switch string(endpointType) {
	case "chat", string(constant.EndpointTypeOpenAIChat), string(constant.EndpointTypeAnthropic),
		string(constant.EndpointTypeGemini), string(constant.EndpointTypeOpenAIResponse),
		string(constant.EndpointTypeOpenAIResponseCompact):
		return map[string]CapabilitySpec{
			"chat": {
				Supported:     true,
				Path:          "/v1/chat/completions",
				Method:        "POST",
				ProviderStyle: "openai",
				RequestFormat: "json",
				SDKMethod:     "aiApi.chatCompletions",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "speech_to_text", string(constant.EndpointTypeOpenAISTT):
		return map[string]CapabilitySpec{
			"speech_to_text": {
				Supported:     true,
				Path:          "/v1/audio/transcriptions",
				Method:        "POST",
				ProviderStyle: "openai",
				RequestFormat: "multipart",
				SDKMethod:     "aiApi.audioTranscriptions",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "text_to_speech", string(constant.EndpointTypeOpenAITTS):
		return map[string]CapabilitySpec{
			"text_to_speech": {
				Supported:     true,
				Path:          "/v1/audio/speech",
				Method:        "POST",
				ProviderStyle: "openai",
				RequestFormat: "blob_response",
				SDKMethod:     "aiApi.audioSpeech",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "audio_translation", string(constant.EndpointTypeOpenAIAudioTranslation):
		return map[string]CapabilitySpec{
			"audio_translation": {
				Supported:     true,
				Path:          "/v1/audio/translations",
				Method:        "POST",
				ProviderStyle: "openai",
				RequestFormat: "multipart",
				SDKMethod:     "aiApi.audioTranslations",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "moderation", string(constant.EndpointTypeOpenAIModeration):
		return map[string]CapabilitySpec{
			"moderation": {
				Supported:     true,
				Path:          "/v1/moderations",
				Method:        "POST",
				ProviderStyle: "openai",
				RequestFormat: "json",
				SDKMethod:     "aiApi.moderations",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "text_to_image", string(constant.EndpointTypeImageGeneration):
		return map[string]CapabilitySpec{
			"text_to_image": {
				Supported:     true,
				Path:          "/v1/images/generations",
				Method:        "POST",
				ProviderStyle: "openai-image",
				RequestFormat: "json",
				SDKMethod:     "aiApi.imageGenerations",
				Parameters:    map[string]CapabilityParameter{},
			},
			"image_to_image": {
				Supported:     true,
				Path:          "/v1/images/edits",
				Method:        "POST",
				ProviderStyle: "openai-image",
				RequestFormat: "multipart",
				SDKMethod:     "aiApi.imageEdits",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "image_to_image":
		return map[string]CapabilitySpec{
			"image_to_image": {
				Supported:     true,
				Path:          "/v1/images/edits",
				Method:        "POST",
				ProviderStyle: "openai-image",
				RequestFormat: "multipart",
				SDKMethod:     "aiApi.imageEdits",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case string(constant.EndpointTypeJimeng):
		return map[string]CapabilitySpec{
			"text_to_image": {
				Supported:     true,
				Path:          "/v1/images/generations",
				Method:        "POST",
				ProviderStyle: "jimeng",
				RequestFormat: "json",
				SDKMethod:     "aiApi.imageGenerations",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "text_to_video", string(constant.EndpointTypeVideoGeneration), string(constant.EndpointTypeOpenAIVideo):
		return map[string]CapabilitySpec{
			"text_to_video": {
				Supported:     true,
				Path:          "/v1/videos",
				Method:        "POST",
				ProviderStyle: "openai-video",
				Async:         true,
				RequestFormat: "json",
				SDKMethod:     "aiApi.videoGenerations",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "image_to_video":
		return map[string]CapabilitySpec{
			"image_to_video": {
				Supported:     true,
				Path:          "/v1/videos",
				Method:        "POST",
				ProviderStyle: "openai-video",
				Async:         true,
				RequestFormat: "json",
				SDKMethod:     "aiApi.videoGenerations",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case string(constant.EndpointTypeKling):
		return map[string]CapabilitySpec{
			"text_to_video": {
				Supported:     true,
				Path:          "/v1/videos",
				Method:        "POST",
				ProviderStyle: "kling",
				Async:         true,
				RequestFormat: "json",
				SDKMethod:     "aiApi.videoGenerations",
				Parameters:    map[string]CapabilityParameter{},
			},
			"image_to_video": {
				Supported:     true,
				Path:          "/v1/videos",
				Method:        "POST",
				ProviderStyle: "kling",
				Async:         true,
				RequestFormat: "json",
				SDKMethod:     "aiApi.videoGenerations",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "music_generation", string(constant.EndpointTypeSuno):
		return map[string]CapabilitySpec{
			"music_generation": {
				Supported:     true,
				Path:          "/suno/submit/{action}",
				Method:        "POST",
				ProviderStyle: "suno",
				RequestFormat: "json",
				SDKMethod:     "aiApi.submitTask",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "midjourney_generation", string(constant.EndpointTypeMidjourney):
		return map[string]CapabilitySpec{
			"midjourney_generation": {
				Supported:     true,
				Path:          "/mj/submit/imagine",
				Method:        "POST",
				ProviderStyle: "midjourney",
				RequestFormat: "json",
				SDKMethod:     "aiApi.submitTask",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case string(constant.EndpointTypeEmbeddings):
		return map[string]CapabilitySpec{
			"embeddings": {
				Supported:     true,
				Path:          "/v1/embeddings",
				Method:        "POST",
				ProviderStyle: "openai",
				RequestFormat: "json",
				SDKMethod:     "aiApi.embeddings",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "rerank", string(constant.EndpointTypeJinaRerank):
		return map[string]CapabilitySpec{
			"rerank": {
				Supported:     true,
				Path:          "/v1/rerank",
				Method:        "POST",
				ProviderStyle: "jina",
				RequestFormat: "json",
				SDKMethod:     "aiApi.rerank",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	case "realtime":
		return map[string]CapabilitySpec{
			"realtime": {
				Supported:     true,
				Path:          "/v1/realtime",
				Method:        "GET",
				ProviderStyle: "openai",
				RequestFormat: "websocket",
				SDKMethod:     "N/A",
				Parameters:    map[string]CapabilityParameter{},
			},
		}
	default:
		return map[string]CapabilitySpec{}
	}
}
