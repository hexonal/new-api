package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel/ai360"
	"github.com/QuantumNous/new-api/relay/channel/lingyiwanwu"
	"github.com/QuantumNous/new-api/relay/channel/minimax"
	"github.com/QuantumNous/new-api/relay/channel/moonshot"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_capability"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

// https://platform.openai.com/docs/api-reference/models/list

var openAIModels []dto.OpenAIModels
var openAIModelsMap map[string]dto.OpenAIModels
var channelId2Models map[int][]string

type customModelPresentation struct {
	ownedBy  string
	provider string
	icon     string
	nsfw     bool
}

func init() {
	// https://platform.openai.com/docs/models/model-endpoint-compatibility
	for i := 0; i < constant.APITypeDummy; i++ {
		if i == constant.APITypeAIProxyLibrary {
			continue
		}
		adaptor := relay.GetAdaptor(i)
		channelName := adaptor.GetChannelName()
		modelNames := adaptor.GetModelList()
		for _, modelName := range modelNames {
			openAIModels = append(openAIModels, dto.OpenAIModels{
				Id:        modelName,
				Object:    "model",
				Created:   1626777600,
				OwnedBy:   channelName,
				Reasoning: isModelReasoningEnabled(modelName),
			})
		}
	}
	for _, modelName := range ai360.ModelList {
		openAIModels = append(openAIModels, dto.OpenAIModels{
			Id:        modelName,
			Object:    "model",
			Created:   1626777600,
			OwnedBy:   ai360.ChannelName,
			Reasoning: isModelReasoningEnabled(modelName),
		})
	}
	for _, modelName := range moonshot.ModelList {
		openAIModels = append(openAIModels, dto.OpenAIModels{
			Id:        modelName,
			Object:    "model",
			Created:   1626777600,
			OwnedBy:   moonshot.ChannelName,
			Reasoning: isModelReasoningEnabled(modelName),
		})
	}
	for _, modelName := range lingyiwanwu.ModelList {
		openAIModels = append(openAIModels, dto.OpenAIModels{
			Id:        modelName,
			Object:    "model",
			Created:   1626777600,
			OwnedBy:   lingyiwanwu.ChannelName,
			Reasoning: isModelReasoningEnabled(modelName),
		})
	}
	for _, modelName := range minimax.ModelList {
		openAIModels = append(openAIModels, dto.OpenAIModels{
			Id:        modelName,
			Object:    "model",
			Created:   1626777600,
			OwnedBy:   minimax.ChannelName,
			Reasoning: isModelReasoningEnabled(modelName),
		})
	}
	for modelName, _ := range constant.MidjourneyModel2Action {
		openAIModels = append(openAIModels, dto.OpenAIModels{
			Id:        modelName,
			Object:    "model",
			Created:   1626777600,
			OwnedBy:   "midjourney",
			Reasoning: isModelReasoningEnabled(modelName),
		})
	}
	for i := range openAIModels {
		if openAIModels[i].Provider == "" {
			openAIModels[i].Provider = openAIModels[i].OwnedBy
		}
		openAIModels[i].NSFW = isModelNSFWEnabled(openAIModels[i].Id)
	}
	openAIModelsMap = make(map[string]dto.OpenAIModels)
	for _, aiModel := range openAIModels {
		openAIModelsMap[aiModel.Id] = aiModel
	}
	channelId2Models = make(map[int][]string)
	for i := 1; i <= constant.ChannelTypeDummy; i++ {
		apiType, success := common.ChannelType2APIType(i)
		if !success || apiType == constant.APITypeAIProxyLibrary {
			continue
		}
		meta := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: i,
		}}
		adaptor := relay.GetAdaptor(apiType)
		adaptor.Init(meta)
		channelId2Models[i] = adaptor.GetModelList()
	}
	openAIModels = lo.UniqBy(openAIModels, func(m dto.OpenAIModels) string {
		return m.Id
	})
}

