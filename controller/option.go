package controller

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var completionRatioMetaOptionKeys = []string{
	"ModelPrice",
	"ModelRatio",
	"CompletionRatio",
	"CacheRatio",
	"CreateCacheRatio",
	"ImageRatio",
	"AudioRatio",
	"AudioCompletionRatio",
}

var groupPricingUpdateMutex sync.Mutex

func collectModelNamesFromOptionValue(raw string, modelNames map[string]struct{}) {
	if strings.TrimSpace(raw) == "" {
		return
	}

	var parsed map[string]any
	if err := common.UnmarshalJsonStr(raw, &parsed); err != nil {
		return
	}

	for modelName := range parsed {
		modelNames[modelName] = struct{}{}
	}
}

func buildCompletionRatioMetaValue(optionValues map[string]string) string {
	modelNames := make(map[string]struct{})
	for _, key := range completionRatioMetaOptionKeys {
		collectModelNamesFromOptionValue(optionValues[key], modelNames)
	}

	meta := make(map[string]ratio_setting.CompletionRatioInfo, len(modelNames))
	for modelName := range modelNames {
		meta[modelName] = ratio_setting.GetCompletionRatioInfo(modelName)
	}

	jsonBytes, err := common.Marshal(meta)
	if err != nil {
		return "{}"
	}
	return string(jsonBytes)
}

