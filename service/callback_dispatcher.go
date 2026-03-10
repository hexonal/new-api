package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	callbackDispatchDefaultRetryTimes       = 3
	callbackDispatchDefaultInitialBackoffMs = 200
	callbackDispatchDefaultMaxBackoffMs     = 5000
	callbackDispatchDefaultWorkerCount      = 2
	callbackDispatchDefaultQueueCapacity    = 256

	callbackDispatchPollInterval   = 1 * time.Second
	callbackDispatchClaimBatchSize = 64
	callbackDispatchLeaseSeconds   = 60
	callbackDispatchTimeout        = 5 * time.Second

	callbackResponseBodyLogMaxLen = 512
)

type callbackDispatchConfig struct {
	RetryTimes       int
	InitialBackoffMs int
	MaxBackoffMs     int
	WorkerCount      int
	QueueCapacity    int
}

type callbackDispatcher struct {
	nodeID string
	queue  chan *model.CallbackEvent
}

var (
	callbackDispatcherOnce sync.Once
	callbackDispatcherInst *callbackDispatcher
)

func StartCallbackDispatcher() {
	callbackDispatcherOnce.Do(func() {
		cfg := getCallbackDispatchConfig()
		queueCap := cfg.QueueCapacity
		if queueCap <= 0 {
			queueCap = callbackDispatchDefaultQueueCapacity
		}

		d := &callbackDispatcher{
			nodeID: buildCallbackNodeID(),
			queue:  make(chan *model.CallbackEvent, queueCap),
		}
		callbackDispatcherInst = d

		workerCount := cfg.WorkerCount
		if workerCount <= 0 {
			workerCount = callbackDispatchDefaultWorkerCount
		}
		for i := 0; i < workerCount; i++ {
			go d.workerLoop()
		}
		go d.pollLoop()
		common.SysLog(fmt.Sprintf("callback dispatcher started: workers=%d queue=%d retry_times=%d", workerCount, queueCap, cfg.RetryTimes))
	})
}

func getCallbackDispatchConfig() callbackDispatchConfig {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	cfg := callbackDispatchConfig{
		RetryTimes:       parseCallbackIntOption(common.OptionMap["ConsumeCallbackRetryTimes"], callbackDispatchDefaultRetryTimes, 0, 20),
		InitialBackoffMs: parseCallbackIntOption(common.OptionMap["ConsumeCallbackInitialBackoffMs"], callbackDispatchDefaultInitialBackoffMs, 50, 600000),
		MaxBackoffMs:     parseCallbackIntOption(common.OptionMap["ConsumeCallbackMaxBackoffMs"], callbackDispatchDefaultMaxBackoffMs, 50, 3600000),
		WorkerCount:      parseCallbackIntOption(common.OptionMap["ConsumeCallbackWorkerCount"], callbackDispatchDefaultWorkerCount, 1, 64),
		QueueCapacity:    parseCallbackIntOption(common.OptionMap["ConsumeCallbackQueueCapacity"], callbackDispatchDefaultQueueCapacity, 1, 20000),
	}
	if cfg.MaxBackoffMs < cfg.InitialBackoffMs {
		cfg.MaxBackoffMs = cfg.InitialBackoffMs
	}
	return cfg
}

func parseCallbackIntOption(raw string, defaultVal int, minVal int, maxVal int) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return defaultVal
	}
	if v < minVal {
		return minVal
	}
	if v > maxVal {
		return maxVal
	}
	return v
}

func buildCallbackNodeID() string {
	host := strings.TrimSpace(common.GetEnvOrDefaultString("HOSTNAME", "node"))
	if host == "" {
		host = "node"
	}
	return fmt.Sprintf("%s-%s", host, common.GetUUID()[:8])
}

func (d *callbackDispatcher) pollLoop() {
	ticker := time.NewTicker(callbackDispatchPollInterval)
	defer ticker.Stop()
	for range ticker.C {
		d.dispatchOnce()
	}
}

func (d *callbackDispatcher) dispatchOnce() {
	available := cap(d.queue) - len(d.queue)
	if available <= 0 {
		return
	}
	limit := available
	if limit > callbackDispatchClaimBatchSize {
		limit = callbackDispatchClaimBatchSize
	}
	events, err := model.ClaimDueCallbackEvents(limit, d.nodeID, callbackDispatchLeaseSeconds)
	if err != nil {
		common.SysError(fmt.Sprintf("claim callback events failed: %s", err.Error()))
		return
	}
	// Dispatcher only moves claimed DB events to local workers.
	// Durable retry semantics remain in DB state transitions.
	for _, event := range events {
		d.queue <- event
	}
}

