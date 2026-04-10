package common

import "testing"

func TestAudioAndModerationModelDetection(t *testing.T) {
	testCases := []struct {
		name     string
		model    string
		detectFn func(string) bool
	}{
		{name: "stt", model: "whisper-1", detectFn: IsSTTModel},
		{name: "tts", model: "tts-1-hd", detectFn: IsTTSModel},
		{name: "embedding", model: "text-embedding-3-large", detectFn: IsEmbeddingModel},
		{name: "moderation", model: "omni-moderation-latest", detectFn: IsModerationModel},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if !tc.detectFn(tc.model) {
				t.Fatalf("expected %q to be detected by %s", tc.model, tc.name)
			}
		})
	}
}

func TestGeminiNativeModelDetection(t *testing.T) {
	testCases := []struct {
		name     string
		model    string
		detectFn func(string) bool
	}{
		{name: "imagen", model: "imagen-3.0-generate-002", detectFn: IsImageGenerationModel},
		{name: "gemini embedding", model: "gemini-embedding-001", detectFn: IsEmbeddingModel},
		{name: "embedding prefix", model: "embedding-001", detectFn: IsEmbeddingModel},
		{name: "veo", model: "veo-2.0-generate-001", detectFn: IsVideoGenerationModel},
		{name: "sora", model: "sora", detectFn: IsVideoGenerationModel},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if !tc.detectFn(tc.model) {
				t.Fatalf("expected %q to be detected by %s", tc.model, tc.name)
			}
		})
	}
}

func TestAudioAndModerationModelDetectionRejectsChatModels(t *testing.T) {
	modelName := "gpt-4.1"
	if IsSTTModel(modelName) {
		t.Fatalf("did not expect %q to be detected as stt", modelName)
	}
	if IsTTSModel(modelName) {
		t.Fatalf("did not expect %q to be detected as tts", modelName)
	}
	if IsEmbeddingModel(modelName) {
		t.Fatalf("did not expect %q to be detected as embedding", modelName)
	}
	if IsModerationModel(modelName) {
		t.Fatalf("did not expect %q to be detected as moderation", modelName)
	}
	if IsVideoGenerationModel(modelName) {
		t.Fatalf("did not expect %q to be detected as video generation", modelName)
	}
}