func ListModels(c *gin.Context, modelType int) {
	userOpenAiModels := make([]dto.OpenAIModels, 0)

	acceptUnsetRatioModel := operation_setting.SelfUseModeEnabled
	if !acceptUnsetRatioModel {
		userId := c.GetInt("id")
		if userId > 0 {
			userSettings, _ := model.GetUserSetting(userId, false)
			if userSettings.AcceptUnsetRatioModel {
				acceptUnsetRatioModel = true
			}
		}
	}

	modelLimitEnable := common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled)
	if modelLimitEnable {
		s, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
		var tokenModelLimit map[string]bool
		if ok {
			tokenModelLimit = s.(map[string]bool)
		} else {
			tokenModelLimit = map[string]bool{}
		}
		for allowModel, _ := range tokenModelLimit {
			if !acceptUnsetRatioModel {
				_, _, exist := ratio_setting.GetModelRatioOrPrice(allowModel)
				if !exist {
					continue
				}
			}
			if oaiModel, ok := openAIModelsMap[allowModel]; ok {
				supportedEndpointTypes, capabilities, icon := resolveModelCapabilities(allowModel)
				userOpenAiModels = append(
					userOpenAiModels,
					buildKnownModelResponse(oaiModel, allowModel, supportedEndpointTypes, capabilities, icon),
				)
			} else {
				supportedEndpointTypes, capabilities, icon := resolveModelCapabilities(allowModel)
				userOpenAiModels = append(
					userOpenAiModels,
					buildCustomModelResponse(allowModel, supportedEndpointTypes, capabilities, icon),
				)
			}
		}
	} else {
		userId := c.GetInt("id")
		userGroup, err := model.GetUserGroup(userId, false)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "get user group failed",
			})
			return
		}
		group := userGroup
		tokenGroup := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		if tokenGroup != "" {
			group = tokenGroup
		}
		var models []string
		if tokenGroup == "auto" {
			for _, autoGroup := range service.GetUserAutoGroup(userGroup) {
				groupModels := model.GetGroupEnabledModels(autoGroup)
				for _, g := range groupModels {
					if !common.StringsContains(models, g) {
						models = append(models, g)
					}
				}
			}
		} else {
			models = model.GetGroupEnabledModels(group)
		}
		for _, modelName := range models {
			if !acceptUnsetRatioModel {
				_, _, exist := ratio_setting.GetModelRatioOrPrice(modelName)
				if !exist {
					continue
				}
			}
			if oaiModel, ok := openAIModelsMap[modelName]; ok {
				supportedEndpointTypes, capabilities, icon := resolveModelCapabilities(modelName)
				userOpenAiModels = append(
					userOpenAiModels,
					buildKnownModelResponse(oaiModel, modelName, supportedEndpointTypes, capabilities, icon),
				)
			} else {
				supportedEndpointTypes, capabilities, icon := resolveModelCapabilities(modelName)
				userOpenAiModels = append(
					userOpenAiModels,
					buildCustomModelResponse(modelName, supportedEndpointTypes, capabilities, icon),
				)
			}
		}
	}

	switch modelType {
	case constant.ChannelTypeAnthropic:
		useranthropicModels := make([]dto.AnthropicModel, len(userOpenAiModels))
		for i, model := range userOpenAiModels {
			useranthropicModels[i] = dto.AnthropicModel{
				ID:          model.Id,
				CreatedAt:   time.Unix(int64(model.Created), 0).UTC().Format(time.RFC3339),
				DisplayName: model.Id,
				Type:        "model",
			}
		}
		c.JSON(200, gin.H{
			"data":     useranthropicModels,
			"first_id": useranthropicModels[0].ID,
			"has_more": false,
			"last_id":  useranthropicModels[len(useranthropicModels)-1].ID,
		})
	case constant.ChannelTypeGemini:
		userGeminiModels := make([]dto.GeminiModel, len(userOpenAiModels))
		for i, model := range userOpenAiModels {
			userGeminiModels[i] = dto.GeminiModel{
				Name:        model.Id,
				DisplayName: model.Id,
			}
		}
		c.JSON(200, gin.H{
			"models":        userGeminiModels,
			"nextPageToken": nil,
		})
	default:
		c.JSON(200, gin.H{
			"success": true,
			"data":    userOpenAiModels,
			"object":  "list",
		})
	}
}

func isModelReasoningEnabled(modelName string) bool {
	v, ok := model_capability.GetModelReasoning(modelName)
	return ok && v
}

func isModelFunctionCallingEnabled(modelName string) bool {
	v, ok := model_capability.GetModelFunctionCalling(modelName)
	return ok && v
}

func isModelNSFWEnabled(modelName string) bool {
	v, ok := model_capability.GetModelNSFW(modelName)
	return ok && v
}

func resolveModelCapabilities(modelName string) ([]constant.EndpointType, dto.CapabilityMap, string) {
	if model.DB == nil || modelName == "" {
		return []constant.EndpointType{}, dto.CapabilityMap{}, ""
	}

	var meta model.Model
	if err := model.DB.Select("endpoints", "icon").Where("model_name = ?", modelName).First(&meta).Error; err != nil {
		endpointTypes := model.GetModelSupportEndpointTypes(modelName)
		capabilities := dto.BuildCapabilityMapFromEndpointTypes(endpointTypes)
		return dto.SupportedEndpointTypes(capabilities), capabilities, ""
	}

	capabilities := dto.BuildCapabilityMapFromRawEndpoints(meta.GetParsedEndpoints())
	if len(capabilities) == 0 {
		endpointTypes := model.GetModelSupportEndpointTypes(modelName)
		capabilities = dto.BuildCapabilityMapFromEndpointTypes(endpointTypes)
	}

	return dto.SupportedEndpointTypes(capabilities), capabilities, meta.Icon
}

