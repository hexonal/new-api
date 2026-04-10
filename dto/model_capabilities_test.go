package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestBuildModelCapabilitiesIncludesMusicGenerationForSuno(t *testing.T) {
	caps := BuildModelCapabilities([]constant.EndpointType{constant.EndpointTypeSuno})
	if caps == nil || caps.MusicGeneration == nil {
		t.Fatalf("expected suno endpoint type to expose music_generation capability")
	}
	if caps.MusicGeneration.Endpoint != "/suno/submit/{action}" {
		t.Fatalf("unexpected music_generation endpoint: %q", caps.MusicGeneration.Endpoint)
	}
	if !caps.MusicGeneration.Async {
		t.Fatalf("expected music_generation capability to be async")
	}
}

func TestBuildModelCapabilitiesIncludesMidjourneyGeneration(t *testing.T) {
	caps := BuildModelCapabilities([]constant.EndpointType{constant.EndpointTypeMidjourney})
	if caps == nil || caps.MidjourneyGeneration == nil {
		t.Fatalf("expected midjourney endpoint type to expose midjourney_generation capability")
	}
	if caps.MidjourneyGeneration.Endpoint != "/mj/submit/imagine" {
		t.Fatalf("unexpected midjourney_generation endpoint: %q", caps.MidjourneyGeneration.Endpoint)
	}
	if !caps.MidjourneyGeneration.Async {
		t.Fatalf("expected midjourney_generation capability to be async")
	}
}

func TestBuildModelCapabilitiesUsesAsyncTaskEntryForVideoGeneration(t *testing.T) {
	caps := BuildModelCapabilities([]constant.EndpointType{constant.EndpointTypeOpenAIVideo})
	if caps == nil || caps.VideoGeneration == nil {
		t.Fatalf("expected openai-video endpoint type to expose video_generation capability")
	}
	if caps.VideoGeneration.Endpoint != "/v1/chat/completions" {
		t.Fatalf("unexpected video_generation endpoint: %q", caps.VideoGeneration.Endpoint)
	}
	if caps.VideoGeneration.SDKMethod != "aiApi.submitTask" {
		t.Fatalf("unexpected video_generation sdk method: %q", caps.VideoGeneration.SDKMethod)
	}
	if !caps.VideoGeneration.Async {
		t.Fatalf("expected video_generation capability to be async")
	}
}

func TestBuildModelCapabilitiesIncludesKlingVideo(t *testing.T) {
	caps := BuildModelCapabilities([]constant.EndpointType{constant.EndpointTypeKling})
	if caps == nil || caps.KlingVideo == nil {
		t.Fatalf("expected kling endpoint type to expose kling_video capability")
	}
	if caps.KlingVideo.Endpoint != "/v1/videos/generations" {
		t.Fatalf("unexpected kling_video endpoint: %q", caps.KlingVideo.Endpoint)
	}
	if caps.KlingVideo.SDKMethod != "aiApi.submitTask" {
		t.Fatalf("unexpected kling_video sdk method: %q", caps.KlingVideo.SDKMethod)
	}
	if !caps.KlingVideo.Async {
		t.Fatalf("expected kling_video capability to be async")
	}
}

func TestBuildModelCapabilitiesIncludesJimengImage(t *testing.T) {
	caps := BuildModelCapabilities([]constant.EndpointType{constant.EndpointTypeJimeng})
	if caps == nil || caps.JimengImage == nil {
		t.Fatalf("expected jimeng endpoint type to expose jimeng_image capability")
	}
	if caps.JimengImage.Endpoint != "/v1/images/generations" {
		t.Fatalf("unexpected jimeng_image endpoint: %q", caps.JimengImage.Endpoint)
	}
	if caps.JimengImage.SDKMethod != "aiApi.imageGenerations" {
		t.Fatalf("unexpected jimeng_image sdk method: %q", caps.JimengImage.SDKMethod)
	}
	if !caps.JimengImage.Async {
		t.Fatalf("expected jimeng_image capability to be async")
	}
}

