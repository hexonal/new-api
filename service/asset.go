package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/asset_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

const defaultAssetModel = "ima-pro-upload"

func resolveAssetBillingGroups(token *model.Token, userGroup string) (string, string) {
	group := strings.TrimSpace(userGroup)
	if group == "" && token != nil {
		group = strings.TrimSpace(token.Group)
	}
	if group == "" {
		group = "default"
	}
	return group, group
}

func resolveAssetUID(userID int, userName string) (string, error) {
	uid := strings.TrimSpace(userName)
	if uid != "" {
		return uid, nil
	}
	if userID <= 0 {
		return "", errors.New("asset uid resolve failed: invalid user id")
	}
	name, err := model.GetUsernameById(userID, false)
	if err != nil {
		return "", err
	}
	uid = strings.TrimSpace(name)
	if uid == "" {
		return "", errors.New("asset uid resolve failed: username is empty")
	}
	return uid, nil
}

// isAssetChannelReady checks that a channel has both a non-empty base_url and a non-empty key.
func isAssetChannelReady(ch *model.Channel) bool {
	if ch == nil {
		return false
	}
	if ch.BaseURL == nil || strings.TrimSpace(*ch.BaseURL) == "" {
		return false
	}
	return strings.TrimSpace(ch.Key) != ""
}

// channelHasModel checks whether the channel's models list contains the given model name.
func channelHasModel(ch *model.Channel, modelName string) bool {
	if ch == nil || modelName == "" {
		return false
	}
	for _, m := range strings.Split(ch.Models, ",") {
		if strings.TrimSpace(m) == modelName {
			return true
		}
	}
	return false
}

// resolveAssetModel returns the effective model name: uses the provided model if non-empty, otherwise defaults.
func resolveAssetModel(reqModel string) string {
	if strings.TrimSpace(reqModel) != "" {
		return strings.TrimSpace(reqModel)
	}
	return defaultAssetModel
}

// checkAssetModelPermission verifies that the user's group has the given model in the abilities table.
func checkAssetModelPermission(group string, assetModel string) error {
	var count int64
	groupCol := model.CommonGroupCol()
	err := model.DB.Model(&model.Ability{}).
		Where(groupCol+" = ? AND model = ? AND enabled = ?", group, assetModel, true).
		Limit(1).Count(&count).Error
	if err != nil {
		return fmt.Errorf("permission check error: %w", err)
	}
	if count == 0 {
		return fmt.Errorf("model %s is not available for your group", assetModel)
	}
	return nil
}

// getAssetChannelByModel deterministically selects a type=60 (ImaPro) channel.
//
// Behaviour:
//   - modelExplicit=true (caller passed model): find a type=60 channel whose models list
//     contains assetModel, highest priority wins.
//   - modelExplicit=false (no model passed): use the first ready type=60 channel (highest priority).
//
// Permission is checked separately via checkAssetModelPermission before calling this.
func getAssetChannelByModel(assetModel string, modelExplicit bool) (*model.Channel, error) {
	// type=60 channels are very few (typically 1-3), query is trivially cheap.
	var candidates []*model.Channel
	err := model.DB.Where("type = ? AND status = ?", constant.ChannelTypeImaPro, common.ChannelStatusEnabled).
		Order("priority desc").
		Find(&candidates).Error
	if err != nil {
		return nil, fmt.Errorf("asset channel query error: %w", err)
	}
	if len(candidates) == 0 {
		return nil, fmt.Errorf("no available channel for asset model %s", assetModel)
	}

	if modelExplicit {
		// Pick the highest-priority channel that lists the requested model.
		for _, ch := range candidates {
			if channelHasModel(ch, assetModel) && isAssetChannelReady(ch) {
				return ch, nil
			}
		}
		return nil, fmt.Errorf("no channel provides asset model %s", assetModel)
	}

	// No model specified: use first ready channel.
	for _, ch := range candidates {
		if isAssetChannelReady(ch) {
			return ch, nil
		}
	}
	return nil, fmt.Errorf("no usable asset channel (all channels misconfigured)")
}

func getAssetUploadQuota(assetModel string) int {
	modelPrice, ok := ratio_setting.GetModelPrice(assetModel, false)
	if (!ok || modelPrice <= 0) && strings.TrimSpace(assetModel) != "" {
		// Fallback to ModelRatio configuration for this special per-call model.
		if ratioPrice, ratioOK, _ := ratio_setting.GetModelRatio(assetModel); ratioOK && ratioPrice > 0 {
			modelPrice = ratioPrice
			ok = true
		}
	}
	if !ok || modelPrice <= 0 {
		modelPrice = 0.005
	}
	quota := int(modelPrice * common.QuotaPerUnit)
	if quota <= 0 {
		quota = 2500
	}
	return quota
}