func validateGroupAbilitiesInTx(tx *gorm.DB, group string, modelNames []string) error {
	if tx == nil {
		return fmt.Errorf("transaction is nil")
	}
	if strings.TrimSpace(group) == "" {
		return fmt.Errorf("group is empty")
	}
	missing := make([]string, 0)
	for _, modelName := range modelNames {
		name := strings.TrimSpace(modelName)
		if name == "" {
			continue
		}
		var cnt int64
		if err := tx.Model(&model.Ability{}).
			Where(model.CommonGroupCol()+" = ? AND model = ? AND enabled = ?", group, name, true).
			Count(&cnt).Error; err != nil {
			return fmt.Errorf("validate ability for model %s: %w", name, err)
		}
		if cnt == 0 {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("group %s has no enabled ability for models: %s", group, strings.Join(missing, ", "))
	}
	return nil
}

func GetOptions(c *gin.Context) {
	var options []*model.Option
	optionValues := make(map[string]string)
	common.OptionMapRWMutex.Lock()
	for k, v := range common.OptionMap {
		value := common.Interface2String(v)
		if strings.HasSuffix(k, "Token") ||
			strings.HasSuffix(k, "Secret") ||
			strings.HasSuffix(k, "Key") ||
			strings.HasSuffix(k, "secret") ||
			strings.HasSuffix(k, "api_key") {
			continue
		}
		options = append(options, &model.Option{
			Key:   k,
			Value: value,
		})
		for _, optionKey := range completionRatioMetaOptionKeys {
			if optionKey == k {
				optionValues[k] = value
				break
			}
		}
	}
	common.OptionMapRWMutex.Unlock()
	options = append(options, &model.Option{
		Key:   "CompletionRatioMeta",
		Value: buildCompletionRatioMetaValue(optionValues),
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    options,
	})
	return
}

type OptionUpdateRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

type GroupPricingUpdateRequest struct {
	Group       string             `json:"group"`
	BaseRatio   float64            `json:"base_ratio"`
	ModelRatios map[string]float64 `json:"model_ratios"`
	Delete      bool               `json:"delete"`
}

func UpdateGroupPricingOption(c *gin.Context) {
	// 1. Parse request
	var req GroupPricingUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	req.Group = strings.TrimSpace(req.Group)
	if req.Group == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "分组不能为空",
		})
		return
	}
	if req.BaseRatio < 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "分组倍率不能小于 0",
		})
		return
	}

	upsertOptionInTx := func(tx *gorm.DB, key string, value string) error {
		option := model.Option{Key: key}
		if err := tx.FirstOrCreate(&option, model.Option{Key: key}).Error; err != nil {
			return err
		}
		option.Value = value
		return tx.Save(&option).Error
	}

	buildSpecialUsableGroupJSON := func(targetGroup string, deleting bool, groupRatio map[string]float64) (string, error) {
		current := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.ReadAll()
		next := make(map[string]map[string]string, len(current))
		for g, rules := range current {
			copied := make(map[string]string, len(rules))
			for k, v := range rules {
				copied[k] = v
			}
			next[g] = copied
		}

		if deleting {
			delete(next, targetGroup)
		} else {
			specialMap := make(map[string]string)
			for otherGroup := range groupRatio {
				if otherGroup != targetGroup {
					specialMap["-:"+otherGroup] = ""
				}
			}
			specialMap["+:"+targetGroup] = targetGroup
			next[targetGroup] = specialMap
			for otherGroup, otherRules := range next {
				if otherGroup != targetGroup {
					if _, has := otherRules["-:"+targetGroup]; !has {
						otherRules["-:"+targetGroup] = ""
					}
					next[otherGroup] = otherRules
				}
			}
		}

		data, err := common.Marshal(next)
		if err != nil {
			return "", err
		}
		return string(data), nil
	}

	// 2. Acquire global distributed lock (protects GroupRatio JSON read-modify-write)
	lockKey := "lock:group_pricing_global"
	token, lockErr := common.AcquireLock(lockKey, 30*time.Second)
	if lockErr != nil {
		if common.RedisEnabled {
			// Redis available but lock held by another request — reject
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"message": "分组配置正在被编辑，请稍后重试",
			})
			return
		}
		// Redis unavailable — use local mutex as fallback (single-node only)
		groupPricingUpdateMutex.Lock()
		defer groupPricingUpdateMutex.Unlock()
	} else {
		defer func() { _ = common.ReleaseLock(lockKey, token) }()
	}

	// 3. Handle delete — full reverse sync
	if req.Delete {
		if req.Group == "default" {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "不能删除 default 分组"})
			return
		}

		// Check if any users are bound to this group
		var boundUsers []model.User
		if err := model.DB.Select("id, username").Where(model.CommonGroupCol()+" = ?", req.Group).Find(&boundUsers).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("查询分组用户失败: %v", err)})
			return
		}
		if len(boundUsers) > 0 {
			names := make([]string, 0, len(boundUsers))
			for _, u := range boundUsers {
				names = append(names, u.Username)
			}
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": fmt.Sprintf("该分组下仍有 %d 个用户（%s），请先将用户迁移到其他分组后再删除", len(boundUsers), strings.Join(names, ", ")),
			})
			return
		}

		// Check if any tokens are bound to this group
		var boundTokens []model.Token
		if err := model.DB.Select("id, name, user_id").Where(model.CommonGroupCol()+" = ?", req.Group).Find(&boundTokens).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("查询分组令牌失败: %v", err)})
			return
		}
		if len(boundTokens) > 0 {
			names := make([]string, 0, len(boundTokens))
			for _, t := range boundTokens {
				names = append(names, t.Name)
			}
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": fmt.Sprintf("该分组下仍有 %d 个令牌（%s），请先将令牌迁移到其他分组后再删除", len(boundTokens), strings.Join(names, ", ")),
			})
			return
		}

		groupRatio := ratio_setting.GetGroupRatioCopy()
		delete(groupRatio, req.Group)
		groupModelRatio := ratio_setting.GetGroupModelRatioCopy()
		delete(groupModelRatio, req.Group)
		grBytes, _ := common.Marshal(groupRatio)
		gmrBytes, _ := common.Marshal(groupModelRatio)
		grStr, gmrStr := string(grBytes), string(gmrBytes)

		uug := setting.GetUserUsableGroupsCopy()
		delete(uug, req.Group)
		uugBytes, _ := common.Marshal(uug)
		uugStr := string(uugBytes)
		gsugStr, err := buildSpecialUsableGroupJSON(req.Group, true, groupRatio)
		if err != nil {
			common.ApiError(c, err)
			return
		}

		err = model.DB.Transaction(func(tx *gorm.DB) error {
			if err := upsertOptionInTx(tx, "GroupRatio", grStr); err != nil {
				return err
			}
			if err := upsertOptionInTx(tx, "GroupModelRatio", gmrStr); err != nil {
				return err
			}
			if err := upsertOptionInTx(tx, "UserUsableGroups", uugStr); err != nil {
				return err
			}
			if err := upsertOptionInTx(tx, "group_ratio_setting.group_special_usable_group", gsugStr); err != nil {
				return err
			}
			if err := model.RemoveGroupFromChannels(tx, req.Group); err != nil {
				return err
			}
			if err := model.SyncAbilitiesForGroup(req.Group, nil, tx); err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if err := model.RefreshRuntimeCaches(); err != nil {
			common.ApiError(c, err)
			return
		}
		if err := model.BroadcastRuntimeCacheRefreshSignal(); err != nil {
			common.SysLog(fmt.Sprintf("broadcast runtime cache refresh failed: %v", err))
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    gin.H{"group_ratio": groupRatio, "group_model_ratio": groupModelRatio},
		})
		return
	}

	// 4. Build new ratio maps (save path)
	groupRatio := ratio_setting.GetGroupRatioCopy()
	groupRatio[req.Group] = req.BaseRatio

	groupModelRatio := ratio_setting.GetGroupModelRatioCopy()
	if len(req.ModelRatios) == 0 {
		delete(groupModelRatio, req.Group)
	} else {
		sanitized := make(map[string]float64, len(req.ModelRatios))
		for modelName, ratio := range req.ModelRatios {
			name := strings.TrimSpace(modelName)
			if name == "" {
				continue
			}
			if ratio < 0 {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "模型倍率不能小于 0: " + name,
				})
				return
			}
			sanitized[name] = ratio
		}
		if len(sanitized) == 0 {
			delete(groupModelRatio, req.Group)
		} else {
			groupModelRatio[req.Group] = sanitized
		}
	}

	groupRatioBytes, err := common.Marshal(groupRatio)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groupRatioStr := string(groupRatioBytes)
	if err = ratio_setting.CheckGroupRatio(groupRatioStr); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	groupModelRatioBytes, err := common.Marshal(groupModelRatio)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groupModelRatioStr := string(groupModelRatioBytes)

	uug := setting.GetUserUsableGroupsCopy()
	if _, exists := uug[req.Group]; !exists {
		uug[req.Group] = req.Group
	}
	uugBytes, _ := common.Marshal(uug)
	uugStr := string(uugBytes)
	gsugStr, err := buildSpecialUsableGroupJSON(req.Group, false, groupRatio)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Step 4: Sync channels.group — add this group to channels that serve the models
	modelNames := make([]string, 0)
	if modelRatios, ok := groupModelRatio[req.Group]; ok {
		for modelName := range modelRatios {
			modelNames = append(modelNames, modelName)
		}
	}

	err = model.DB.Transaction(func(tx *gorm.DB) error {
		if err := upsertOptionInTx(tx, "GroupRatio", groupRatioStr); err != nil {
			return err
		}
		if err := upsertOptionInTx(tx, "GroupModelRatio", groupModelRatioStr); err != nil {
			return err
		}
		if err := upsertOptionInTx(tx, "UserUsableGroups", uugStr); err != nil {
			return err
		}
		if err := upsertOptionInTx(tx, "group_ratio_setting.group_special_usable_group", gsugStr); err != nil {
			return err
		}
		if err := model.SyncChannelGroupForPricing(tx, req.Group, modelNames); err != nil {
			return err
		}
		if err := model.SyncAbilitiesForGroup(req.Group, modelNames, tx); err != nil {
			return err
		}
		if err := validateGroupAbilitiesInTx(tx, req.Group, modelNames); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if err := model.RefreshRuntimeCaches(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.BroadcastRuntimeCacheRefreshSignal(); err != nil {
		common.SysLog(fmt.Sprintf("broadcast runtime cache refresh failed: %v", err))
	}
	// Refresh channel routing cache after abilities/channels.group changed
	model.InitChannelCacheAndBroadcast()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"group_ratio":       groupRatio,
			"group_model_ratio": groupModelRatio,
		},
	})
}

