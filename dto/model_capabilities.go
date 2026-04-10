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
	"text_to_image":         {Endpoint: "/v1/images/generations", RequestFormat: "json", SDKMethod: "aiApi.imageGenerations"},
	"image_to_image":        {Endpoint: "/v1/images/edits", RequestFormat: "multipart", SDKMethod: "aiApi.imageEdits"},
	"embeddings":            {Endpoint: "/v1/embeddings", RequestFormat: "json", SDKMethod: "aiApi.embeddings"},
	"rerank":                {Endpoint: "/v1/rerank", RequestFormat: "json", SDKMethod: "aiApi.rerank"},
	"kling_video":           {Endpoint: "/v1/videos/generations", RequestFormat: "json", SDKMethod: "aiApi.submitTask", Async: true},
	"music_generation":      {Endpoint: "/suno/submit/{action}", RequestFormat: "json", SDKMethod: "aiApi.submitTask", Async: true},
	"midjourney_generation": {Endpoint: "/mj/submit/imagine", RequestFormat: "json", SDKMethod: "aiApi.submitTask", Async: true},
	"jimeng_image":          {Endpoint: "/v1/images/generations", RequestFormat: "json", SDKMethod: "aiApi.imageGenerations", Async: true},
	"realtime":              {Endpoint: "/v1/realtime", RequestFormat: "websocket", SDKMethod: "N/A"},
}

var endpointCapabilityDefs = map[constant.EndpointType]map[string]ModelCapability{
	constant.EndpointTypeOpenAIChat: {
		"chat": {Endpoint: "/v1/chat/completions", RequestFormat: "json", SDKMethod: "aiApi.chatCompletions"},
	},
	constant.EndpointTypeOpenAIResponse: {
		"chat": {Endpoint: "/v1/responses", RequestFormat: "json", SDKMethod: "aiApi.responses"},
	},
	constant.EndpointTypeOpenAIResponseCompact: {
		"chat": {Endpoint: "/v1/responses/compact", RequestFormat: "json", SDKMethod: "aiApi.responses"},
	},
	constant.EndpointTypeAnthropic: {
		"chat": {Endpoint: "/v1/messages", RequestFormat: "json", SDKMethod: "aiApi.messages"},
	},
	constant.EndpointTypeGemini: {
		"chat": {Endpoint: "/v1/chat/completions", RequestFormat: "json", SDKMethod: "aiApi.chatCompletions"},
	},
	constant.EndpointTypeOpenAISTT: {
		"speech_to_text": {Endpoint: "/v1/audio/transcriptions", RequestFormat: "multipart", SDKMethod: "aiApi.audioTranscriptions"},
	},
	constant.EndpointTypeOpenAITTS: {
		"text_to_speech": {Endpoint: "/v1/audio/speech", RequestFormat: "blob_response", SDKMethod: "aiApi.audioSpeech"},
	},
	constant.EndpointTypeOpenAIAudioTranslation: {
		"audio_translation": {Endpoint: "/v1/audio/translations", RequestFormat: "multipart", SDKMethod: "aiApi.audioTranslations"},
	},
	constant.EndpointTypeOpenAIModeration: {
		"moderation": {Endpoint: "/v1/moderations", RequestFormat: "json", SDKMethod: "aiApi.moderations"},
	},
	constant.EndpointTypeVideoGeneration: {
		"video_generation": {Endpoint: "/v1/videos/generations", RequestFormat: "json", SDKMethod: "aiApi.submitTask", Async: true},
	},
	constant.EndpointTypeOpenAIVideo: {
		"video_generation": {Endpoint: "/v1/chat/completions", RequestFormat: "json", SDKMethod: "aiApi.submitTask", Async: true},
	},
}

