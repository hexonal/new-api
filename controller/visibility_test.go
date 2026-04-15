package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func TestSanitizeSelfLogsForVisibilityHidesConfiguredFields(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	original := common.OptionMap
	common.OptionMap = map[string]string{
		"UserLogsShowGroupForNonAdminEnabled":            "false",
		"UserLogsShowPricingGroupForNonAdminEnabled":     "false",
		"PersonalSettingShowUserGroupForNonAdminEnabled": "false",
	}
	common.OptionMapRWMutex.Unlock()
	defer func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = original
		common.OptionMapRWMutex.Unlock()
	}()

	logs := []*model.Log{
		{Group: "shizeing3", PricingGroup: "shizeing3"},
	}

	sanitizeSelfLogsForVisibility(common.RoleCommonUser, logs)

	if logs[0].Group != "" {
		t.Fatalf("expected group to be hidden, got %q", logs[0].Group)
	}
	if logs[0].PricingGroup != "" {
		t.Fatalf("expected pricing_group to be hidden, got %q", logs[0].PricingGroup)
	}
}

func TestSanitizeSelfLogsForVisibilityKeepsAdminFields(t *testing.T) {
	logs := []*model.Log{
		{Group: "shizeing3", PricingGroup: "shizeing3"},
	}

	sanitizeSelfLogsForVisibility(common.RoleAdminUser, logs)

	if logs[0].Group != "shizeing3" {
		t.Fatalf("expected admin group to remain visible, got %q", logs[0].Group)
	}
	if logs[0].PricingGroup != "shizeing3" {
		t.Fatalf("expected admin pricing_group to remain visible, got %q", logs[0].PricingGroup)
	}
}
