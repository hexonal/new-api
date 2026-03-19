package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var pricingOptionKeys = []string{
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

// ReloadPricingOptionsFromDatabase 仅重载定价相关 Option 到内存配置。
// 适用于数据库被外部脚本直接修改后，手动触发一次运行时同步。
func ReloadPricingOptionsFromDatabase() error {
	for _, key := range pricingOptionKeys {
		var option Option
		err := DB.Where(clause.Eq{Column: "key", Value: key}).First(&option).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			fallback, ok := getOptionFallbackValue(key)
			if !ok {
				return fmt.Errorf("load option %s failed: fallback not found", key)
			}
			option = Option{
				Key:   key,
				Value: fallback,
			}
			if createErr := DB.Create(&option).Error; createErr != nil {
				return fmt.Errorf("create missing option %s failed: %w", key, createErr)
			}
			common.SysLog(fmt.Sprintf("auto-created missing option: %s", key))
		} else if err != nil {
			return fmt.Errorf("load option %s failed: %w", key, err)
		}
		if err := updateOptionMap(option.Key, option.Value); err != nil {
			return fmt.Errorf("apply option %s failed: %w", key, err)
		}
	}
	return nil
}

// RefreshRuntimeCaches performs a global runtime refresh on the current pod:
// options map, pricing config/cache, and channel memory cache.
func RefreshRuntimeCaches() error {
	if err := ReloadAllOptionsFromDatabase(); err != nil {
		return err
	}
	if err := ReloadPricingOptionsFromDatabase(); err != nil {
		return err
	}
	RefreshPricing()
	InitChannelCache()
	return nil
}

func ReloadAllOptionsFromDatabase() error {
	options, err := AllOption()
	if err != nil {
		return fmt.Errorf("load options failed: %w", err)
	}
	for _, option := range options {
		if err := updateOptionMap(option.Key, option.Value); err != nil {
			return fmt.Errorf("apply option %s failed: %w", option.Key, err)
		}
	}
	return nil
}

func getOptionFallbackValue(key string) (string, bool) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	value, ok := common.OptionMap[key]
	return value, ok
}