func (d *callbackDispatcher) workerLoop() {
	for event := range d.queue {
		d.processEvent(event)
	}
}

func (d *callbackDispatcher) processEvent(event *model.CallbackEvent) {
	if event == nil {
		return
	}
	if shouldCancelCallbackEvent(event) {
		if err := model.MarkCallbackEventCancelled(event.ID, "callback cancelled: monitor alert disabled", common.GetTimestamp()); err != nil {
			common.SysError(fmt.Sprintf("mark callback event cancelled failed: id=%d err=%s", event.ID, err.Error()))
		}
		return
	}
	cfg := getCallbackDispatchConfig()
	attemptNo := event.AttemptCount + 1
	startedAt := common.GetTimestamp()
	firstAttemptAt := event.FirstAttemptAt
	if firstAttemptAt == 0 {
		firstAttemptAt = startedAt
	}

	statusCode, responseSnippet, sendErr := d.sendEvent(event, attemptNo)
	finishedAt := common.GetTimestamp()

	success := sendErr == nil && statusCode >= http.StatusOK && statusCode < http.StatusMultipleChoices
	logErrMsg := buildCallbackErrorMessage(sendErr, statusCode, responseSnippet)
	if success {
		if err := model.MarkCallbackEventSucceeded(event.ID, attemptNo, statusCode, firstAttemptAt, finishedAt); err != nil {
			common.SysError(fmt.Sprintf("mark callback event succeeded failed: id=%d err=%s", event.ID, err.Error()))
		}
		_ = model.InsertCallbackEventAttempt(&model.CallbackEventAttempt{
			EventID:         event.ID,
			AttemptNo:       attemptNo,
			StartedAt:       startedAt,
			FinishedAt:      finishedAt,
			HTTPStatus:      statusCode,
			Success:         true,
			Error:           "",
			ResponseSnippet: responseSnippet,
			NodeID:          d.nodeID,
		})
		return
	}

	maxRetries := event.MaxRetries
	if maxRetries < 0 {
		maxRetries = cfg.RetryTimes
	}
	if maxRetries < 0 {
		maxRetries = 0
	}

	retriesUsed := attemptNo - 1
	retryable := shouldRetryCallback(statusCode, sendErr)
	if retryable && retriesUsed < maxRetries {
		retryIndex := retriesUsed + 1
		delay := calculateCallbackBackoff(cfg.InitialBackoffMs, cfg.MaxBackoffMs, retryIndex)
		delaySeconds := int64((delay + time.Second - 1) / time.Second)
		if delaySeconds < 1 {
			delaySeconds = 1
		}
		nextRetryAt := finishedAt + delaySeconds
		if err := model.MarkCallbackEventRetryWait(event.ID, attemptNo, nextRetryAt, statusCode, logErrMsg, firstAttemptAt, finishedAt); err != nil {
			common.SysError(fmt.Sprintf("mark callback event retry_wait failed: id=%d err=%s", event.ID, err.Error()))
		}
	} else {
		if err := model.MarkCallbackEventDead(event.ID, attemptNo, statusCode, logErrMsg, firstAttemptAt, finishedAt); err != nil {
			common.SysError(fmt.Sprintf("mark callback event dead failed: id=%d err=%s", event.ID, err.Error()))
		}
		NotifyMonitorCallbackError(event, attemptNo, statusCode, logErrMsg, responseSnippet)
	}
	_ = model.InsertCallbackEventAttempt(&model.CallbackEventAttempt{
		EventID:         event.ID,
		AttemptNo:       attemptNo,
		StartedAt:       startedAt,
		FinishedAt:      finishedAt,
		HTTPStatus:      statusCode,
		Success:         false,
		Error:           logErrMsg,
		ResponseSnippet: responseSnippet,
		NodeID:          d.nodeID,
	})
}

func shouldCancelCallbackEvent(event *model.CallbackEvent) bool {
	if event == nil {
		return false
	}
	if !isMonitorAlertCallbackEvent(event) {
		return false
	}
	return !getMonitorAlertConfig().Enabled
}

