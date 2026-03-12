package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateDeferredTaskBilling_WalletOnly(t *testing.T) {
	truncate(t)

	const userID, tokenID = 41, 41
	seedUser(t, userID, 10000)
	seedToken(t, tokenID, userID, "sk-deferred-wallet", 9000)

	info := &relaycommon.RelayInfo{
		UserId:         userID,
		TokenId:        tokenID,
		TokenKey:       "sk-deferred-wallet",
		TokenUnlimited: true,
		UserSetting: dto.UserSetting{
			BillingPreference: "wallet_only",
		},
	}

	apiErr := ValidateDeferredTaskBilling(nil, info, 3000)
	require.Nil(t, apiErr)
	assert.Equal(t, BillingSourceWallet, info.BillingSource)
	assert.Equal(t, 0, info.SubscriptionId)
}

func TestValidateDeferredTaskBilling_SubscriptionOnly(t *testing.T) {
	truncate(t)

	const userID, tokenID, subID = 42, 42, 4201
	seedUser(t, userID, 100)
	seedToken(t, tokenID, userID, "sk-deferred-sub", 9000)
	seedSubscription(t, subID, userID, 10000, 1000)

	info := &relaycommon.RelayInfo{
		UserId:         userID,
		TokenId:        tokenID,
		TokenKey:       "sk-deferred-sub",
		TokenUnlimited: true,
		UserSetting: dto.UserSetting{
			BillingPreference: "subscription_only",
		},
	}

	apiErr := ValidateDeferredTaskBilling(nil, info, 3000)
	require.Nil(t, apiErr)
	assert.Equal(t, BillingSourceSubscription, info.BillingSource)
	assert.Equal(t, subID, info.SubscriptionId)
}

func TestValidateDeferredTaskBilling_InsufficientWallet(t *testing.T) {
	truncate(t)

	const userID, tokenID = 43, 43
	seedUser(t, userID, 100)
	seedToken(t, tokenID, userID, "sk-deferred-wallet-fail", 9000)

	info := &relaycommon.RelayInfo{
		UserId:         userID,
		TokenId:        tokenID,
		TokenKey:       "sk-deferred-wallet-fail",
		TokenUnlimited: true,
		UserSetting: dto.UserSetting{
			BillingPreference: "wallet_only",
		},
	}

	apiErr := ValidateDeferredTaskBilling(nil, info, 3000)
	require.NotNil(t, apiErr)
	assert.Equal(t, "insufficient_user_quota", string(apiErr.GetErrorCode()))
}

func TestValidateDeferredTaskBilling_ImaProMinBalanceBlocksWallet(t *testing.T) {
	truncate(t)

	cfg := operation_setting.GetPaymentSetting()
	oldCfg := *cfg
	oldQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() {
		*cfg = oldCfg
		common.QuotaPerUnit = oldQuotaPerUnit
	})
	cfg.ImaProMinBalanceGateEnabled = true
	cfg.ImaProMinBalanceUSDThreshold = 10
	common.QuotaPerUnit = 100

	const userID, tokenID = 44, 44
	seedUser(t, userID, 999)
	seedToken(t, tokenID, userID, "sk-ima-pro-balance", 9000)

	info := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        "sk-ima-pro-balance",
		TokenUnlimited:  true,
		OriginModelName: "ima-pro",
		UserSetting: dto.UserSetting{
			BillingPreference: "wallet_only",
		},
	}

	apiErr := ValidateDeferredTaskBilling(nil, info, 1)
	require.NotNil(t, apiErr)
	assert.Equal(t, "insufficient_user_quota", string(apiErr.GetErrorCode()))
	assert.Contains(t, apiErr.Error(), "Insufficient quota")
}

func TestValidateDeferredTaskBilling_ImaProMinBalanceNotAppliedToOtherModels(t *testing.T) {
	truncate(t)

	cfg := operation_setting.GetPaymentSetting()
	oldCfg := *cfg
	oldQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() {
		*cfg = oldCfg
		common.QuotaPerUnit = oldQuotaPerUnit
	})
	cfg.ImaProMinBalanceGateEnabled = true
	cfg.ImaProMinBalanceUSDThreshold = 10
	common.QuotaPerUnit = 100

	const userID, tokenID = 45, 45
	seedUser(t, userID, 100)
	seedToken(t, tokenID, userID, "sk-non-ima-pro", 9000)

	info := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        "sk-non-ima-pro",
		TokenUnlimited:  true,
		OriginModelName: "sora-2",
		UserSetting: dto.UserSetting{
			BillingPreference: "wallet_only",
		},
	}

	apiErr := ValidateDeferredTaskBilling(nil, info, 1)
	require.Nil(t, apiErr)
	assert.Equal(t, BillingSourceWallet, info.BillingSource)
}

func TestValidateDeferredTaskBilling_ImaProMinBalanceBlocksSubscription(t *testing.T) {
	truncate(t)

	cfg := operation_setting.GetPaymentSetting()
	oldCfg := *cfg
	oldQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() {
		*cfg = oldCfg
		common.QuotaPerUnit = oldQuotaPerUnit
	})
	cfg.ImaProMinBalanceGateEnabled = true
	cfg.ImaProMinBalanceUSDThreshold = 10
	common.QuotaPerUnit = 100

	const userID, tokenID, subID = 46, 46, 4601
	seedUser(t, userID, 10000)
	seedToken(t, tokenID, userID, "sk-ima-pro-sub", 9000)
	seedSubscription(t, subID, userID, 900, 0)

	info := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        "sk-ima-pro-sub",
		TokenUnlimited:  true,
		OriginModelName: "ima-pro",
		UserSetting: dto.UserSetting{
			BillingPreference: "subscription_only",
		},
	}

	apiErr := ValidateDeferredTaskBilling(nil, info, 1)
	require.NotNil(t, apiErr)
	assert.Equal(t, "insufficient_user_quota", string(apiErr.GetErrorCode()))
}