func pickAssetBillingToken(userID int, preferredTokenID int, quota int) (*model.Token, error) {
	canAfford := func(t *model.Token) bool {
		if t == nil {
			return false
		}
		if t.Status != common.TokenStatusEnabled {
			return false
		}
		if t.UnlimitedQuota {
			return true
		}
		return t.RemainQuota >= quota
	}

	if preferredTokenID > 0 {
		preferred, err := model.GetTokenById(preferredTokenID)
		if err != nil || preferred == nil || preferred.UserId != userID {
			return nil, errors.New("selected token is invalid")
		}
		if preferred.Status != common.TokenStatusEnabled {
			return nil, errors.New("selected token is disabled")
		}
		if !canAfford(preferred) {
			return nil, errors.New("selected token quota is not enough")
		}
		return preferred, nil
	}

	tokens := make([]*model.Token, 0)
	if err := model.DB.Where("user_id = ? AND status = ?", userID, common.TokenStatusEnabled).
		Order("id ASC").
		Find(&tokens).Error; err != nil {
		return nil, err
	}
	for _, tk := range tokens {
		if preferredTokenID > 0 && tk.Id == preferredTokenID {
			continue
		}
		if canAfford(tk) {
			return tk, nil
		}
	}
	return nil, nil
}

func getAssetChannelByID(channelID int) (*model.Channel, error) {
	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		return nil, err
	}
	if channel.Type != constant.ChannelTypeImaPro {
		return nil, errors.New("channel type is not ima-pro")
	}
	if channel.Status != common.ChannelStatusEnabled {
		return nil, errors.New("ima-pro channel is disabled")
	}
	if channel.BaseURL == nil || strings.TrimSpace(*channel.BaseURL) == "" {
		return nil, errors.New("ima-pro channel base_url is empty")
	}
	if strings.TrimSpace(channel.Key) == "" {
		return nil, errors.New("ima-pro channel key is empty")
	}
	return channel, nil
}

func HandleCreateAssetGroup(ctx context.Context, userID int, userName string, userGroup string, req dto.AssetGroupCreateRequest) (*dto.DoubaoAssetGroupResult, error) {
	if !asset_setting.GetAssetSetting().Enabled {
		return nil, errors.New("asset feature is disabled")
	}
	assetModel := resolveAssetModel(req.Model)
	modelExplicit := strings.TrimSpace(req.Model) != ""
	if err := checkAssetModelPermission(userGroup, assetModel); err != nil {
		return nil, err
	}
	channel, err := getAssetChannelByModel(assetModel, modelExplicit)
	if err != nil {
		return nil, err
	}
	uid, err := resolveAssetUID(userID, userName)
	if err != nil {
		return nil, err
	}
	client := NewAssetProxyClient(channel, uid)
	upstreamGroup, err := client.CreateAssetGroup(ctx, req)
	if err != nil {
		return nil, err
	}
	fillAssetGroupDefaults(upstreamGroup, req)

	group := &model.UserAssetGroup{
		UserId:          userID,
		ChannelId:       channel.Id,
		UpstreamGroupId: upstreamGroup.NormalizedID(),
		Name:            upstreamGroup.Name,
		Description:     upstreamGroup.Description,
		Title:           upstreamGroup.Title,
		GroupType:       upstreamGroup.GroupType,
		ProjectName:     upstreamGroup.ProjectName,
		Status:          1,
	}
	if err = group.Create(); err != nil {
		return nil, err
	}
	return upstreamGroup, nil
}

func fillAssetGroupDefaults(group *dto.DoubaoAssetGroupResult, req dto.AssetGroupCreateRequest) {
	if group == nil {
		return
	}
	if group.Name == "" {
		group.Name = req.Name
	}
	if group.Description == "" {
		group.Description = req.Description
	}
	if group.GroupType == "" {
		if req.GroupType != "" {
			group.GroupType = req.GroupType
		} else {
			group.GroupType = "AIGC"
		}
	}
	if group.ProjectName == "" {
		if req.ProjectName != "" {
			group.ProjectName = req.ProjectName
		} else {
			group.ProjectName = "default"
		}
	}
}

