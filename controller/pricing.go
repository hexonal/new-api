package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func resolveMarketplaceDefaultPricingGroup(configured string, usableGroup map[string]string, isAdminUser bool) string {
	if isAdminUser {
		return ""
	}
	group := strings.TrimSpace(configured)
	if group == "" {
		return ""
	}
	if _, ok := usableGroup[group]; !ok {
		return ""
	}
	return group
}

func GetPricing(c *gin.Context) {
	pricing := model.GetPricing()
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	groupModelRatio := map[string]map[string]float64{}
	userRole := c.GetInt("role")
	isAdminUser := userRole >= common.RoleAdminUser
	for s, f := range ratio_setting.GetGroupRatioCopy() {
		groupRatio[s] = f
	}
	for group, modelRatios := range ratio_setting.GetGroupModelRatioCopy() {
		groupModelRatio[group] = modelRatios
	}
	var group string
	userID := c.GetInt("id")
	if userID > 0 {
		user, err := model.GetUserCache(userID)
		if err == nil {
			group = user.Group
			for g := range groupRatio {
				ratio, ok := ratio_setting.GetGroupGroupRatio(group, g)
				if ok {
					groupRatio[g] = ratio
				}
			}
		}
	}

	usableGroup = service.GetUserUsableGroups(group)
	// Filter usableGroup: only keep groups that exist in GroupRatio (token groups).
	// This prevents permission group names (e.g., "测试组") from appearing in the model marketplace.
	groupRatioCopy := ratio_setting.GetGroupRatioCopy()
	for g := range usableGroup {
		if _, inRatio := groupRatioCopy[g]; !inRatio {
			delete(usableGroup, g)
		}
	}
	// Also filter groupRatio to only keep groups in usableGroup
	for g := range groupRatio {
		if _, ok := usableGroup[g]; !ok {
			delete(groupRatio, g)
		}
	}
	// Filter groupModelRatio to only keep groups in usableGroup
	for g := range groupModelRatio {
		if _, ok := usableGroup[g]; !ok {
			delete(groupModelRatio, g)
		}
	}

	common.OptionMapRWMutex.RLock()
	configuredMarketplaceDefaultGroup := common.OptionMap["MarketplaceDefaultPricingGroup"]
	common.OptionMapRWMutex.RUnlock()
	marketplaceDefaultPricingGroup := resolveMarketplaceDefaultPricingGroup(
		configuredMarketplaceDefaultGroup,
		usableGroup,
		isAdminUser,
	)

	// For logged-in users, expose models that intersect with user's usable groups.
	filteredPricing := pricing
	if group != "" {
		allowedGroups := make(map[string]struct{}, len(usableGroup))
		for g := range usableGroup {
			allowedGroups[g] = struct{}{}
		}
		filteredPricing = make([]model.Pricing, 0, len(pricing))
		for _, p := range pricing {
			// If model has no explicit group binding, keep backward-compatible visibility.
			if len(p.EnableGroup) == 0 {
				filteredPricing = append(filteredPricing, p)
				continue
			}
			for _, g := range p.EnableGroup {
				if _, ok := allowedGroups[g]; ok {
					filteredPricing = append(filteredPricing, p)
					break
				}
			}
		}
	}

	c.JSON(200, gin.H{
		"success":                           true,
		"data":                              filteredPricing,
		"vendors":                           model.GetVendors(),
		"group_ratio":                       groupRatio,
		"group_model_ratio":                 groupModelRatio,
		"usable_group":                      usableGroup,
		"supported_endpoint":                model.GetSupportedEndpointMap(),
		"auto_groups":                       service.GetUserAutoGroup(group),
		"marketplace_default_pricing_group": marketplaceDefaultPricingGroup,
		"_":                                 "a42d372ccf0b5dd13ecf71203521f9d2",
	})
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型倍率成功",
	})
}

// RefreshPricingCache 从数据库重新加载定价相关配置并强制刷新内存定价缓存。
// 用于绕过直接改库后等待自动刷新或重启服务。
func RefreshPricingCache(c *gin.Context) {
	if err := model.RefreshRuntimeCaches(); err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	affinityDeleted := service.ClearChannelAffinityCacheAll()
	if err := model.BroadcastRuntimeCacheRefreshSignal(); err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": "本机刷新成功，但跨 Pod 广播失败: " + err.Error(),
			"data": gin.H{
				"channel_affinity_cache_deleted": affinityDeleted,
			},
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "全局缓存刷新成功（已广播到所有 Pod）",
		"data": gin.H{
			"channel_affinity_cache_deleted": affinityDeleted,
		},
	})
}
