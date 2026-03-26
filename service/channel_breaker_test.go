package service

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestClassifyChannelBreakerFailureType(t *testing.T) {
	tests := []struct {
		name string
		err  *types.NewAPIError
		want string
	}{
		{
			name: "rate limit",
			err:  types.NewOpenAIError(errors.New("rate limited"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
			want: ChannelBreakerErrorType429,
		},
		{
			name: "timeout",
			err:  types.NewError(errors.New("context deadline exceeded"), types.ErrorCodeChannelResponseTimeExceeded),
			want: ChannelBreakerErrorTypeTimeout,
		},
		{
			name: "cloudflare 524",
			err:  types.NewOpenAIError(errors.New("a timeout occurred"), types.ErrorCodeBadResponseStatusCode, 524),
			want: ChannelBreakerErrorType524,
		},
		{
			name: "balance insufficient",
			err:  types.NewOpenAIError(errors.New("insufficient balance"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden),
			want: ChannelBreakerErrorTypeBalanceInsufficient,
		},
		{
			name: "service unavailable",
			err:  types.NewOpenAIError(errors.New("service unavailable"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable),
			want: ChannelBreakerErrorTypeServiceUnavailable,
		},
		{
			name: "generic 5xx",
			err:  types.NewOpenAIError(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway),
			want: ChannelBreakerErrorType5xx,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, classifyChannelBreakerFailureType(tt.err))
		})
	}
}

func TestMarkTaskChannelBreakerFailureOpensBreaker(t *testing.T) {
	restore := common.SetChannelBreakerBackendForTest(common.NewInMemoryChannelBreakerBackend())
	defer restore()

	channel := &model.Channel{Id: 2001}
	channel.SetOtherSettings(dto.ChannelOtherSettings{
		BreakerEnabled:        true,
		BreakerThresholdCount: 1,
		BreakerWindowSeconds:  60,
		BreakerCooldownSeconds: 30,
		BreakerErrorTypes:     []string{ChannelBreakerErrorType429},
	})

	MarkTaskChannelBreakerFailure(channel, &dto.TaskError{
		StatusCode: http.StatusTooManyRequests,
		Error:      errors.New("rate limited"),
	})

	allowed, state, err := common.TryAcquireChannelBreakerAt(channel.Id, channel.GetOtherSettings().GetBreakerConfig(), time.Now())
	require.NoError(t, err)
	require.False(t, allowed)
	require.Equal(t, common.ChannelBreakerStateOpen, state)
}

func TestMarkTaskChannelBreakerFailureSkipsLocalError(t *testing.T) {
	restore := common.SetChannelBreakerBackendForTest(common.NewInMemoryChannelBreakerBackend())
	defer restore()

	channel := &model.Channel{Id: 2002}
	channel.SetOtherSettings(dto.ChannelOtherSettings{
		BreakerEnabled:        true,
		BreakerThresholdCount: 1,
		BreakerWindowSeconds:  60,
		BreakerCooldownSeconds: 30,
		BreakerErrorTypes:     []string{ChannelBreakerErrorType429},
	})

	MarkTaskChannelBreakerFailure(channel, &dto.TaskError{
		StatusCode: http.StatusTooManyRequests,
		LocalError: true,
		Error:      errors.New("local failure"),
	})

	allowed, state, err := common.TryAcquireChannelBreakerAt(channel.Id, channel.GetOtherSettings().GetBreakerConfig(), time.Now())
	require.NoError(t, err)
	require.True(t, allowed)
	require.Equal(t, common.ChannelBreakerStateClosed, state)
}
