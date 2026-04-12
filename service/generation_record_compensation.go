package service

import (
	"context"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

const (
	compensationQueueSize   = 1024
	compensationMaxAttempts = 3
	compensationRetryDelay  = 5 * time.Second
)

type compensationItem struct {
	record   *model.GenerationRecord
	attempts int
}

var (
	compensationQueue     chan *compensationItem
	compensationOnce      sync.Once
	compensationSemaphore chan struct{}
)

// StartGenerationRecordCompensation 在启动时调用一次
func StartGenerationRecordCompensation() {
	compensationOnce.Do(func() {
		compensationQueue = make(chan *compensationItem, compensationQueueSize)
		compensationSemaphore = make(chan struct{}, 16)
		go compensationWorker()
	})
}

func enqueueCompensation(rec *model.GenerationRecord) {
	if compensationQueue == nil {
		return
	}
	select {
	case compensationQueue <- &compensationItem{record: rec, attempts: 0}:
	default:
		logger.LogError(context.Background(), "generation record compensation queue full, dropping: "+rec.RecordKey)
	}
}

func compensationWorker() {
	for item := range compensationQueue {
		compensationSemaphore <- struct{}{}
		go func(i *compensationItem) {
			defer func() { <-compensationSemaphore }()
			time.Sleep(compensationRetryDelay)
			err := model.InsertPending(i.record)
			if err == nil {
				return
			}
			i.attempts++
			if i.attempts >= compensationMaxAttempts {
				logger.LogError(context.Background(),
					"generation record compensation gave up: "+i.record.RecordKey+" err="+err.Error())
				return
			}
			select {
			case compensationQueue <- i:
			default:
				logger.LogError(context.Background(), "compensation requeue failed, dropping: "+i.record.RecordKey)
			}
		}(item)
	}
}
