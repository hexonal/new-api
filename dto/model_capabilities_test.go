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
