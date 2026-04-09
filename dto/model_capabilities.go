package dto

import "github.com/QuantumNous/new-api/constant"

// ModelCapability describes a single model capability with its endpoint and request format.
type ModelCapability struct {
	Supported     bool   `json:"supported"`
	Async         bool   `json:"async,omitempty"`
	Endpoint      string `json:"endpoint"`
	RequestFormat string `json:"request_format"`
	SDKMethod     string `json:"sdk_method"`
}

// ModelCapabilities describes the full set of capabilities a model supports.
type ModelCapabilities struct {
	Chat                 *ModelCapability `json:"chat,omitempty"`
	TextToImage          *ModelCapability `json:"text_to_image,omitempty"`
	ImageToImage         *ModelCapability `json:"image_to_image,omitempty"`
	SpeechToText         *ModelCapability `json:"speech_to_text,omitempty"`
	TextToSpeech         *ModelCapability `json:"text_to_speech,omitempty"`
	AudioTranslation     *ModelCapability `json:"audio_translation,omitempty"`
	Embeddings           *ModelCapability `json:"embeddings,omitempty"`
	VideoGeneration      *ModelCapability `json:"video_generation,omitempty"`
	KlingVideo           *ModelCapability `json:"kling_video,omitempty"`
	MusicGeneration      *ModelCapability `json:"music_generation,omitempty"`
	MidjourneyGeneration *ModelCapability `json:"midjourney_generation,omitempty"`
	JimengImage          *ModelCapability `json:"jimeng_image,omitempty"`
	Moderation           *ModelCapability `json:"moderation,omitempty"`
	Rerank               *ModelCapability `json:"rerank,omitempty"`
	Realtime             *ModelCapability `json:"realtime,omitempty"`
}

// capabilityDef maps a capability key to its static endpoint info.
var capabilityDefs = map[string]ModelCapability{
	"chat":                  {Endpoint: "/v1/chat/completions", RequestFormat: "json", SDKMethod: "aiApi.chatCompletions"},
	"text_to_image":         {Endpoint: "/v1/images/generations", RequestFormat: "json", SDKMethod: "aiApi.imageGenerations"},
	"image_to_image":        {Endpoint: "/v1/images/edits", RequestFormat: "multipart", SDKMethod: "aiApi.imageEdits"},
	"speech_to_text":        {Endpoint: "/v1/audio/transcriptions", RequestFormat: "multipart", SDKMethod: "aiApi.audioTranscriptions"},
	"text_to_speech":        {Endpoint: "/v1/audio/speech", RequestFormat: "blob_response", SDKMethod: "aiApi.audioSpeech"},
	"audio_translation":     {Endpoint: "/v1/audio/translations", RequestFormat: "multipart", SDKMethod: "aiApi.audioTranslations"},
	"embeddings":            {Endpoint: "/v1/embeddings", RequestFormat: "json", SDKMethod: "aiApi.embeddings"},
	"moderation":            {Endpoint: "/v1/moderations", RequestFormat: "json", SDKMethod: "aiApi.moderations"},
	"rerank":                {Endpoint: "/v1/rerank", RequestFormat: "json", SDKMethod: "aiApi.rerank"},
	"video_generation":      {Endpoint: "/v1/chat/completions", RequestFormat: "json", SDKMethod: "aiApi.submitTask", Async: true},
	"kling_video":           {Endpoint: "/v1/videos/generations", RequestFormat: "json", SDKMethod: "aiApi.submitTask", Async: true},
	"music_generation":      {Endpoint: "/suno/submit/{action}", RequestFormat: "json", SDKMethod: "aiApi.submitTask", Async: true},
	"midjourney_generation": {Endpoint: "/mj/submit/imagine", RequestFormat: "json", SDKMethod: "aiApi.submitTask", Async: true},
	"jimeng_image":          {Endpoint: "/v1/images/generations", RequestFormat: "json", SDKMethod: "aiApi.imageGenerations", Async: true},
	"realtime":              {Endpoint: "/v1/realtime", RequestFormat: "websocket", SDKMethod: "N/A"},
}

// endpointToCapabilities maps EndpointType to capability keys it implies.
var endpointToCapabilities = map[constant.EndpointType][]string{
	constant.EndpointTypeOpenAI:                {"chat", "speech_to_text", "text_to_speech", "audio_translation", "moderation"},
	constant.EndpointTypeOpenAIResponse:        {"chat"},
	constant.EndpointTypeOpenAIResponseCompact: {"chat"},
	constant.EndpointTypeAnthropic:             {"chat"},
	constant.EndpointTypeGemini:                {"chat"},
	constant.EndpointTypeImageGeneration:       {"text_to_image", "image_to_image"},
	constant.EndpointTypeEmbeddings:            {"embeddings"},
	constant.EndpointTypeJinaRerank:            {"rerank"},
	constant.EndpointTypeOpenAIVideo:           {"video_generation"},
	constant.EndpointTypeKling:                 {"kling_video"},
	constant.EndpointTypeSuno:                  {"music_generation"},
	constant.EndpointTypeMidjourney:            {"midjourney_generation"},
	constant.EndpointTypeJimeng:                {"jimeng_image"},
}

// BuildModelCapabilities converts a list of EndpointTypes into a structured ModelCapabilities object.
func BuildModelCapabilities(endpointTypes []constant.EndpointType) *ModelCapabilities {
	if len(endpointTypes) == 0 {
		return nil
	}

	capKeys := make(map[string]bool)
	for _, et := range endpointTypes {
		if keys, ok := endpointToCapabilities[et]; ok {
			for _, k := range keys {
				capKeys[k] = true
			}
		}
	}

	if len(capKeys) == 0 {
		return nil
	}

	caps := &ModelCapabilities{}
	for key := range capKeys {
		def, ok := capabilityDefs[key]
		if !ok {
			continue
		}
		cap := &ModelCapability{
			Supported:     true,
			Async:         def.Async,
			Endpoint:      def.Endpoint,
			RequestFormat: def.RequestFormat,
			SDKMethod:     def.SDKMethod,
		}
		switch key {
		case "chat":
			caps.Chat = cap
		case "text_to_image":
			caps.TextToImage = cap
		case "image_to_image":
			caps.ImageToImage = cap
		case "speech_to_text":
			caps.SpeechToText = cap
		case "text_to_speech":
			caps.TextToSpeech = cap
		case "audio_translation":
			caps.AudioTranslation = cap
		case "embeddings":
			caps.Embeddings = cap
		case "video_generation":
			caps.VideoGeneration = cap
		case "kling_video":
			caps.KlingVideo = cap
		case "moderation":
			caps.Moderation = cap
		case "rerank":
			caps.Rerank = cap
		case "music_generation":
			caps.MusicGeneration = cap
		case "midjourney_generation":
			caps.MidjourneyGeneration = cap
		case "jimeng_image":
			caps.JimengImage = cap
		case "realtime":
			caps.Realtime = cap
		}
	}
	return caps
}
