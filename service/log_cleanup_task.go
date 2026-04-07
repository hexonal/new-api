package service

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	logCleanupHour             = 0
	logCleanupMinute           = 15
	logCleanupDefaultRetention = 0
	logCleanupDeleteBatchLimit = 500
)

var (
	logCleanupOnce    sync.Once
	logCleanupRunning atomic.Bool
)

func StartLogCleanupTask() {
	logCleanupOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf(
				"log cleanup task started: daily %02d:%02d option=LogCleanupRetentionDays",
				logCleanupHour,
				logCleanupMinute,
			))
			for {
				waitDuration := durationUntilNextLogCleanup(time.Now())
				timer := time.NewTimer(waitDuration)
				<-timer.C
				runLogCleanupOnce(time.Now())
			}
		})
	})
}

func durationUntilNextLogCleanup(now time.Time) time.Duration {
	nextRun := time.Date(
		now.Year(),
		now.Month(),
		now.Day(),
		logCleanupHour,
		logCleanupMinute,
		0,
		0,
		now.Location(),
	)
	if !now.Before(nextRun) {
		nextRun = nextRun.Add(24 * time.Hour)
	}
	return nextRun.Sub(now)
}

func getLogCleanupRetentionDays() int {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap["LogCleanupRetentionDays"]
	common.OptionMapRWMutex.RUnlock()
	if raw == "" {
		return logCleanupDefaultRetention
	}
	days, err := strconv.Atoi(raw)
	if err != nil || days < 0 {
		return logCleanupDefaultRetention
	}
	return days
}

func runLogCleanupOnce(now time.Time) {
	if !logCleanupRunning.CompareAndSwap(false, true) {
		return
	}
	defer logCleanupRunning.Store(false)

	retentionDays := getLogCleanupRetentionDays()
	if retentionDays <= 0 {
		return
	}

	cutoffTimestamp := now.AddDate(0, 0, -retentionDays).Unix()
	deletedCount, err := model.DeleteOldLog(context.Background(), cutoffTimestamp, logCleanupDeleteBatchLimit)
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("log cleanup task failed: %v", err))
		return
	}
	logger.LogInfo(context.Background(), fmt.Sprintf(
		"log cleanup task finished: cutoff=%d retention_days=%d deleted_logs=%d",
		cutoffTimestamp,
		retentionDays,
		deletedCount,
	))
}
