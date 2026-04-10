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

// PublicCapabilitySpec is the lightweight capability payload exposed by /v1/models.
type PublicCapabilitySpec struct {
	Supported     bool   `json:"supported"`
	Endpoint      string `json:"endpoint"`
	RequestFormat string `json:"request_format"`
	SDKMethod     string `json:"sdk_method"`
}

// PublicCapabilityMap stores public capability payload keyed by capability name.
type PublicCapabilityMap map[string]PublicCapabilitySpec

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

func ToPublicCapabilityMap(capabilities CapabilityMap) PublicCapabilityMap {
	if len(capabilities) == 0 {
		return PublicCapabilityMap{}
	}

	result := make(PublicCapabilityMap, len(capabilities))
	for key, capability := range capabilities {
		result[key] = PublicCapabilitySpec{
			Supported:     capability.Supported,
			Endpoint:      capability.Endpoint,
			RequestFormat: capability.RequestFormat,
			SDKMethod:     capability.SDKMethod,
		}
	}
	return result
}

func parseCapabilitySpec(capabilityKey string, raw json.RawMessage) (CapabilitySpec, bool) {
	if len(raw) == 0 {
		return CapabilitySpec{}, false
	}

	var spec CapabilitySpec
	if err := json.Unmarshal(raw, &spec); err != nil {
		return parseLegacyCapabilitySpec(capabilityKey, raw)
	}
	if spec.Endpoint == "" && spec.RequestFormat == "" && spec.SDKMethod == "" {
		return parseLegacyCapabilitySpec(capabilityKey, raw)
	}
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
		Endpoint:      inferEndpoint(capabilityKey, legacy.Path),
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

func inferEndpoint(capabilityKey string, legacyPath string) string {
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
				Endpoint:      "/v1/chat/completions",
				RequestFormat: "json",
				SDKMethod:     "aiApi.chatCompletions",
			},
		}
	case "speech_to_text", string(constant.EndpointTypeOpenAISTT):
		return map[string]CapabilitySpec{
			"speech_to_text": {
				Supported:     true,
				Endpoint:      "/v1/audio/transcriptions",
				RequestFormat: "multipart",
				SDKMethod:     "aiApi.audioTranscriptions",
			},
		}
	case "text_to_speech", string(constant.EndpointTypeOpenAITTS):
		return map[string]CapabilitySpec{
			"text_to_speech": {
				Supported:     true,
				Endpoint:      "/v1/audio/speech",
				RequestFormat: "blob_response",
				SDKMethod:     "aiApi.audioSpeech",
			},
		}
	case "audio_translation", string(constant.EndpointTypeOpenAIAudioTranslation):
		return map[string]CapabilitySpec{
			"audio_translation": {
				Supported:     true,
				Endpoint:      "/v1/audio/translations",
				RequestFormat: "multipart",
				SDKMethod:     "aiApi.audioTranslations",
			},
		}
	case "moderation", string(constant.EndpointTypeOpenAIModeration):
		return map[string]CapabilitySpec{
			"moderation": {
				Supported:     true,
				Endpoint:      "/v1/moderations",
				RequestFormat: "json",
				SDKMethod:     "aiApi.moderations",
			},
		}
	case "text_to_image", string(constant.EndpointTypeImageGeneration):
		return map[string]CapabilitySpec{
			"text_to_image": {
				Supported:     true,
				Endpoint:      "/v1/images/generations",
				RequestFormat: "json",
				SDKMethod:     "aiApi.imageGenerations",
			},
			"image_to_image": {
				Supported:     true,
				Endpoint:      "/v1/images/edits",
				RequestFormat: "multipart",
				SDKMethod:     "aiApi.imageEdits",
			},
		}
	case "image_to_image":
		return map[string]CapabilitySpec{
			"image_to_image": {
				Supported:     true,
				Endpoint:      "/v1/images/edits",
				RequestFormat: "multipart",
				SDKMethod:     "aiApi.imageEdits",
			},
		}
	case string(constant.EndpointTypeJimeng):
		return map[string]CapabilitySpec{
			"text_to_image": {
				Supported:     true,
				Endpoint:      "/v1/images/generations",
				RequestFormat: "json",
				SDKMethod:     "aiApi.imageGenerations",
			},
		}
	case "text_to_video", string(constant.EndpointTypeVideoGeneration), string(constant.EndpointTypeOpenAIVideo):
		return map[string]CapabilitySpec{
			"text_to_video": {
				Supported:     true,
				Endpoint:      "/v1/videos",
				RequestFormat: "json",
				SDKMethod:     "aiApi.videoGenerations",
			},
		}
	case "image_to_video":
		return map[string]CapabilitySpec{
			"image_to_video": {
				Supported:     true,
				Endpoint:      "/v1/videos",
				RequestFormat: "json",
				SDKMethod:     "aiApi.videoGenerations",
			},
		}
	case string(constant.EndpointTypeKling):
		return map[string]CapabilitySpec{
			"text_to_video": {
				Supported:     true,
				Endpoint:      "/v1/videos",
				RequestFormat: "json",
				SDKMethod:     "aiApi.videoGenerations",
			},
			"image_to_video": {
				Supported:     true,
				Endpoint:      "/v1/videos",
				RequestFormat: "json",
				SDKMethod:     "aiApi.videoGenerations",
			},
		}
	case "music_generation", string(constant.EndpointTypeSuno):
		return map[string]CapabilitySpec{
			"music_generation": {
				Supported:     true,
				Endpoint:      "/suno/submit/{action}",
				RequestFormat: "json",
				SDKMethod:     "aiApi.submitTask",
			},
		}
	case "midjourney_generation", string(constant.EndpointTypeMidjourney):
		return map[string]CapabilitySpec{
			"midjourney_generation": {
				Supported:     true,
				Endpoint:      "/mj/submit/imagine",
				RequestFormat: "json",
				SDKMethod:     "aiApi.submitTask",
			},
		}
	case string(constant.EndpointTypeEmbeddings):
		return map[string]CapabilitySpec{
			"embeddings": {
				Supported:     true,
				Endpoint:      "/v1/embeddings",
				RequestFormat: "json",
				SDKMethod:     "aiApi.embeddings",
			},
		}
	case "rerank", string(constant.EndpointTypeJinaRerank):
		return map[string]CapabilitySpec{
			"rerank": {
				Supported:     true,
				Endpoint:      "/v1/rerank",
				RequestFormat: "json",
				SDKMethod:     "aiApi.rerank",
			},
		}
	case "realtime":
		return map[string]CapabilitySpec{
			"realtime": {
				Supported:     true,
				Endpoint:      "/v1/realtime",
				RequestFormat: "websocket",
				SDKMethod:     "N/A",
			},
		}
	default:
		return map[string]CapabilitySpec{}
	}
}
