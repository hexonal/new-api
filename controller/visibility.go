package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func isAdminRole(role int) bool {
	return role >= common.RoleAdminUser
}

func getBoolOption(key string) bool {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return common.OptionMap[key] == "true"
}

func userLogsShowGroupForNonAdmin() bool {
	return getBoolOption("UserLogsShowGroupForNonAdminEnabled")
}

func userLogsShowPricingGroupForNonAdmin() bool {
	return getBoolOption("UserLogsShowPricingGroupForNonAdminEnabled")
}

func personalSettingShowUserGroupForNonAdmin() bool {
	return getBoolOption("PersonalSettingShowUserGroupForNonAdminEnabled")
}

func sanitizeSelfLogsForVisibility(role int, logs []*model.Log) {
	if isAdminRole(role) {
		return
	}
	showGroup := userLogsShowGroupForNonAdmin()
	showPricingGroup := userLogsShowPricingGroupForNonAdmin()
	for _, log := range logs {
		if log == nil {
			continue
		}
		if !showGroup {
			log.Group = ""
		}
		if !showPricingGroup {
			log.PricingGroup = ""
		}
	}
}
