package operation_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const (
	RoutingMatchByUsername    = "username"
	RoutingMatchByTokenPrefix = "token_prefix"
)

func NormalizeRoutingMatchBy(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case RoutingMatchByTokenPrefix:
		return RoutingMatchByTokenPrefix
	default:
		return RoutingMatchByUsername
	}
}

// UserPointsRoutingRule defines a routing rule for user_points queries.
type UserPointsRoutingRule struct {
	Name                string `json:"name"`
	Enabled             bool   `json:"enabled"`
	MatchBy             string `json:"match_by,omitempty"` // username | token_prefix
	PrefixPattern       string `json:"prefix_pattern"`
	QueryURL            string `json:"query_url"`
	RechargeURL         string `json:"recharge_url"`
	InsufficientMessage string `json:"insufficient_message"`
	Priority            int    `json:"priority"`
}

type ConsumeCallbackRoutingRule struct {
	Name          string `json:"name"`
	Enabled       bool   `json:"enabled"`
	MatchBy       string `json:"match_by,omitempty"` // username | token_prefix
	PrefixPattern string `json:"prefix_pattern"`
	CallbackURL   string `json:"callback_url"`
	Secret        string `json:"secret"`
	Priority      int    `json:"priority"`
}

type PaymentSetting struct {
	AmountOptions                  []int                        `json:"amount_options"`
	AmountDiscount                 map[int]float64              `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠
	UserPointsEnabled              bool                         `json:"user_points_enabled"`
	UserPointsQueryURL             string                       `json:"user_points_query_url"`
	UserPointsUsernamePrefixFilter string                       `json:"user_points_username_prefix_filter"`
	UserPointsCanPreDeductJSONPath string                       `json:"user_points_can_pre_deduct_jsonpath"`
	UserPointsOnErrorDecision      string                       `json:"user_points_on_error_decision"`    // user_points 调用异常时的决策：allow(放行) / deny(拒绝)
	UserPointsRechargeURL          string                       `json:"user_points_recharge_url"`         // 额度不足时的引导充值链接
	UserPointsInsufficientMessage  string                       `json:"user_points_insufficient_message"` // 额度不足提示文案；支持 {recharge_url} 占位符
	UserPointsRoutingRules         []UserPointsRoutingRule      `json:"user_points_routing_rules"`
	ConsumeCallbackRoutingRules    []ConsumeCallbackRoutingRule `json:"consume_callback_routing_rules"`
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
	UserPointsRoutingRules:         nil,
	ConsumeCallbackRoutingRules:    nil,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}