func buildKnownModelResponse(
	aiModel dto.OpenAIModels,
	modelName string,
	supportedEndpointTypes []constant.EndpointType,
	capabilities dto.CapabilityMap,
	icon string,
) dto.OpenAIModels {
	aiModel.SupportedEndpointTypes = supportedEndpointTypes
	aiModel.Reasoning = isModelReasoningEnabled(modelName)
	aiModel.FunctionCalling = isModelFunctionCallingEnabled(modelName)
	aiModel.Capabilities = capabilities
	aiModel.Icon = icon
	aiModel.NSFW = isModelNSFWEnabled(modelName)
	if aiModel.Provider == "" {
		aiModel.Provider = aiModel.OwnedBy
	}
	return aiModel
}

func buildCustomModelResponse(
	modelName string,
	supportedEndpointTypes []constant.EndpointType,
	capabilities dto.CapabilityMap,
	fallbackIcon string,
) dto.OpenAIModels {
	presentation := customModelPresentation{
		ownedBy:  "custom",
		provider: "custom",
		icon:     fallbackIcon,
		nsfw:     isModelNSFWEnabled(modelName),
	}
	if meta, ok := loadCustomModelMeta(modelName); ok {
		presentation = resolveCustomModelPresentation(meta, fallbackIcon)
	}
	return dto.OpenAIModels{
		Id:                     modelName,
		Object:                 "model",
		Created:                1626777600,
		OwnedBy:                presentation.ownedBy,
		Provider:               presentation.provider,
		Icon:                   presentation.icon,
		SupportedEndpointTypes: supportedEndpointTypes,
		Reasoning:              isModelReasoningEnabled(modelName),
		FunctionCalling:        isModelFunctionCallingEnabled(modelName),
		NSFW:                   presentation.nsfw,
		Capabilities:           capabilities,
	}
}

func loadCustomModelMeta(modelName string) (model.Model, bool) {
	if model.DB == nil || strings.TrimSpace(modelName) == "" {
		return model.Model{}, false
	}

	var meta model.Model
	err := model.DB.Select("model_name", "icon", "vendor_id").Where("model_name = ?", modelName).First(&meta).Error
	if err != nil {
		return model.Model{}, false
	}
	return meta, true
}

func resolveCustomModelPresentation(meta model.Model, fallbackIcon string) customModelPresentation {
	presentation := customModelPresentation{
		ownedBy:  "custom",
		provider: "custom",
		icon:     strings.TrimSpace(meta.Icon),
		nsfw:     isModelNSFWEnabled(meta.ModelName),
	}
	if presentation.icon == "" {
		presentation.icon = fallbackIcon
	}
	if meta.VendorID <= 0 || model.DB == nil {
		return presentation
	}

	vendor, err := model.GetVendorByID(meta.VendorID)
	if err != nil {
		return presentation
	}
	if name := strings.TrimSpace(vendor.Name); name != "" {
		presentation.ownedBy = name
		presentation.provider = name
	}
	if presentation.icon == "" {
		presentation.icon = strings.TrimSpace(vendor.Icon)
	}
	return presentation
}

func ChannelListModels(c *gin.Context) {
	c.JSON(200, gin.H{
		"success": true,
		"data":    openAIModels,
	})
}

func DashboardListModels(c *gin.Context) {
	c.JSON(200, gin.H{
		"success": true,
		"data":    channelId2Models,
	})
}

func EnabledListModels(c *gin.Context) {
	c.JSON(200, gin.H{
		"success": true,
		"data":    model.GetEnabledModels(),
	})
}

func RetrieveModel(c *gin.Context, modelType int) {
	modelId := c.Param("model")
	if aiModel, ok := openAIModelsMap[modelId]; ok {
		supportedEndpointTypes, capabilities, icon := resolveModelCapabilities(modelId)
		aiModel = buildKnownModelResponse(aiModel, modelId, supportedEndpointTypes, capabilities, icon)
		switch modelType {
		case constant.ChannelTypeAnthropic:
			c.JSON(200, dto.AnthropicModel{
				ID:          aiModel.Id,
				CreatedAt:   time.Unix(int64(aiModel.Created), 0).UTC().Format(time.RFC3339),
				DisplayName: aiModel.Id,
				Type:        "model",
			})
		default:
			c.JSON(200, aiModel)
		}
		return
	}

	if _, ok := loadCustomModelMeta(modelId); ok {
		supportedEndpointTypes, capabilities, icon := resolveModelCapabilities(modelId)
		c.JSON(200, buildCustomModelResponse(modelId, supportedEndpointTypes, capabilities, icon))
	} else {
		openAIError := types.OpenAIError{
			Message: fmt.Sprintf("The model '%s' does not exist", modelId),
			Type:    "invalid_request_error",
			Param:   "model",
			Code:    "model_not_found",
		}
		c.JSON(200, gin.H{
			"error": openAIError,
		})
	}
}
