package controller

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetPricing(c *gin.Context) {
	pricing := model.GetPricing()
	userId, exists := c.Get("id")
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	groupModelRatio := map[string]map[string]float64{}
	for s, f := range ratio_setting.GetGroupRatioCopy() {
		groupRatio[s] = f
	}
	for group, modelRatios := range ratio_setting.GetGroupModelRatioCopy() {
		groupModelRatio[group] = modelRatios
	}
	var group string
	if exists {
		user, err := model.GetUserCache(userId.(int))
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

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"group_model_ratio":  groupModelRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(group),
		"_":                  "a42d372ccf0b5dd13ecf71203521f9d2",
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