func calculateCallbackBackoff(initialMs int, maxMs int, retryIndex int) time.Duration {
	if retryIndex <= 0 {
		retryIndex = 1
	}
	delay := time.Duration(initialMs) * time.Millisecond
	maxDelay := time.Duration(maxMs) * time.Millisecond
	for i := 1; i < retryIndex; i++ {
		delay *= 2
		if delay >= maxDelay {
			delay = maxDelay
			break
		}
	}
	if delay > maxDelay {
		delay = maxDelay
	}
	// +/- 20% jitter, avoid retry storms.
	jitter := delay / 5
	if jitter > 0 {
		delta := time.Duration(rand.Int63n(int64(jitter*2+1))) - jitter
		delay += delta
	}
	if delay < 50*time.Millisecond {
		delay = 50 * time.Millisecond
	}
	return delay
}

func shouldRetryCallback(statusCode int, err error) bool {
	// Any delivery failure should be retried until MaxRetries is exhausted.
	// This keeps behavior deterministic and aligns with operator expectations.
	if err != nil {
		return true
	}
	if statusCode == 0 {
		return true
	}
	return statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices
}

func buildCallbackErrorMessage(sendErr error, statusCode int, responseSnippet string) string {
	if statusCode > 0 {
		if strings.TrimSpace(responseSnippet) == "" {
			return fmt.Sprintf("callback status=%d", statusCode)
		}
		return fmt.Sprintf("callback status=%d, body: %s", statusCode, strings.TrimSpace(responseSnippet))
	}
	if sendErr != nil {
		return sendErr.Error()
	}
	if statusCode == 0 {
		return "callback send failed: unknown error"
	}
	return "callback send failed: unknown error"
}

func (d *callbackDispatcher) sendEvent(event *model.CallbackEvent, attemptNo int) (int, string, error) {
	method := normalizeCallbackMethod(event.HTTPMethod)
	// Keep webhook method deterministic across all sinks.
	// This avoids behavior drift from unexpected method configuration.
	if method != http.MethodPost {
		method = http.MethodPost
	}

	headers := map[string]string{}
	if strings.TrimSpace(event.Headers) != "" {
		_ = json.Unmarshal([]byte(event.Headers), &headers)
	}
	headers["Content-Type"] = normalizeContentType(event.ContentType)
	headers["X-New-Api-Event-Id"] = event.EventID
	headers["X-New-Api-Idempotency-Key"] = event.IdempotencyKey
	headers["X-New-Api-Attempt"] = strconv.Itoa(attemptNo)

	ctx, cancel := context.WithTimeout(context.Background(), callbackDispatchTimeout)
	defer cancel()

	if system_setting.EnableWorker() {
		return sendCallbackByWorker(ctx, event.CallbackURL, method, headers, []byte(event.Body))
	}
	return sendCallbackDirect(ctx, event.CallbackURL, method, headers, []byte(event.Body))
}

func sendCallbackByWorker(ctx context.Context, url string, method string, headers map[string]string, body []byte) (int, string, error) {
	workerReq := &WorkerRequest{
		URL:     url,
		Key:     system_setting.WorkerValidKey,
		Method:  method,
		Headers: headers,
		Body:    body,
	}
	resp, err := DoWorkerRequestWithContext(ctx, workerReq)
	if err != nil {
		return 0, "", fmt.Errorf("worker request failed: %w", err)
	}
	defer CloseResponseBodyGracefully(resp)

	responseSnippet, _ := io.ReadAll(io.LimitReader(resp.Body, callbackResponseBodyLogMaxLen))
	snippet := strings.TrimSpace(string(responseSnippet))
	if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
		return resp.StatusCode, snippet, nil
	}
	// Non-2xx response is still a completed HTTP call.
	// Return status/snippet and let caller build unified error message.
	return resp.StatusCode, snippet, nil
}

func sendCallbackDirect(ctx context.Context, url string, method string, headers map[string]string, body []byte) (int, string, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return 0, "", fmt.Errorf("build request: %w", err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, "", fmt.Errorf("send request: %w", err)
	}
	defer CloseResponseBodyGracefully(resp)

	responseSnippet, _ := io.ReadAll(io.LimitReader(resp.Body, callbackResponseBodyLogMaxLen))
	snippet := strings.TrimSpace(string(responseSnippet))
	if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
		return resp.StatusCode, snippet, nil
	}
	// Non-2xx response is still a completed HTTP call.
	// Return status/snippet and let caller build unified error message.
	return resp.StatusCode, snippet, nil
}