func HandleListAssetGroups(ctx context.Context, userID int, userName string, userGroup string, req dto.AssetGroupListRequest) (*dto.DoubaoListResult, error) {
	assetModel := resolveAssetModel(req.Model)
	modelExplicit := strings.TrimSpace(req.Model) != ""
	if err := checkAssetModelPermission(userGroup, assetModel); err != nil {
		return nil, err
	}
	channel, err := getAssetChannelByModel(assetModel, modelExplicit)
	if err != nil {
		return nil, err
	}
	uid, err := resolveAssetUID(userID, userName)
	if err != nil {
		return nil, err
	}
	client := NewAssetProxyClient(channel, uid)
	result, err := client.ListAssetGroups(ctx, req)
	if err != nil {
		return nil, err
	}

	groups := make([]dto.DoubaoAssetGroupResult, 0)
	if len(result.Items) > 0 {
		if err = common.Unmarshal(result.Items, &groups); err == nil {
			for _, item := range groups {
				upstreamID := item.NormalizedID()
				if upstreamID == "" {
					continue
				}
				group := &model.UserAssetGroup{}
				if group.GetByUpstreamID(userID, upstreamID) == nil {
					group.Name = item.Name
					group.Description = item.Description
					group.Title = item.Title
					if item.GroupType != "" {
						group.GroupType = item.GroupType
					}
					_ = group.Update()
				}
			}
		}
	}

	return result, nil
}

func HandleGetAssetGroup(ctx context.Context, userID int, userName string, req dto.AssetGroupGetRequest) (*dto.DoubaoAssetGroupResult, error) {
	group := &model.UserAssetGroup{}
	if err := group.GetByUpstreamID(userID, req.Id); err != nil {
		return nil, errors.New("asset group not found")
	}
	channel, err := getAssetChannelByID(group.ChannelId)
	if err != nil {
		return nil, err
	}
	uid, err := resolveAssetUID(userID, userName)
	if err != nil {
		return nil, err
	}
	client := NewAssetProxyClient(channel, uid)
	return client.GetAssetGroup(ctx, req.Id, req.ProjectName)
}

func HandleUpdateAssetGroup(ctx context.Context, userID int, userName string, req dto.AssetGroupUpdateRequest) (*dto.DoubaoIDResult, error) {
	group := &model.UserAssetGroup{}
	if err := group.GetByUpstreamID(userID, req.Id); err != nil {
		return nil, errors.New("asset group not found")
	}
	channel, err := getAssetChannelByID(group.ChannelId)
	if err != nil {
		return nil, err
	}
	uid, err := resolveAssetUID(userID, userName)
	if err != nil {
		return nil, err
	}
	client := NewAssetProxyClient(channel, uid)
	result, err := client.UpdateAssetGroup(ctx, req)
	if err != nil {
		return nil, err
	}

	if req.Name != "" {
		group.Name = req.Name
	}
	if req.Description != "" {
		group.Description = req.Description
	}
	_ = group.Update()
	return result, nil
}

