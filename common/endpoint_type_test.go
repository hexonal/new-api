package common

import (
	"reflect"
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestGetEndpointTypesByChannelTypeIncludesSuno(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeSunoAPI, "suno-v4")
	if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeSuno {
		t.Fatalf("expected suno channel type to map to suno endpoint, got %#v", endpointTypes)
	}
}

func TestGetEndpointTypesByChannelTypeIncludesMidjourney(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeMidjourney, "midjourney")
	if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeMidjourney {
		t.Fatalf("expected midjourney channel type to map to midjourney endpoint, got %#v", endpointTypes)
	}
}

func TestGetEndpointTypesByChannelTypeIncludesMidjourneyPlus(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeMidjourneyPlus, "midjourney")
	if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeMidjourney {
		t.Fatalf("expected midjourney plus channel type to map to midjourney endpoint, got %#v", endpointTypes)
	}
}

func TestGetEndpointTypesByChannelTypeIncludesKling(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeKling, "kling-v2-master")
	if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeKling {
		t.Fatalf("expected kling channel type to map to kling endpoint, got %#v", endpointTypes)
	}
}

func TestGetEndpointTypesByChannelTypeIncludesJimeng(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeJimeng, "jimeng_high_aes_general_v21_L")
	if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeJimeng {
		t.Fatalf("expected jimeng channel type to map to jimeng endpoint, got %#v", endpointTypes)
	}
}

func TestGetEndpointTypesByChannelTypeUsesOpenAIChatFallbackForAnthropic(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeAnthropic, "claude-sonnet-4-5")
	if len(endpointTypes) != 2 {
		t.Fatalf("expected anthropic to expose two endpoint types, got %#v", endpointTypes)
	}
	if endpointTypes[0] != constant.EndpointTypeAnthropic || endpointTypes[1] != constant.EndpointTypeOpenAIChat {
		t.Fatalf("expected anthropic fallback to use openai-chat, got %#v", endpointTypes)
	}
}

func TestGetEndpointTypesByChannelTypeDetectsOpenAIAudioAndModerationModels(t *testing.T) {
	testCases := []struct {
		name        string
		modelName   string
		endpoint    constant.EndpointType
		channelType int
	}{
		{name: "stt", modelName: "whisper-1", endpoint: constant.EndpointTypeOpenAISTT},
		{name: "tts", modelName: "tts-1-hd", endpoint: constant.EndpointTypeOpenAITTS},
		{name: "embedding", modelName: "text-embedding-3-large", endpoint: constant.EndpointTypeEmbeddings},
		{name: "moderation", modelName: "omni-moderation-latest", endpoint: constant.EndpointTypeOpenAIModeration},
		{name: "response", modelName: "o3-pro", endpoint: constant.EndpointTypeOpenAIResponse},
		{name: "chat fallback", modelName: "gpt-4.1", endpoint: constant.EndpointTypeOpenAIChat},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			endpointTypes := GetEndpointTypesByChannelType(tc.channelType, tc.modelName)
			if len(endpointTypes) != 1 || endpointTypes[0] != tc.endpoint {
				t.Fatalf("expected model %q to map to %#v, got %#v", tc.modelName, tc.endpoint, endpointTypes)
			}
		})
	}
}

func TestGetEndpointTypesByChannelTypeUsesVideoGenerationForVideoChannels(t *testing.T) {
	channelTypes := []int{
		constant.ChannelTypeVidu,
		constant.ChannelTypeDoubaoVideo,
		constant.ChannelTypePixVerse,
		constant.ChannelTypeReplicate,
	}

	for _, channelType := range channelTypes {
		endpointTypes := GetEndpointTypesByChannelType(channelType, "generic-video-model")
		if len(endpointTypes) != 1 || endpointTypes[0] != constant.EndpointTypeVideoGeneration {
			t.Fatalf("expected video channel %d to map to video-generation, got %#v", channelType, endpointTypes)
		}
	}
}

