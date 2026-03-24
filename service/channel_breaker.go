package service

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

const (
	ChannelBreakerErrorTypeBalanceInsufficient = "balance_insufficient"
	ChannelBreakerErrorTypeServiceUnavailable  = "service_unavailable"
	ChannelBreakerErrorType429                 = "429"
	ChannelBreakerErrorType5xx                 = "5xx"
	ChannelBreakerErrorTypeTimeout             = "timeout"
	ChannelBreakerErrorType524                 = "524"
)

func MarkChannelBreakerSuccess(channel *model.Channel) {
	if channel == nil {
		return
	}
	cfg := channel.GetOtherSettings().GetBreakerConfig()
	if !cfg.Enabled {
		return
	}
	if err := common.MarkChannelBreakerSuccess(channel.Id, cfg); err != nil {
		common.SysError("mark channel breaker success failed: " + err.Error())
	}
}

func MarkChannelBreakerFailure(channel *model.Channel, apiErr *types.NewAPIError) {
	if channel == nil || apiErr == nil {
		return
	}
	cfg := channel.GetOtherSettings().GetBreakerConfig()
	if !cfg.Enabled {
		return
	}
	failureType := classifyChannelBreakerFailureType(apiErr)
	opened, err := common.RecordChannelBreakerFailureAt(channel.Id, cfg, failureType, time.Now())
	if err != nil {
		common.SysError("mark channel breaker failure failed: " + err.Error())
		return
	}
	if opened {
		common.SysLog("channel breaker opened for channel #" + strconv.Itoa(channel.Id) + " by failure type " + failureType)
	}
}

func MarkTaskChannelBreakerFailure(channel *model.Channel, taskErr *dto.TaskError) {
	if channel == nil || taskErr == nil || taskErr.LocalError {
		return
	}
	cfg := channel.GetOtherSettings().GetBreakerConfig()
	if !cfg.Enabled {
		return
	}
	failureType := classifyTaskChannelBreakerFailureType(taskErr)
	opened, err := common.RecordChannelBreakerFailureAt(channel.Id, cfg, failureType, time.Now())
	if err != nil {
		common.SysError("mark task channel breaker failure failed: " + err.Error())
		return
	}
	if opened {
		common.SysLog("channel breaker opened for channel #" + strconv.Itoa(channel.Id) + " by task failure type " + failureType)
	}
}

func classifyChannelBreakerFailureType(apiErr *types.NewAPIError) string {
	if apiErr == nil {
		return ""
	}
	statusCode := apiErr.StatusCode
	message := strings.ToLower(apiErr.Error())
	errorCode := strings.ToLower(string(apiErr.GetErrorCode()))
	errorType := strings.ToLower(string(apiErr.GetErrorType()))
	openaiErr := apiErr.ToOpenAIError()
	openAICode := strings.ToLower(strings.TrimSpace(anyToString(openaiErr.Code)))
	openAIType := strings.ToLower(strings.TrimSpace(openaiErr.Type))

	if statusCode == 524 {
		return ChannelBreakerErrorType524
	}
	if statusCode == http.StatusTooManyRequests {
		return ChannelBreakerErrorType429
	}
	if isTimeoutBreakerError(statusCode, message, errorCode, openAICode) {
		return ChannelBreakerErrorTypeTimeout
	}
	if isBalanceBreakerError(statusCode, message, errorCode, errorType, openAICode, openAIType) {
		return ChannelBreakerErrorTypeBalanceInsufficient
	}
	if statusCode == http.StatusServiceUnavailable || strings.Contains(message, "service unavailable") {
		return ChannelBreakerErrorTypeServiceUnavailable
	}
	if statusCode >= 500 && statusCode <= 599 {
		return ChannelBreakerErrorType5xx
	}
	return ""
}

func classifyTaskChannelBreakerFailureType(taskErr *dto.TaskError) string {
	if taskErr == nil {
		return ""
	}
	message := ""
	if taskErr.Error != nil {
		message = strings.ToLower(taskErr.Error.Error())
	}
	if message == "" {
		message = strings.ToLower(taskErr.Message)
	}
	if taskErr.StatusCode == 524 {
		return ChannelBreakerErrorType524
	}
	if taskErr.StatusCode == http.StatusTooManyRequests {
		return ChannelBreakerErrorType429
	}
	if isTimeoutBreakerError(taskErr.StatusCode, message, "", "") {
		return ChannelBreakerErrorTypeTimeout
	}
	if isBalanceBreakerError(taskErr.StatusCode, message, "", "", "", "") {
		return ChannelBreakerErrorTypeBalanceInsufficient
	}
	if taskErr.StatusCode == http.StatusServiceUnavailable || strings.Contains(message, "service unavailable") {
		return ChannelBreakerErrorTypeServiceUnavailable
	}
	if taskErr.StatusCode >= 500 && taskErr.StatusCode <= 599 {
		return ChannelBreakerErrorType5xx
	}
	return ""
}

func isTimeoutBreakerError(statusCode int, message string, errorCode string, openAICode string) bool {
	if statusCode == http.StatusRequestTimeout {
		return true
	}
	if errorCode == string(types.ErrorCodeChannelResponseTimeExceeded) {
		return true
	}
	if openAICode == string(types.ErrorCodeChannelResponseTimeExceeded) {
		return true
	}
	return strings.Contains(message, "deadline exceeded") || strings.Contains(message, "timeout") || strings.Contains(message, "timed out")
}

func isBalanceBreakerError(statusCode int, message string, errorCode string, errorType string, openAICode string, openAIType string) bool {
	if statusCode != http.StatusForbidden && statusCode != http.StatusPaymentRequired {
		if !strings.Contains(message, "balance") && !strings.Contains(message, "quota") && !strings.Contains(message, "arrearage") && !strings.Contains(message, "余额") {
			return false
		}
	}
	keywords := []string{"insufficient balance", "balance insufficient", "billing_not_active", "insufficient_quota", "arrearage", "余额不足", "quota exceeded"}
	for _, keyword := range keywords {
		if strings.Contains(message, keyword) || strings.Contains(errorCode, keyword) || strings.Contains(errorType, keyword) || strings.Contains(openAICode, keyword) || strings.Contains(openAIType, keyword) {
			return true
		}
	}
	return openAICode == "billing_not_active" || openAIType == "insufficient_quota"
}

func anyToString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	default:
		return strings.TrimSpace(strings.ToLower(strings.TrimSpace(common.Interface2String(v))))
	}
}