func HandleCreateAsset(ctx context.Context, userID int, userName string, userGroup string, tokenID int, tokenName string, req dto.AssetCreateRequest) (*dto.DoubaoIDResult, error) {
	_ = tokenName
	setting := asset_setting.GetAssetSetting()
	if !setting.Enabled {
		return nil, errors.New("asset feature is disabled")
	}
	count, err := model.CountUserAssets(userID)
	if err != nil {
		return nil, err
	}
	if setting.MaxCountPerUser > 0 && count >= int64(setting.MaxCountPerUser) {
		return nil, fmt.Errorf("asset count exceeds max limit %d", setting.MaxCountPerUser)
	}

	group := &model.UserAssetGroup{}
	if err = group.GetByUpstreamID(userID, req.GroupId); err != nil {
		return nil, errors.New("asset group not found")
	}
	channel, err := getAssetChannelByID(group.ChannelId)
	if err != nil {
		return nil, err
	}
	uid, err := resolveAssetUID(userID, userName)
	if err != nil {
		return nil, err
	}
	client := NewAssetProxyClient(channel, uid)

	assetModel := resolveAssetModel(req.Model)
	if err = checkAssetModelPermission(userGroup, assetModel); err != nil {
		return nil, err
	}
	// Validate that the billing model belongs to this channel's model list.
	if !channelHasModel(channel, assetModel) {
		assetModel = defaultAssetModel
	}
	quota := getAssetUploadQuota(assetModel)
	token, err := pickAssetBillingToken(userID, tokenID, quota)
	if err != nil {
		return nil, err
	}

	userQuota, err := model.GetUserQuota(userID, false)
	if err != nil {
		return nil, err
	}
	if userQuota < quota {
		return nil, fmt.Errorf("user quota is not enough, need: %d", quota)
	}

	upstreamResult, err := client.CreateAsset(ctx, req)
	if err != nil {
		return nil, err
	}
	upstreamAssetID := upstreamResult.NormalizedID()
	if upstreamAssetID == "" {
		return nil, errors.New("upstream asset id is empty")
	}

	quotaCost := 0
	billingOk := false
	billedTokenID := 0
	if token != nil {
		billedTokenID = token.Id
	}
	if token != nil && !token.UnlimitedQuota {
		if err = model.DecreaseTokenQuota(token.Id, token.Key, quota); err != nil {
			common.SysLog(fmt.Sprintf("asset billing warning: token deduction failed, user_id=%d token_id=%d upstream_asset_id=%s err=%s", userID, token.Id, upstreamAssetID, err.Error()))
		} else if err = model.DecreaseUserQuota(userID, quota); err != nil {
			_ = model.IncreaseTokenQuota(token.Id, token.Key, quota)
			common.SysLog(fmt.Sprintf("asset billing warning: user deduction failed after token deduction, user_id=%d token_id=%d upstream_asset_id=%s err=%s", userID, token.Id, upstreamAssetID, err.Error()))
		} else {
			billingOk = true
			quotaCost = quota
		}
	} else {
		if err = model.DecreaseUserQuota(userID, quota); err != nil {
			common.SysLog(fmt.Sprintf("asset billing warning: user deduction failed, user_id=%d upstream_asset_id=%s err=%s", userID, upstreamAssetID, err.Error()))
		} else {
			billingOk = true
			quotaCost = quota
		}
	}

	asset := &model.UserAsset{
		UserId:          userID,
		GroupId:         group.Id,
		ChannelId:       channel.Id,
		UpstreamAssetId: upstreamAssetID,
		FileName:        req.Name,
		SourceUrl:       req.URL,
		AssetType:       req.AssetType,
		Status:          "Processing",
		QuotaCost:       quotaCost,
	}
	if asset.AssetType == "" {
		asset.AssetType = "Image"
	}
	if err = asset.Create(); err != nil {
		common.SysLog(fmt.Sprintf("asset persistence warning: upstream asset created but local save failed, user_id=%d channel_id=%d upstream_asset_id=%s err=%s", userID, channel.Id, upstreamAssetID, err.Error()))
		return upstreamResult, nil
	}

	_ = model.RefreshUserAssetGroupCount(group.Id)
	if billingOk {
		model.UpdateUserUsedQuotaAndRequestCount(userID, quota)
		model.UpdateChannelUsedQuota(channel.Id, quota)
		modelPrice := float64(quota) / float64(common.QuotaPerUnit)
		billingGroup, pricingGroup := resolveAssetBillingGroups(token, userGroup)
		model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
			UserId:    userID,
			LogType:   model.LogTypeConsume,
			Content:   fmt.Sprintf("asset upload charged, model=%s", assetModel),
			ChannelId: channel.Id,
			ModelName: assetModel,
			Quota:     quota,
			TokenId:   billedTokenID,
			Group:     billingGroup,
			PricingGroup: pricingGroup,
			Other: map[string]interface{}{
				"model_price":   modelPrice,
				"group_ratio":   1.0,
				"actual_quota":  quota,
				"billing_stage": "asset_upload",
			},
		})
	} else {
		common.SysLog(fmt.Sprintf("asset billing warning: upstream asset created without successful billing, user_id=%d channel_id=%d upstream_asset_id=%s", userID, channel.Id, upstreamAssetID))
	}

	go pollAssetStatus(client, asset.Id, upstreamAssetID)
	return upstreamResult, nil
}

