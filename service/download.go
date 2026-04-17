package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// WorkerRequest Worker请求的数据结构
type WorkerRequest struct {
	URL     string            `json:"url"`
	Key     string            `json:"key"`
	Method  string            `json:"method,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    json.RawMessage   `json:"body,omitempty"`
}

// DoWorkerRequest 通过Worker发送请求
func DoWorkerRequest(req *WorkerRequest) (*http.Response, error) {
	return DoWorkerRequestWithContext(context.Background(), req)
}

// DoWorkerRequestWithContext sends request through worker with cancel/timeout support.
func DoWorkerRequestWithContext(ctx context.Context, req *WorkerRequest) (*http.Response, error) {
	if !system_setting.EnableWorker() {
		return nil, fmt.Errorf("worker not enabled")
	}
	if !system_setting.WorkerAllowHttpImageRequestEnabled && !strings.HasPrefix(req.URL, "https") {
		return nil, fmt.Errorf("only support https url")
	}

	// SSRF防护：验证请求URL
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(req.URL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return nil, fmt.Errorf("request reject: %v", err)
	}

	workerUrl := system_setting.WorkerUrl
	if !strings.HasSuffix(workerUrl, "/") {
		workerUrl += "/"
	}

	// 序列化worker请求数据
	workerPayload, err := common.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal worker payload: %v", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, workerUrl, bytes.NewBuffer(workerPayload))
	if err != nil {
		return nil, fmt.Errorf("failed to build worker request: %v", err)
	}
	request.Header.Set("Content-Type", "application/json")

	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}

	return client.Do(request)
}

func DoDownloadRequest(originUrl string, reason ...string) (resp *http.Response, err error) {
	return DoDownloadRequestWithContext(context.Background(), originUrl, "", reason...)
}

// DoDownloadRequestWithContext 下载远端资源，统一走 Worker / SSRF / 代理 / User-Agent 路径。
// ctx 支持单次尝试的超时或取消；proxyURL 为空时走全局 http client。
func DoDownloadRequestWithContext(ctx context.Context, originURL string, proxyURL string, reason ...string) (*http.Response, error) {
	if system_setting.EnableWorker() {
		common.SysLog(fmt.Sprintf("downloading file from worker: %s, reason: %s", common.MaskSensitiveInfo(originURL), strings.Join(reason, ", ")))
		return DoWorkerRequestWithContext(ctx, &WorkerRequest{
			URL: originURL,
			Key: system_setting.WorkerValidKey,
		})
	}
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(originURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return nil, fmt.Errorf("request reject: %v", err)
	}
	client, err := GetHttpClientWithProxy(proxyURL)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, originURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", defaultDownloadUserAgent)
	common.SysLog(fmt.Sprintf("downloading from origin: %s, reason: %s", common.MaskSensitiveInfo(originURL), strings.Join(reason, ", ")))
	return client.Do(req)
}

const defaultDownloadUserAgent = "new-api-downloader/1.0"
