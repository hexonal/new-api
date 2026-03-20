package service

import (
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const taskDeferredMinBalanceModelImaPro = "ima-pro"

// ValidateDeferredTaskBilling validates submit-time eligibility for deferred task billing.
// It does not consume quota. The resolved funding source is frozen in relayInfo and
// reused by task persistence/terminal settlement.
func ValidateDeferredTaskBilling(c *gin.Context, relayInfo *relaycommon.RelayInfo, estimatedQuota int) *types.NewAPIError {
	_ = c
	if relayInfo == nil {
		return types.NewError(fmt.Errorf("relayInfo is nil"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	if relayInfo.IsPlayground {
		relayInfo.BillingSource = BillingSourceWallet
		relayInfo.SubscriptionId = 0
		return nil
	}
	if estimatedQuota < 0 {
		estimatedQuota = 0
	}

	preference := common.NormalizeBillingPreference(relayInfo.UserSetting.BillingPreference)
	tryWallet := func() *types.NewAPIError {
		if apiErr := validateDeferredWalletAndToken(relayInfo, estimatedQuota); apiErr != nil {
			return apiErr
		}
		relayInfo.BillingSource = BillingSourceWallet
		relayInfo.SubscriptionId = 0
		return nil
	}
	trySubscription := func() *types.NewAPIError {
		sub, apiErr := pickActiveSubscriptionForQuota(relayInfo.UserId, int64(max(estimatedQuota, 1)))
		if apiErr != nil {
			return apiErr
		}
		// Deferred tasks still need token capacity check at submit-time to avoid
		// submitting tasks that can never be charged under current token limits.
		if apiErr := validateDeferredTokenOnly(relayInfo, estimatedQuota); apiErr != nil {
			return apiErr
		}
		if apiErr := validateImaProMinBalanceQuota(relayInfo, resolveSubscriptionRemainQuota(sub)); apiErr != nil {
			return apiErr
		}
		relayInfo.BillingSource = BillingSourceSubscription
		relayInfo.SubscriptionId = int(sub.Id)
		return nil
	}

	switch preference {
	case "wallet_only":
		return tryWallet()
	case "subscription_only":
		return trySubscription()
	case "wallet_first":
		if apiErr := tryWallet(); apiErr == nil {
			return nil
		}
		return trySubscription()
	case "subscription_first":
		fallthrough
	default:
		if apiErr := trySubscription(); apiErr == nil {
			return nil
		}
		return tryWallet()
	}
}

func validateDeferredWalletAndToken(relayInfo *relaycommon.RelayInfo, requiredQuota int) *types.NewAPIError {
	userQuota, err := model.GetUserQuota(relayInfo.UserId, false)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	relayInfo.UserQuota = userQuota
	if requiredQuota > 0 && userQuota < requiredQuota {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("insufficient quota"),
			types.ErrorCodeInsufficientUserQuota,
			http.StatusForbidden,
			types.ErrOptionWithSkipRetry(),
			types.ErrOptionWithNoRecordErrorLog(),
		)
	}
	if apiErr := validateImaProMinBalanceQuota(relayInfo, int64(userQuota)); apiErr != nil {
		return apiErr
	}
	return validateDeferredTokenOnly(relayInfo, requiredQuota)
}

func validateDeferredTokenOnly(relayInfo *relaycommon.RelayInfo, requiredQuota int) *types.NewAPIError {
	if relayInfo.IsPlayground || relayInfo.TokenUnlimited || requiredQuota <= 0 {
		return nil
	}
	token, err := model.GetTokenByKey(relayInfo.TokenKey, false)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	if token.RemainQuota < requiredQuota {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("insufficient token quota"),
			types.ErrorCodePreConsumeTokenQuotaFailed,
			http.StatusForbidden,
			types.ErrOptionWithSkipRetry(),
			types.ErrOptionWithNoRecordErrorLog(),
		)
	}
	return nil
}

func pickActiveSubscriptionForQuota(userID int, required int64) (*model.UserSubscription, *types.NewAPIError) {
	summaries, err := model.GetAllActiveUserSubscriptions(userID)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	if len(summaries) == 0 {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("insufficient quota"),
			types.ErrorCodeInsufficientUserQuota,
			http.StatusForbidden,
			types.ErrOptionWithSkipRetry(),
			types.ErrOptionWithNoRecordErrorLog(),
		)
	}

	for _, summary := range summaries {
		sub := summary.Subscription
		if sub == nil {
			continue
		}
		// amount_total <= 0 means unbounded by total amount.
		if sub.AmountTotal <= 0 {
			return sub, nil
		}
		remaining := sub.AmountTotal - sub.AmountUsed
		if remaining >= required {
			return sub, nil
		}
	}

	return nil, types.NewErrorWithStatusCode(
		fmt.Errorf("insufficient quota"),
		types.ErrorCodeInsufficientUserQuota,
		http.StatusForbidden,
		types.ErrOptionWithSkipRetry(),
		types.ErrOptionWithNoRecordErrorLog(),
	)
}

func resolveSubscriptionRemainQuota(sub *model.UserSubscription) int64 {
	if sub == nil {
		return 0
	}
	// amount_total <= 0 means unlimited quota for this subscription.
	if sub.AmountTotal <= 0 {
		return math.MaxInt64
	}
	remain := sub.AmountTotal - sub.AmountUsed
	if remain < 0 {
		return 0
	}
	return remain
}

func validateImaProMinBalanceQuota(relayInfo *relaycommon.RelayInfo, availableQuota int64) *types.NewAPIError {
	requiredQuota, enabled := resolveImaProMinBalanceRequiredQuota(relayInfo)
	if !enabled {
		return nil
	}
	if availableQuota >= int64(requiredQuota) {
		return nil
	}
	return newInsufficientQuotaRejectError()
}

func resolveImaProMinBalanceRequiredQuota(relayInfo *relaycommon.RelayInfo) (int, bool) {
	if relayInfo == nil {
		return 0, false
	}
	modelName := strings.ToLower(strings.TrimSpace(relayInfo.OriginModelName))
	if modelName != taskDeferredMinBalanceModelImaPro {
		return 0, false
	}
	cfg := operation_setting.GetPaymentSetting()
	if cfg == nil || !cfg.ImaProMinBalanceGateEnabled {
		return 0, false
	}
	if cfg.ImaProMinBalanceUSDThreshold <= 0 {
		return 0, false
	}
	if common.QuotaPerUnit <= 0 {
		common.SysError("ima-pro min balance gate skipped: invalid QuotaPerUnit")
		return 0, false
	}

	requiredQuota := int(math.Ceil(cfg.ImaProMinBalanceUSDThreshold * common.QuotaPerUnit))
	if requiredQuota <= 0 {
		return 0, false
	}
	return requiredQuota, true
}

func newInsufficientQuotaRejectError() *types.NewAPIError {
	return types.NewErrorWithStatusCode(
		fmt.Errorf("Insufficient quota"),
		types.ErrorCodeInsufficientUserQuota,
		http.StatusForbidden,
		types.ErrOptionWithSkipRetry(),
		types.ErrOptionWithNoRecordErrorLog(),
	)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
