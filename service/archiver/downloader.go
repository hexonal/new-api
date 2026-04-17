package archiver

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/hashicorp/go-retryablehttp"
)

const (
	downloadPerAttemptTimeout = 30 * time.Second
	downloadMaxAttempts       = 3
	downloadBaseBackoff       = 500 * time.Millisecond
	downloadMaxBackoff        = 5 * time.Second
	downloaderUserAgent       = "new-api-downloader/1.0"
)

// HTTPClientProvider 返回配置了代理/SSRF/TLS 的 *http.Client。
// 由 service 包在初始化时通过 SetHTTPClientProvider 注入，避免 archiver → service 包循环依赖。
type HTTPClientProvider func(proxy string) (*http.Client, error)

// WorkerDownloader 通过 Cloudflare Worker 代理下载；由 service 包注入。
type WorkerDownloader func(ctx context.Context, sourceURL string, key string, purpose string) (*http.Response, error)

var (
	httpClientProvider HTTPClientProvider
	workerDownloader   WorkerDownloader
)

// SetHTTPClientProvider 由 service 包注入 HTTP 客户端工厂。
func SetHTTPClientProvider(p HTTPClientProvider) {
	httpClientProvider = p
}

// SetWorkerDownloader 由 service 包注入 Worker 下载函数。
func SetWorkerDownloader(w WorkerDownloader) {
	workerDownloader = w
}

type httpDownloader struct{}

func newHTTPDownloader() *httpDownloader {
	return &httpDownloader{}
}

// Fetch 从 Source 获取 Blob。
// - Source.Bytes 非空：直接返回，不走网络；
// - Source.URL 非空：走 Worker（若开启）或 retryablehttp 直连，30s per-attempt 超时，
//   3 次重试，Content-Length 强校验。
func (d *httpDownloader) Fetch(ctx context.Context, src Source, maxBytes int64) (Blob, error) {
	if len(src.Bytes) > 0 {
		return Blob{Data: src.Bytes}, nil
	}
	if strings.TrimSpace(src.URL) == "" {
		return Blob{}, fmt.Errorf("source is empty: neither URL nor Bytes provided")
	}
	if system_setting.EnableWorker() && workerDownloader != nil {
		return d.fetchViaWorker(ctx, src.URL, maxBytes)
	}
	return d.fetchViaRetryable(ctx, src, maxBytes)
}

func (d *httpDownloader) fetchViaWorker(ctx context.Context, sourceURL string, maxBytes int64) (Blob, error) {
	attemptCtx, cancel := context.WithTimeout(ctx, downloadPerAttemptTimeout)
	defer cancel()
	resp, err := workerDownloader(attemptCtx, sourceURL, "", "media archive")
	if err != nil {
		return Blob{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Blob{}, fmt.Errorf("download status %d", resp.StatusCode)
	}
	return readBodyWithCheck(resp, maxBytes)
}

func (d *httpDownloader) fetchViaRetryable(ctx context.Context, src Source, maxBytes int64) (Blob, error) {
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(
		src.URL,
		fetchSetting.EnableSSRFProtection,
		fetchSetting.AllowPrivateIp,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		fetchSetting.ApplyIPFilterForDomain,
	); err != nil {
		return Blob{}, fmt.Errorf("request reject: %v", err)
	}

	if httpClientProvider == nil {
		return Blob{}, fmt.Errorf("archiver: HTTPClientProvider not configured")
	}
	baseClient, err := httpClientProvider(src.Proxy)
	if err != nil {
		return Blob{}, err
	}
	perAttemptClient := *baseClient
	perAttemptClient.Timeout = downloadPerAttemptTimeout

	rc := retryablehttp.NewClient()
	rc.HTTPClient = &perAttemptClient
	rc.RetryMax = downloadMaxAttempts - 1
	rc.RetryWaitMin = downloadBaseBackoff
	rc.RetryWaitMax = downloadMaxBackoff
	rc.Backoff = retryablehttp.LinearJitterBackoff
	rc.Logger = nil

	req, err := retryablehttp.NewRequestWithContext(ctx, http.MethodGet, src.URL, nil)
	if err != nil {
		return Blob{}, err
	}
	req.Header.Set("User-Agent", downloaderUserAgent)
	common.SysLog(fmt.Sprintf("media archive downloading: %s", common.MaskSensitiveInfo(src.URL)))

	resp, err := rc.Do(req)
	if err != nil {
		return Blob{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Blob{}, fmt.Errorf("download status %d", resp.StatusCode)
	}
	return readBodyWithCheck(resp, maxBytes)
}

// readBodyWithCheck 读取响应体并做三层校验：
// 1. Content-Length > maxBytes：提前拒绝，省带宽；
// 2. 实际字节数 > maxBytes：拒绝；
// 3. Content-Length >= 0 且与实际字节不等：判中途断流/截断。
func readBodyWithCheck(resp *http.Response, maxBytes int64) (Blob, error) {
	if resp.ContentLength > maxBytes {
		return Blob{}, fmt.Errorf("declared content length %d exceeds limit %d", resp.ContentLength, maxBytes)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return Blob{}, err
	}
	if int64(len(data)) > maxBytes {
		return Blob{}, fmt.Errorf("payload exceeds limit %d", maxBytes)
	}
	if resp.ContentLength >= 0 && int64(len(data)) != resp.ContentLength {
		return Blob{}, fmt.Errorf("truncated body: got %d bytes, content-length %d", len(data), resp.ContentLength)
	}
	return Blob{Data: data, MimeType: ExtractContentType(resp.Header.Get("Content-Type"))}, nil
}