func TestBuildModelCapabilitiesUsesOpenAIChatOnlyForChatCapability(t *testing.T) {
	caps := BuildModelCapabilities([]constant.EndpointType{constant.EndpointTypeOpenAIChat})
	if caps == nil || caps.Chat == nil {
		t.Fatalf("expected openai-chat endpoint type to expose chat capability")
	}
	if caps.Chat.Endpoint != "/v1/chat/completions" {
		t.Fatalf("unexpected chat endpoint: %q", caps.Chat.Endpoint)
	}
	if caps.SpeechToText != nil || caps.TextToSpeech != nil || caps.AudioTranslation != nil || caps.Moderation != nil {
		t.Fatalf("expected openai-chat to expose only chat capability, got %#v", caps)
	}
}

func TestBuildModelCapabilitiesIncludesSplitOpenAIAudioAndModerationCapabilities(t *testing.T) {
	testCases := []struct {
		name      string
		endpoint  constant.EndpointType
		verifyCap func(*testing.T, *ModelCapabilities)
	}{
		{
			name:     "stt",
			endpoint: constant.EndpointTypeOpenAISTT,
			verifyCap: func(t *testing.T, caps *ModelCapabilities) {
				if caps.SpeechToText == nil || caps.SpeechToText.Endpoint != "/v1/audio/transcriptions" {
					t.Fatalf("unexpected stt capability: %#v", caps.SpeechToText)
				}
			},
		},
		{
			name:     "tts",
			endpoint: constant.EndpointTypeOpenAITTS,
			verifyCap: func(t *testing.T, caps *ModelCapabilities) {
				if caps.TextToSpeech == nil || caps.TextToSpeech.Endpoint != "/v1/audio/speech" {
					t.Fatalf("unexpected tts capability: %#v", caps.TextToSpeech)
				}
			},
		},
		{
			name:     "audio translation",
			endpoint: constant.EndpointTypeOpenAIAudioTranslation,
			verifyCap: func(t *testing.T, caps *ModelCapabilities) {
				if caps.AudioTranslation == nil || caps.AudioTranslation.Endpoint != "/v1/audio/translations" {
					t.Fatalf("unexpected audio_translation capability: %#v", caps.AudioTranslation)
				}
			},
		},
		{
			name:     "moderation",
			endpoint: constant.EndpointTypeOpenAIModeration,
			verifyCap: func(t *testing.T, caps *ModelCapabilities) {
				if caps.Moderation == nil || caps.Moderation.Endpoint != "/v1/moderations" {
					t.Fatalf("unexpected moderation capability: %#v", caps.Moderation)
				}
			},
		},
		{
			name:     "video generation",
			endpoint: constant.EndpointTypeVideoGeneration,
			verifyCap: func(t *testing.T, caps *ModelCapabilities) {
				if caps.VideoGeneration == nil || caps.VideoGeneration.Endpoint != "/v1/videos/generations" {
					t.Fatalf("unexpected video_generation capability: %#v", caps.VideoGeneration)
				}
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			caps := BuildModelCapabilities([]constant.EndpointType{tc.endpoint})
			if caps == nil {
				t.Fatalf("expected endpoint %q to expose capabilities", tc.endpoint)
			}
			tc.verifyCap(t, caps)
		})
	}
}

func TestBuildModelCapabilitiesUsesFirstEndpointTypeForChatDefinition(t *testing.T) {
	caps := BuildModelCapabilities([]constant.EndpointType{constant.EndpointTypeAnthropic, constant.EndpointTypeOpenAIChat})
	if caps == nil || caps.Chat == nil {
		t.Fatalf("expected anthropic/openai-chat endpoint types to expose chat capability")
	}
	if caps.Chat.Endpoint != "/v1/messages" {
		t.Fatalf("expected anthropic chat endpoint, got %q", caps.Chat.Endpoint)
	}
	if caps.Chat.SDKMethod != "aiApi.messages" {
		t.Fatalf("expected anthropic sdk method, got %q", caps.Chat.SDKMethod)
	}
}

func TestBuildModelCapabilitiesUsesResponsesDefinitionForOpenAIResponses(t *testing.T) {
	caps := BuildModelCapabilities([]constant.EndpointType{constant.EndpointTypeOpenAIResponse})
	if caps == nil || caps.Chat == nil {
		t.Fatalf("expected openai-response endpoint type to expose chat capability")
	}
	if caps.Chat.Endpoint != "/v1/responses" {
		t.Fatalf("expected openai responses endpoint, got %q", caps.Chat.Endpoint)
	}
	if caps.Chat.SDKMethod != "aiApi.responses" {
		t.Fatalf("expected openai responses sdk method, got %q", caps.Chat.SDKMethod)
	}
}