func HandleListAssets(ctx context.Context, userID int, userName string, userGroup string, req dto.AssetListRequest) (*dto.DoubaoListResult, error) {
	assetModel := resolveAssetModel(req.Model)
	modelExplicit := strings.TrimSpace(req.Model) != ""
	if err := checkAssetModelPermission(userGroup, assetModel); err != nil {
		return nil, err
	}
	channel, err := getAssetChannelByModel(assetModel, modelExplicit)
	if err != nil {
		return nil, err
	}
	uid, err := resolveAssetUID(userID, userName)
	if err != nil {
		return nil, err
	}
	client := NewAssetProxyClient(channel, uid)
	result, err := client.ListAssets(ctx, req)
	if err != nil {
		return nil, err
	}

	items := make([]dto.DoubaoAssetResult, 0)
	if len(result.Items) > 0 {
		if err = common.Unmarshal(result.Items, &items); err == nil {
			now := time.Now().Unix()
			filtered := make([]dto.DoubaoAssetResult, 0, len(items))
			for _, item := range items {
				upstreamID := item.NormalizedID()
				if upstreamID == "" {
					continue
				}
				asset := &model.UserAsset{}
				if asset.GetByUpstreamID(userID, upstreamID) != nil {
					continue
				}
				filtered = append(filtered, item)
				// 仅对本地已存在且长期 processing 的素材触发补偿轮询。
				if item.Status == "Processing" && now-asset.CreatedAt > 30 {
					go pollAssetStatus(client, asset.Id, upstreamID)
				}
			}
			if payload, marshalErr := common.Marshal(filtered); marshalErr == nil {
				result.Items = payload
				result.TotalCount = int64(len(filtered))
			}
		}
	}
	return result, nil
}

func HandleGetAsset(ctx context.Context, userID int, userName string, req dto.AssetGetRequest) (*dto.DoubaoAssetResult, error) {
	asset := &model.UserAsset{}
	if err := asset.GetByUpstreamID(userID, req.Id); err != nil {
		return nil, errors.New("asset not found")
	}
	channel, err := getAssetChannelByID(asset.ChannelId)
	if err != nil {
		return nil, err
	}
	uid, err := resolveAssetUID(userID, userName)
	if err != nil {
		return nil, err
	}
	client := NewAssetProxyClient(channel, uid)
	result, err := client.GetAsset(ctx, req.Id, req.ProjectName)
	if err != nil {
		return nil, err
	}
	if result.Status == "Active" {
		_ = model.UpdateUserAssetByUpstreamID(userID, req.Id, map[string]any{
			"status":        "Active",
			"asset_ref":     fmt.Sprintf("asset://%s", req.Id),
			"error_code":    "",
			"error_message": "",
		})
	} else if result.Status == "Failed" {
		errorCode := ""
		errorMessage := ""
		if result.Error != nil {
			errorCode = result.Error.Code
			errorMessage = result.Error.Message
		}
		_ = model.UpdateUserAssetByUpstreamID(userID, req.Id, map[string]any{
			"status":        "Failed",
			"error_code":    errorCode,
			"error_message": errorMessage,
		})
	}
	return result, nil
}

func HandleUpdateAsset(ctx context.Context, userID int, userName string, req dto.AssetUpdateRequest) (*dto.DoubaoIDResult, error) {
	asset := &model.UserAsset{}
	if err := asset.GetByUpstreamID(userID, req.Id); err != nil {
		return nil, errors.New("asset not found")
	}
	channel, err := getAssetChannelByID(asset.ChannelId)
	if err != nil {
		return nil, err
	}
	uid, err := resolveAssetUID(userID, userName)
	if err != nil {
		return nil, err
	}
	client := NewAssetProxyClient(channel, uid)
	result, err := client.UpdateAsset(ctx, req)
	if err != nil {
		return nil, err
	}
	asset.FileName = req.Name
	_ = asset.Update()
	return result, nil
}

func HandleDeleteAsset(userID int, req dto.AssetDeleteRequest) error {
	asset := &model.UserAsset{}
	if err := asset.GetByUpstreamID(userID, req.Id); err != nil {
		if id, ok := model.ParseAssetDeleteID(req.Id); ok {
			if err = asset.GetByID(userID, id); err != nil {
				return errors.New("asset not found")
			}
		} else {
			return errors.New("asset not found")
		}
	}
	if err := asset.HardDelete(); err != nil {
		return err
	}
	return model.RefreshUserAssetGroupCount(asset.GroupId)
}

func HandleGetAssetQuota(userID int) (*dto.AssetQuotaResponse, error) {
	count, err := model.CountUserAssets(userID)
	if err != nil {
		return nil, err
	}
	cfg := asset_setting.GetAssetSetting()
	return &dto.AssetQuotaResponse{
		Enabled:         cfg.Enabled,
		MaxCountPerUser: cfg.MaxCountPerUser,
		CurrentCount:    count,
	}, nil
}
