package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PaymentSetting struct {
	AmountOptions                  []int           `json:"amount_options"`
	AmountDiscount                 map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠
	UserPointsEnabled              bool            `json:"user_points_enabled"`
	UserPointsQueryURL             string          `json:"user_points_query_url"`
	UserPointsUsernamePrefixFilter string          `json:"user_points_username_prefix_filter"`
	UserPointsCanPreDeductJSONPath string          `json:"user_points_can_pre_deduct_jsonpath"`
}

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:                  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount:                 map[int]float64{},
	UserPointsEnabled:              false,
	UserPointsQueryURL:             "",
	UserPointsUsernamePrefixFilter: "",
	UserPointsCanPreDeductJSONPath: "data.can_pre_deduct",
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}