func TestGetEndpointTypesByChannelTypeAddsGeminiNativeCapabilities(t *testing.T) {
	testCases := []struct {
		name      string
		modelName string
		expected  []constant.EndpointType
	}{
		{
			name:      "imagen",
			modelName: "imagen-3.0-generate-002",
			expected: []constant.EndpointType{
				constant.EndpointTypeImageGeneration,
				constant.EndpointTypeGemini,
				constant.EndpointTypeOpenAIChat,
			},
		},
		{
			name:      "veo",
			modelName: "veo-2.0-generate-001",
			expected: []constant.EndpointType{
				constant.EndpointTypeGemini,
				constant.EndpointTypeOpenAIChat,
				constant.EndpointTypeVideoGeneration,
			},
		},
		{
			name:      "embedding",
			modelName: "gemini-embedding-001",
			expected: []constant.EndpointType{
				constant.EndpointTypeGemini,
				constant.EndpointTypeOpenAIChat,
				constant.EndpointTypeEmbeddings,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeGemini, tc.modelName)
			if !reflect.DeepEqual(endpointTypes, tc.expected) {
				t.Fatalf("expected model %q to map to %#v, got %#v", tc.modelName, tc.expected, endpointTypes)
			}
		})
	}
}

func TestGetDefaultEndpointInfoIncludesSplitOpenAIEndpoints(t *testing.T) {
	testCases := []struct {
		name     string
		endpoint constant.EndpointType
		path     string
	}{
		{name: "openai-chat", endpoint: constant.EndpointTypeOpenAIChat, path: "/v1/chat/completions"},
		{name: "openai-stt", endpoint: constant.EndpointTypeOpenAISTT, path: "/v1/audio/transcriptions"},
		{name: "openai-tts", endpoint: constant.EndpointTypeOpenAITTS, path: "/v1/audio/speech"},
		{name: "openai-audio-translation", endpoint: constant.EndpointTypeOpenAIAudioTranslation, path: "/v1/audio/translations"},
		{name: "openai-moderation", endpoint: constant.EndpointTypeOpenAIModeration, path: "/v1/moderations"},
		{name: "video-generation", endpoint: constant.EndpointTypeVideoGeneration, path: "/v1/videos/generations"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			info, ok := GetDefaultEndpointInfo(tc.endpoint)
			if !ok {
				t.Fatalf("expected %q endpoint type to have default endpoint info", tc.endpoint)
			}
			if info.Path != tc.path {
				t.Fatalf("unexpected %q default path: %q", tc.endpoint, info.Path)
			}
			if info.Method != "POST" {
				t.Fatalf("unexpected %q default method: %q", tc.endpoint, info.Method)
			}
		})
	}
}

func TestGetDefaultEndpointInfoIncludesMidjourney(t *testing.T) {
	info, ok := GetDefaultEndpointInfo(constant.EndpointTypeMidjourney)
	if !ok {
		t.Fatalf("expected midjourney endpoint type to have default endpoint info")
	}
	if info.Path != "/mj/submit/imagine" {
		t.Fatalf("unexpected midjourney default path: %q", info.Path)
	}
	if info.Method != "POST" {
		t.Fatalf("unexpected midjourney default method: %q", info.Method)
	}
}

func TestGetDefaultEndpointInfoIncludesKling(t *testing.T) {
	info, ok := GetDefaultEndpointInfo(constant.EndpointTypeKling)
	if !ok {
		t.Fatalf("expected kling endpoint type to have default endpoint info")
	}
	if info.Path != "/v1/videos/generations" {
		t.Fatalf("unexpected kling default path: %q", info.Path)
	}
	if info.Method != "POST" {
		t.Fatalf("unexpected kling default method: %q", info.Method)
	}
}

func TestGetDefaultEndpointInfoIncludesJimeng(t *testing.T) {
	info, ok := GetDefaultEndpointInfo(constant.EndpointTypeJimeng)
	if !ok {
		t.Fatalf("expected jimeng endpoint type to have default endpoint info")
	}
	if info.Path != "/v1/images/generations" {
		t.Fatalf("unexpected jimeng default path: %q", info.Path)
	}
	if info.Method != "POST" {
		t.Fatalf("unexpected jimeng default method: %q", info.Method)
	}
}
