package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	callbackCleanupRetentionDays = 3
	callbackCleanupHour          = 0
	callbackCleanupMinute        = 0
)

var (
	callbackCleanupOnce    sync.Once
	callbackCleanupRunning atomic.Bool
)

// StartCallbackEventCleanupTask starts a daily cleanup at midnight.
// It removes callback log data older than 3 days.
func StartCallbackEventCleanupTask() {
	callbackCleanupOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}

		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf(
				"callback cleanup task started: daily %02d:%02d retention_days=%d",
				callbackCleanupHour,
				callbackCleanupMinute,
				callbackCleanupRetentionDays,
			))
			for {
				waitDuration := durationUntilNextCallbackCleanup(time.Now())
				timer := time.NewTimer(waitDuration)
				<-timer.C
				runCallbackCleanupOnce(time.Now())
			}
		})
	})
}

func durationUntilNextCallbackCleanup(now time.Time) time.Duration {
	nextRun := time.Date(
		now.Year(),
		now.Month(),
		now.Day(),
		callbackCleanupHour,
		callbackCleanupMinute,
		0,
		0,
		now.Location(),
	)
	if !now.Before(nextRun) {
		nextRun = nextRun.Add(24 * time.Hour)
	}
	return nextRun.Sub(now)
}

func runCallbackCleanupOnce(now time.Time) {
	if !callbackCleanupRunning.CompareAndSwap(false, true) {
		return
	}
	defer callbackCleanupRunning.Store(false)

	cutoffTimestamp := now.AddDate(0, 0, -callbackCleanupRetentionDays).Unix()
	deletedEvents, deletedAttempts, err := model.CleanupCallbackEventsBefore(cutoffTimestamp)
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("callback cleanup task failed: %v", err))
		return
	}
	logger.LogInfo(context.Background(), fmt.Sprintf(
		"callback cleanup task finished: cutoff=%d deleted_events=%d deleted_attempts=%d",
		cutoffTimestamp,
		deletedEvents,
		deletedAttempts,
	))
}
