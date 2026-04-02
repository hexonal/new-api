package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetGroups(c *gin.Context) {
	groupType := c.Query("type")
	groupNames := make([]string, 0)
	if groupType == "permission" {
		for groupName := range ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.ReadAll() {
			groupNames = append(groupNames, groupName)
		}
	} else if groupType == "pricing" {
		// Union of GroupRatio keys and GroupModelRatio keys
		groupsCopy := ratio_setting.GetGroupRatioCopy()
		for k := range ratio_setting.GetGroupModelRatioCopy() {
			if _, ok := groupsCopy[k]; !ok {
				groupsCopy[k] = 1.0
			}
		}
		for groupName := range groupsCopy {
			groupNames = append(groupNames, groupName)
		}
	} else {
		for groupName := range ratio_setting.GetGroupRatioCopy() {
			groupNames = append(groupNames, groupName)
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]interface{})
	userGroup := ""
	userId := c.GetInt("id")
	userGroup, _ = model.GetUserGroup(userId, false)
	userUsableGroups := service.GetUserUsableGroups(userGroup)

	// For authenticated self group selector, only expose the user's own group.
	// This avoids showing global groups (e.g. default) in token-group dropdown.
	if strings.HasSuffix(c.FullPath(), "/self/groups") && userGroup != "" {
		if desc, ok := userUsableGroups[userGroup]; ok {
			usableGroups[userGroup] = map[string]interface{}{
				"ratio": service.GetUserGroupRatio(userGroup, userGroup),
				"desc":  desc,
			}
		}
		if _, ok := userUsableGroups["auto"]; ok {
			usableGroups["auto"] = map[string]interface{}{
				"ratio": "自动",
				"desc":  setting.GetUsableGroupDescription("auto"),
			}
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    usableGroups,
		})
		return
	}

	for groupName, _ := range ratio_setting.GetGroupRatioCopy() {
		// UserUsableGroups contains the groups that the user can use
		if desc, ok := userUsableGroups[groupName]; ok {
			usableGroups[groupName] = map[string]interface{}{
				"ratio": service.GetUserGroupRatio(userGroup, groupName),
				"desc":  desc,
			}
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		usableGroups["auto"] = map[string]interface{}{
			"ratio": "自动",
			"desc":  setting.GetUsableGroupDescription("auto"),
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}