func UpdateOption(c *gin.Context) {
	var option OptionUpdateRequest
	err := common.DecodeJson(c.Request.Body, &option)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	switch option.Value.(type) {
	case bool:
		option.Value = common.Interface2String(option.Value.(bool))
	case float64:
		option.Value = common.Interface2String(option.Value.(float64))
	case int:
		option.Value = common.Interface2String(option.Value.(int))
	default:
		option.Value = fmt.Sprintf("%v", option.Value)
	}
	switch option.Key {
	case "GitHubOAuthEnabled":
		if option.Value == "true" && common.GitHubClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 GitHub OAuth，请先填入 GitHub Client Id 以及 GitHub Client Secret！",
			})
			return
		}
	case "discord.enabled":
		if option.Value == "true" && system_setting.GetDiscordSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Discord OAuth，请先填入 Discord Client Id 以及 Discord Client Secret！",
			})
			return
		}
	case "oidc.enabled":
		if option.Value == "true" && system_setting.GetOIDCSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 OIDC 登录，请先填入 OIDC Client Id 以及 OIDC Client Secret！",
			})
			return
		}
	case "LinuxDOOAuthEnabled":
		if option.Value == "true" && common.LinuxDOClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 LinuxDO OAuth，请先填入 LinuxDO Client Id 以及 LinuxDO Client Secret！",
			})
			return
		}
	case "EmailDomainRestrictionEnabled":
		if option.Value == "true" && len(common.EmailDomainWhitelist) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用邮箱域名限制，请先填入限制的邮箱域名！",
			})
			return
		}
	case "WeChatAuthEnabled":
		if option.Value == "true" && common.WeChatServerAddress == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用微信登录，请先填入微信登录相关配置信息！",
			})
			return
		}
	case "TurnstileCheckEnabled":
		if option.Value == "true" && common.TurnstileSiteKey == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Turnstile 校验，请先填入 Turnstile 校验相关配置信息！",
			})

			return
		}
	case "TelegramOAuthEnabled":
		if option.Value == "true" && common.TelegramBotToken == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Telegram OAuth，请先填入 Telegram Bot Token！",
			})
			return
		}
	case "GroupRatio":
		err = ratio_setting.CheckGroupRatio(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "MarketplaceDefaultPricingGroup":
		group := strings.TrimSpace(option.Value.(string))
		option.Value = group
		if group != "" {
			groupRatio := ratio_setting.GetGroupRatioCopy()
			if _, ok := groupRatio[group]; !ok {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": fmt.Sprintf("默认价格分组不存在: %s", group),
				})
				return
			}
		}
	case "ImageRatio":
		err = ratio_setting.UpdateImageRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "图片倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioRatio":
		err = ratio_setting.UpdateAudioRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioCompletionRatio":
		err = ratio_setting.UpdateAudioCompletionRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频补全倍率设置失败: " + err.Error(),
			})
			return
		}
	case "CreateCacheRatio":
		err = ratio_setting.UpdateCreateCacheRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "缓存创建倍率设置失败: " + err.Error(),
			})
			return
		}
	case "ModelRequestRateLimitGroup":
		err = setting.CheckModelRequestRateLimitGroup(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "AutomaticDisableStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "AutomaticRetryStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.api_info":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "ApiInfo")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.announcements":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "Announcements")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.faq":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "FAQ")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.uptime_kuma_groups":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "UptimeKumaGroups")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "ConsumeCallbackUserPrefixFilter", "OperatorCallbackUserPrefixFilter":
		// Username prefix filter is parsed in service layer.
		// Separator supports comma/newline and matching is case-sensitive by design.
	}
	err = model.UpdateOption(option.Key, option.Value.(string))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}
