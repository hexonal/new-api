package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PaymentSetting struct {
	AmountOptions                  []int           `json:"amount_options"`
	AmountDiscount                 map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠
	UserPointsEnabled              bool            `json:"user_points_enabled"`
	UserPointsQueryURL             string          `json:"user_points_query_url"`
	UserPointsUsernamePrefixFilter string          `json:"user_points_username_prefix_filter"`
	UserPointsCanPreDeductJSONPath string          `json:"user_points_can_pre_deduct_jsonpath"`
	UserPointsOnErrorDecision      string          `json:"user_points_on_error_decision"`     // user_points 调用异常时的决策：allow(放行) / deny(拒绝)
	UserPointsRechargeURL          string          `json:"user_points_recharge_url"`          // 额度不足时的引导充值链接
	UserPointsInsufficientMessage  string          `json:"user_points_insufficient_message"`  // 额度不足提示文案；支持 {recharge_url} 占位符
	ImaProMinBalanceGateEnabled    bool            `json:"ima_pro_min_balance_gate_enabled"`  // 是否启用 ima-pro 最低余额门槛
	ImaProMinBalanceUSDThreshold   float64         `json:"ima_pro_min_balance_usd_threshold"` // ima-pro 最低可用余额门槛（美元）
}

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:                  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount:                 map[int]float64{},
	UserPointsEnabled:              false,
	UserPointsQueryURL:             "",
	UserPointsUsernamePrefixFilter: "",
	UserPointsCanPreDeductJSONPath: "data.can_pre_deduct",
	UserPointsOnErrorDecision:      "allow",
	UserPointsRechargeURL:          "",
	UserPointsInsufficientMessage:  "",
	ImaProMinBalanceGateEnabled:    false,
	ImaProMinBalanceUSDThreshold:   10,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}
