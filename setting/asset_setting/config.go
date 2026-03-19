package asset_setting

import "github.com/QuantumNous/new-api/setting/config"

type AssetSetting struct {
	Enabled         bool `json:"enabled"`
	MaxCountPerUser int  `json:"max_count_per_user"`
}

var assetSetting = AssetSetting{
	Enabled:         true,
	MaxCountPerUser: 100,
}

func init() {
	config.GlobalConfig.Register("asset_setting", &assetSetting)
}

func GetAssetSetting() *AssetSetting {
	return &assetSetting
}
