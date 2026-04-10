package constant

type EndpointType string

const (
	EndpointTypeOpenAIChat             EndpointType = "openai-chat"
	EndpointTypeOpenAISTT              EndpointType = "openai-stt"
	EndpointTypeOpenAITTS              EndpointType = "openai-tts"
	EndpointTypeOpenAIAudioTranslation EndpointType = "openai-audio-translation"
	EndpointTypeOpenAIModeration       EndpointType = "openai-moderation"
	EndpointTypeOpenAIResponse         EndpointType = "openai-response"
	EndpointTypeOpenAIResponseCompact  EndpointType = "openai-response-compact"
	EndpointTypeAnthropic              EndpointType = "anthropic"
	EndpointTypeGemini                 EndpointType = "gemini"
	EndpointTypeJinaRerank             EndpointType = "jina-rerank"
	EndpointTypeImageGeneration        EndpointType = "image-generation"
	EndpointTypeEmbeddings             EndpointType = "embeddings"
	EndpointTypeVideoGeneration        EndpointType = "video-generation"
	EndpointTypeOpenAIVideo            EndpointType = "openai-video"
	EndpointTypeMidjourney             EndpointType = "midjourney-proxy"
	EndpointTypeSuno                   EndpointType = "suno-proxy"
	EndpointTypeKling                  EndpointType = "kling"
	EndpointTypeJimeng                 EndpointType = "jimeng"
)
