package common

import "github.com/QuantumNous/new-api/constant"

func appendEndpointTypeIfMissing(endpointTypes []constant.EndpointType, endpointType constant.EndpointType) []constant.EndpointType {
	for _, existing := range endpointTypes {
		if existing == endpointType {
			return endpointTypes
		}
	}
	return append(endpointTypes, endpointType)
}

// GetEndpointTypesByChannelType 获取渠道最优先端点类型（所有的渠道都支持 OpenAI 端点）
func GetEndpointTypesByChannelType(channelType int, modelName string) []constant.EndpointType {
	var endpointTypes []constant.EndpointType
	switch channelType {
	case constant.ChannelTypeJina:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeJinaRerank}
	case constant.ChannelTypeMidjourney, constant.ChannelTypeMidjourneyPlus:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeMidjourney}
	case constant.ChannelTypeSunoAPI:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeSuno}
	case constant.ChannelTypeKling:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeKling}
	case constant.ChannelTypeJimeng:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeJimeng}
	case constant.ChannelTypeAws:
		fallthrough
	case constant.ChannelTypeAnthropic:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeAnthropic, constant.EndpointTypeOpenAIChat}
	case constant.ChannelTypeVertexAi:
		fallthrough
	case constant.ChannelTypeGemini:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeGemini, constant.EndpointTypeOpenAIChat}
	case constant.ChannelTypeOpenRouter: // OpenRouter 只支持 OpenAI 端点
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIChat}
	case constant.ChannelTypeXai:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIChat, constant.EndpointTypeOpenAIResponse}
	case constant.ChannelTypeVidu, constant.ChannelTypeDoubaoVideo, constant.ChannelTypePixVerse, constant.ChannelTypeReplicate:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeVideoGeneration}
	case constant.ChannelTypeSora:
		endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIVideo}
	default:
		if IsOpenAIResponseOnlyModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIResponse}
		} else if IsSTTModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAISTT}
		} else if IsTTSModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAITTS}
		} else if IsEmbeddingModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeEmbeddings}
		} else if IsModerationModel(modelName) {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIModeration}
		} else {
			endpointTypes = []constant.EndpointType{constant.EndpointTypeOpenAIChat}
		}
	}
	if IsImageGenerationModel(modelName) {
		// add to first
		endpointTypes = append([]constant.EndpointType{constant.EndpointTypeImageGeneration}, endpointTypes...)
	}
	if IsVideoGenerationModel(modelName) {
		endpointTypes = appendEndpointTypeIfMissing(endpointTypes, constant.EndpointTypeVideoGeneration)
	}
	if IsEmbeddingModel(modelName) {
		endpointTypes = appendEndpointTypeIfMissing(endpointTypes, constant.EndpointTypeEmbeddings)
	}
	return endpointTypes
}
