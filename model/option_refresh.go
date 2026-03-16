package model

import (
	"fmt"
)

// ReloadPricingOptionsFromDatabase 仅重载定价相关 Option 到内存配置。
// 适用于数据库被外部脚本直接修改后，手动触发一次运行时同步。
func ReloadPricingOptionsFromDatabase() error {
	keys := []string{
		"ModelRatio",
		"CompletionRatio",
		"CacheRatio",
		"CreateCacheRatio",
		"ModelPrice",
		"GroupRatio",
		"GroupGroupRatio",
		"ImageRatio",
		"AudioRatio",
		"AudioCompletionRatio",
	}
	for _, key := range keys {
		var option Option
		if err := DB.Where("`key` = ?", key).First(&option).Error; err != nil {
			return fmt.Errorf("load option %s failed: %w", key, err)
		}
		if err := updateOptionMap(option.Key, option.Value); err != nil {
			return fmt.Errorf("apply option %s failed: %w", key, err)
		}
	}
	return nil
}