// endpointToCapabilities maps EndpointType to capability keys it implies.
var endpointToCapabilities = map[constant.EndpointType][]string{
	constant.EndpointTypeOpenAIChat:             {"chat"},
	constant.EndpointTypeOpenAISTT:              {"speech_to_text"},
	constant.EndpointTypeOpenAITTS:              {"text_to_speech"},
	constant.EndpointTypeOpenAIAudioTranslation: {"audio_translation"},
	constant.EndpointTypeOpenAIModeration:       {"moderation"},
	constant.EndpointTypeOpenAIResponse:         {"chat"},
	constant.EndpointTypeOpenAIResponseCompact:  {"chat"},
	constant.EndpointTypeAnthropic:              {"chat"},
	constant.EndpointTypeGemini:                 {"chat"},
	constant.EndpointTypeImageGeneration:        {"text_to_image", "image_to_image"},
	constant.EndpointTypeEmbeddings:             {"embeddings"},
	constant.EndpointTypeJinaRerank:             {"rerank"},
	constant.EndpointTypeVideoGeneration:        {"video_generation"},
	constant.EndpointTypeOpenAIVideo:            {"video_generation"},
	constant.EndpointTypeKling:                  {"kling_video"},
	constant.EndpointTypeSuno:                   {"music_generation"},
	constant.EndpointTypeMidjourney:             {"midjourney_generation"},
	constant.EndpointTypeJimeng:                 {"jimeng_image"},
}

func customEndpointKeyToCapabilities(key string) []string {
	switch key {
	case "text_to_image":
		return []string{"text_to_image"}
	case "image_to_image":
		return []string{"image_to_image"}
	case "image-generation":
		return []string{"text_to_image"}
	default:
		return endpointToCapabilities[constant.EndpointType(key)]
	}
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
	for _, et := range endpointTypes {
		keys, ok := endpointToCapabilities[et]
		if !ok {
			continue
		}
		for _, key := range keys {
			if !capKeys[key] {
				continue
			}
			def, ok := capabilityDefs[key]
			if endpointDefs, hasEndpointDefs := endpointCapabilityDefs[et]; hasEndpointDefs {
				if endpointDef, hasEndpointDef := endpointDefs[key]; hasEndpointDef {
					def = endpointDef
					ok = true
				}
			}
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
				if caps.Chat == nil {
					caps.Chat = cap
				}
			case "text_to_image":
				if caps.TextToImage == nil {
					caps.TextToImage = cap
				}
			case "image_to_image":
				if caps.ImageToImage == nil {
					caps.ImageToImage = cap
				}
			case "speech_to_text":
				if caps.SpeechToText == nil {
					caps.SpeechToText = cap
				}
			case "text_to_speech":
				if caps.TextToSpeech == nil {
					caps.TextToSpeech = cap
				}
			case "audio_translation":
				if caps.AudioTranslation == nil {
					caps.AudioTranslation = cap
				}
			case "embeddings":
				if caps.Embeddings == nil {
					caps.Embeddings = cap
				}
			case "video_generation":
				if caps.VideoGeneration == nil {
					caps.VideoGeneration = cap
				}
			case "kling_video":
				if caps.KlingVideo == nil {
					caps.KlingVideo = cap
				}
			case "moderation":
				if caps.Moderation == nil {
					caps.Moderation = cap
				}
			case "rerank":
				if caps.Rerank == nil {
					caps.Rerank = cap
				}
			case "music_generation":
				if caps.MusicGeneration == nil {
					caps.MusicGeneration = cap
				}
			case "midjourney_generation":
				if caps.MidjourneyGeneration == nil {
					caps.MidjourneyGeneration = cap
				}
			case "jimeng_image":
				if caps.JimengImage == nil {
					caps.JimengImage = cap
				}
			case "realtime":
				if caps.Realtime == nil {
					caps.Realtime = cap
				}
			}
			delete(capKeys, key)
		}
	}
	return caps
}

func BuildModelCapabilitiesByCustomEndpoints(customEndpointKeys []string, fallbackEndpointTypes []constant.EndpointType) *ModelCapabilities {
	if len(customEndpointKeys) == 0 {
		return BuildModelCapabilities(fallbackEndpointTypes)
	}

	capKeys := make(map[string]bool)
	for _, key := range customEndpointKeys {
		for _, capKey := range customEndpointKeyToCapabilities(key) {
			capKeys[capKey] = true
		}
	}
	if len(capKeys) == 0 {
		return BuildModelCapabilities(fallbackEndpointTypes)
	}

	caps := &ModelCapabilities{}
	for _, key := range []string{"chat", "text_to_image", "image_to_image", "speech_to_text", "text_to_speech", "audio_translation", "embeddings", "video_generation", "kling_video", "moderation", "rerank", "music_generation", "midjourney_generation", "jimeng_image", "realtime"} {
		if !capKeys[key] {
			continue
		}
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
