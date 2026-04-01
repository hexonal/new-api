package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"golang.org/x/time/rate"
)

const (
	defaultPoolSize     = 50
	workerPoolBufferMul = 2
	pollTimeoutSeconds  = 10 // hard timeout for FetchTask HTTP requests
)

var (
	taskPool        chan taskDispatchItem
	channelLimiters *channelRateLimiter
	poolOnce        sync.Once
)

type taskDispatchItem struct {
	ctx     context.Context
	taskId  string // upstream task ID (key in taskM)
	taskM   map[string]*model.Task
	adaptor TaskPollingAdaptor
	channel *model.Channel
}

type channelRateLimiter struct {
	mu         sync.RWMutex
	limiters   map[int]*rate.Limiter
	channelQPS map[int]float64
}

func newChannelRateLimiter() *channelRateLimiter {
	return &channelRateLimiter{
		limiters:   make(map[int]*rate.Limiter),
		channelQPS: make(map[int]float64),
	}
}

func (c *channelRateLimiter) getForChannel(channelId int, channelQPS float64) *rate.Limiter {
	if channelQPS <= 0 {
		return nil // no rate limiting
	}

	c.mu.RLock()
	if l, ok := c.limiters[channelId]; ok && c.channelQPS[channelId] == channelQPS {
		c.mu.RUnlock()
		return l
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()
	if l, ok := c.limiters[channelId]; ok && c.channelQPS[channelId] == channelQPS {
		return l
	}
	burst := int(channelQPS) + 1
	if burst > 5 {
		burst = 5
	}
	l := rate.NewLimiter(rate.Limit(channelQPS), burst)
	c.limiters[channelId] = l
	c.channelQPS[channelId] = channelQPS
	return l
}

func initWorkerPools() {
	poolOnce.Do(func() {
		poolSize := common.GetEnvOrDefault("TASK_POOL_SIZE", defaultPoolSize)

		taskPool = make(chan taskDispatchItem, poolSize*workerPoolBufferMul)
		channelLimiters = newChannelRateLimiter()

		for i := 0; i < poolSize; i++ {
			go taskWorker(taskPool)
		}

		common.SysLog(fmt.Sprintf("task worker pool initialized: size=%d", poolSize))
	})
}

func taskWorker(ch <-chan taskDispatchItem) {
	for item := range ch {
		processTaskDispatchItem(item)
	}
}

func processTaskDispatchItem(item taskDispatchItem) {
	task := item.taskM[item.taskId]
	if task == nil {
		return
	}

	// Acquire lease BEFORE rate-limit wait to prevent duplicate dispatch
	// when local queue delay exceeds Redis lease TTL (120s)
	leaseToken, claimed := tryAcquireTaskPollingLease(item.taskId)
	if !claimed {
		return
	}
	defer releaseTaskPollingLease(item.taskId, leaseToken)

	// Optional rate limiting: only when admin explicitly sets poll_qps > 0
	if item.channel != nil {
		settings := item.channel.GetSetting()
		if settings.PollQPS > 0 {
			limiter := channelLimiters.getForChannel(task.ChannelId, settings.PollQPS)
			if limiter != nil {
				waitCtx, waitCancel := context.WithTimeout(item.ctx, taskPollingLockTTL/2)
				err := limiter.Wait(waitCtx)
				waitCancel()
				if err != nil {
					if task = item.taskM[item.taskId]; task != nil {
						RescheduleTask(task.TaskID, time.Now().Unix()+getTaskBackoffSeconds(task, item.channel))
					}
					return
				}
			}
		}
	}

	// Hard timeout for FetchTask HTTP — prevents hung connections from freezing workers
	pollCtx, cancel := context.WithTimeout(item.ctx, time.Duration(pollTimeoutSeconds)*time.Second)
	defer cancel()

	if err := updateVideoSingleTask(pollCtx, item.adaptor, item.channel, item.taskId, item.taskM); err != nil {
		logger.LogError(item.ctx, fmt.Sprintf("worker: failed to update video task %s: %s", item.taskId, err.Error()))
	}

	if task = item.taskM[item.taskId]; task != nil && !isTaskTerminalForPollingQueue(task) {
		RescheduleTask(task.TaskID, time.Now().Unix()+getTaskBackoffSeconds(task, item.channel))
	}
}
