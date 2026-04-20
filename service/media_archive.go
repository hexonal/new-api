package service

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service/archiver"
	"github.com/QuantumNous/new-api/setting/media_archive_setting"
)

const (
	// mediaArchiveTimeout 控制整个归档链路的最大耗时。
	mediaArchiveTimeout = 2 * time.Minute
)

var (
	markdownMediaLinkPattern = regexp.MustCompile(`!\[([^\]]*)\]\(([^)\s]+)\)`)
	rawURLPattern            = regexp.MustCompile(`https?://[^\s<>"')]+`)
)

// init 向 archiver 注入依赖，避免 archiver 反向 import service 导致循环。
func init() {
	archiver.SetHTTPClientProvider(GetHttpClientWithProxy)
	archiver.SetWorkerDownloader(func(ctx context.Context, sourceURL string, key string, purpose string) (*http.Response, error) {
		return DoDownloadRequestWithContext(ctx, sourceURL, key, purpose)
	})
}

// MaybeArchiveImageResponse 归档图片响应内的 URL / base64 数据。
func MaybeArchiveImageResponse(ctx context.Context, info *relaycommon.RelayInfo, imageResponse *dto.ImageResponse) {
	if imageResponse == nil || info == nil {
		return
	}
	cfg := media_archive_setting.GetConfig()
	if !cfg.IsReady() {
		return
	}
	a := archiver.GetDefault()
	archiveCtx, cancel := newMediaArchiveContext(ctx)
	defer cancel()

	for i := range imageResponse.Data {
		src := archiver.Source{
			URL:   strings.TrimSpace(imageResponse.Data[i].Url),
			Proxy: mediaArchiveProxyFromInfo(info),
		}
		if src.URL == "" && strings.TrimSpace(imageResponse.Data[i].B64Json) != "" {
			bytesData := decodeImageB64(imageResponse.Data[i].B64Json)
			if len(bytesData) == 0 {
				continue
			}
			src.Bytes = bytesData
		}
		if src.URL == "" && len(src.Bytes) == 0 {
			continue
		}
		meta := mediaArchiveMetaFromInfo(info, archiver.KindImage, i)
		archivedURL, err := a.Archive(archiveCtx, src, meta)
		if err != nil {
			reportMediaArchiveFinalFailure(archiveCtx, "archive_image", firstNonEmpty(src.URL, "bytes"), err, meta)
			continue
		}
		imageResponse.Data[i].Url = archivedURL
		imageResponse.Data[i].B64Json = ""
	}
}

// MaybeArchiveTextResponse 归档文本响应内嵌的媒体链接。
func MaybeArchiveTextResponse(ctx context.Context, info *relaycommon.RelayInfo, response *dto.OpenAITextResponse) bool {
	if response == nil || info == nil {
		return false
	}
	changed := false
	for i := range response.Choices {
		content := response.Choices[i].Message.StringContent()
		if content == "" {
			continue
		}
		rewritten := rewriteTextMediaReferences(ctx, info, content)
		if rewritten == content {
			continue
		}
		response.Choices[i].Message.SetStringContent(rewritten)
		changed = true
	}
	return changed
}

// MaybeArchiveStreamResponse 归档流式响应内嵌的媒体链接。
func MaybeArchiveStreamResponse(ctx context.Context, info *relaycommon.RelayInfo, response *dto.ChatCompletionsStreamResponse) bool {
	if response == nil || info == nil {
		return false
	}
	changed := false
	for i := range response.Choices {
		content := response.Choices[i].Delta.GetContentString()
		if content == "" {
			continue
		}
		rewritten := rewriteTextMediaReferences(ctx, info, content)
		if rewritten == content {
			continue
		}
		response.Choices[i].Delta.SetContentString(rewritten)
		changed = true
	}
	return changed
}

// MaybeArchiveTaskResult 归档异步任务结果里的媒体链接。
func MaybeArchiveTaskResult(ctx context.Context, task *model.Task, sourceURL string, responseBody []byte) (string, bool) {
	if task == nil {
		return "", false
	}
	cfg := media_archive_setting.GetConfig()
	if !cfg.IsReady() {
		return "", false
	}
	a := archiver.GetDefault()
	archiveCtx, cancel := newMediaArchiveContext(ctx)
	defer cancel()

	kind := taskArchiveKind(task)
	meta := archiver.Meta{
		Kind:      kind,
		Model:     firstNonEmpty(strings.TrimSpace(task.Properties.OriginModelName), strings.TrimSpace(task.Properties.UpstreamModelName)),
		TaskID:    strings.TrimSpace(task.TaskID),
		ChannelID: task.ChannelId,
		UserID:    task.UserId,
	}

	ref := strings.TrimSpace(sourceURL)
	if ref != "" {
		if url, err := archiveTaskResultReference(archiveCtx, a, ref, kind, meta); err == nil {
			return url, true
		} else {
			reportMediaArchiveFinalFailure(archiveCtx, "archive_task", ref, err, meta)
		}
	}
	payloadURL := extractTaskPayloadMediaURL(responseBody, kind)
	if payloadURL == "" {
		return "", false
	}
	url, err := archiveTaskResultReference(archiveCtx, a, payloadURL, kind, meta)
	if err != nil {
		reportMediaArchiveFinalFailure(archiveCtx, "archive_task", payloadURL, err, meta)
		return "", false
	}
	return url, true
}

// MaybeArchiveTaskStoredResult 从 task.Data 提取媒体链接并归档。
func MaybeArchiveTaskStoredResult(ctx context.Context, task *model.Task) (string, bool) {
	if task == nil || len(task.Data) == 0 {
		return "", false
	}
	sourceURL := extractTaskPayloadMediaURL(task.Data, taskArchiveKind(task))
	if sourceURL == "" {
		var payload map[string]any
		if err := common.Unmarshal(task.Data, &payload); err == nil {
			sourceURL = firstNonEmpty(
				extractMapString(payload, "video_url"),
				extractMapString(payload, "url"),
				extractMapString(payload, "response", "video_url"),
				extractMapString(payload, "response", "url"),
			)
		}
	}
	if sourceURL == "" {
		return "", false
	}
	archivedURL, ok := MaybeArchiveTaskResult(ctx, task, sourceURL, task.Data)
	if ok {
		task.Data = RewriteTaskResultData(task.Data, archivedURL)
	}
	return archivedURL, ok
}

// rewriteTextMediaReferences 扫描文本中 markdown 图链接与裸 URL，并替换成归档后地址。
func rewriteTextMediaReferences(ctx context.Context, info *relaycommon.RelayInfo, text string) string {
	if strings.TrimSpace(text) == "" || info == nil {
		return text
	}
	cfg := media_archive_setting.GetConfig()
	if !cfg.IsReady() {
		return text
	}
	a := archiver.GetDefault()
	archiveCtx, cancel := newMediaArchiveContext(ctx)
	defer cancel()

	seen := make(map[string]string)
	nextIndex := 0
	proxy := mediaArchiveProxyFromInfo(info)
	baseMeta := archiver.Meta{
		Kind:      archiver.KindImage,
		Model:     firstNonEmpty(strings.TrimSpace(info.OriginModelName), strings.TrimSpace(info.UpstreamModelName)),
		RequestID: strings.TrimSpace(info.RequestId),
		ChannelID: info.ChannelId,
		UserID:    info.UserId,
	}

	replaceURL := func(raw string) string {
		if raw == "" || isMediaArchiveURL(raw, cfg) || !looksLikeMediaReference(raw) {
			return raw
		}
		if archived, ok := seen[raw]; ok {
			return archived
		}
		meta := baseMeta
		meta.Index = nextIndex
		nextIndex++
		archived, err := a.Archive(archiveCtx, archiver.Source{URL: raw, Proxy: proxy}, meta)
		if err != nil || archived == "" {
			logMediaArchiveFailure(archiveCtx, "archive_text_ref", err)
			return raw
		}
		seen[raw] = archived
		return archived
	}

	rewritten := markdownMediaLinkPattern.ReplaceAllStringFunc(text, func(match string) string {
		parts := markdownMediaLinkPattern.FindStringSubmatch(match)
		if len(parts) != 3 {
			return match
		}
		return fmt.Sprintf("![%s](%s)", parts[1], replaceURL(parts[2]))
	})

	rewritten = rawURLPattern.ReplaceAllStringFunc(rewritten, func(raw string) string {
		return replaceURL(raw)
	})

	return rewritten
}

// RewriteTaskResultData 将任务结果 JSON 中的媒体链接节点改写为归档 URL。
func RewriteTaskResultData(body []byte, archivedURL string) []byte {
	if len(body) == 0 || strings.TrimSpace(archivedURL) == "" {
		return body
	}
	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err != nil {
		return body
	}
	if !rewriteTaskPayloadMediaNode(payload, archivedURL) {
		return body
	}
	encoded, err := common.Marshal(payload)
	if err != nil {
		return body
	}
	return encoded
}

// newMediaArchiveContext 为归档链路创建带超时、与父 ctx 取消解耦的上下文。
func newMediaArchiveContext(parent context.Context) (context.Context, context.CancelFunc) {
	if parent == nil {
		return context.WithTimeout(context.Background(), mediaArchiveTimeout)
	}
	return context.WithTimeout(context.WithoutCancel(parent), mediaArchiveTimeout)
}

// extractTaskPayloadMediaURL 从任务 JSON 提取主媒体 URL，支持 image/video 链接与内嵌 base64。
func extractTaskPayloadMediaURL(body []byte, kind archiver.Kind) string {
	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err != nil {
		return ""
	}
	if kind == archiver.KindImage {
		return firstNonEmpty(
			extractImageBytesDataURL(payload, "response"),
			extractImageBytesDataURL(payload),
			extractImageURL(payload, "response"),
			extractImageURL(payload),
			extractMapString(payload, "response", "url"),
			extractMapString(payload, "url"),
		)
	}
	return firstNonEmpty(
		extractVideoBytesDataURL(payload, "response"),
		extractVideoBytesDataURL(payload),
		extractMapString(payload, "response", "video"),
		extractMapString(payload, "video"),
	)
}

func extractVideoBytesDataURL(payload map[string]any, pathSegments ...string) string {
	var node any = payload
	for _, segment := range pathSegments {
		m, ok := node.(map[string]any)
		if !ok {
			return ""
		}
		node = m[segment]
	}
	root, ok := node.(map[string]any)
	if !ok {
		return ""
	}
	if b64, ok := root["bytesBase64Encoded"].(string); ok && strings.TrimSpace(b64) != "" {
		return "data:video/mp4;base64," + strings.TrimSpace(b64)
	}
	if videos, ok := root["videos"].([]any); ok {
		for _, item := range videos {
			vm, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if b64, ok := vm["bytesBase64Encoded"].(string); ok && strings.TrimSpace(b64) != "" {
				return "data:video/mp4;base64," + strings.TrimSpace(b64)
			}
		}
	}
	return ""
}

func extractImageBytesDataURL(payload map[string]any, pathSegments ...string) string {
	var node any = payload
	for _, segment := range pathSegments {
		m, ok := node.(map[string]any)
		if !ok {
			return ""
		}
		node = m[segment]
	}
	root, ok := node.(map[string]any)
	if !ok {
		return ""
	}
	dataItems, ok := root["data"].([]any)
	if !ok {
		return ""
	}
	for _, item := range dataItems {
		imageMap, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if b64, ok := imageMap["b64_json"].(string); ok && strings.TrimSpace(b64) != "" {
			return "data:image/png;base64," + strings.TrimSpace(b64)
		}
		if b64, ok := imageMap["b64Json"].(string); ok && strings.TrimSpace(b64) != "" {
			return "data:image/png;base64," + strings.TrimSpace(b64)
		}
	}
	return ""
}

func extractImageURL(payload map[string]any, pathSegments ...string) string {
	var node any = payload
	for _, segment := range pathSegments {
		m, ok := node.(map[string]any)
		if !ok {
			return ""
		}
		node = m[segment]
	}
	root, ok := node.(map[string]any)
	if !ok {
		return ""
	}
	dataItems, ok := root["data"].([]any)
	if !ok {
		return ""
	}
	for _, item := range dataItems {
		imageMap, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if url, ok := imageMap["url"].(string); ok && strings.TrimSpace(url) != "" {
			return strings.TrimSpace(url)
		}
	}
	return ""
}

func extractMapString(payload map[string]any, pathSegments ...string) string {
	var node any = payload
	for _, segment := range pathSegments {
		m, ok := node.(map[string]any)
		if !ok {
			return ""
		}
		node = m[segment]
	}
	value, _ := node.(string)
	return strings.TrimSpace(value)
}

// decodeBase64Payload 解码 StdEncoding 或 RawStdEncoding base64 文本。
func decodeBase64Payload(payload string) ([]byte, error) {
	payload = strings.TrimSpace(payload)
	if payload == "" {
		return nil, fmt.Errorf("empty base64 payload")
	}
	if data, err := base64.StdEncoding.DecodeString(payload); err == nil {
		return data, nil
	}
	return base64.RawStdEncoding.DecodeString(payload)
}

// looksLikeMediaReference 粗判 URL / data URL 是否指向图片/视频资源。
func looksLikeMediaReference(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return false
	}
	if strings.HasPrefix(raw, "data:image/") || strings.HasPrefix(raw, "data:video/") {
		return true
	}
	lower := strings.ToLower(raw)
	// 去掉 query string 后取扩展名
	if idx := strings.IndexAny(lower, "?#"); idx >= 0 {
		lower = lower[:idx]
	}
	for _, ext := range []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".mp4", ".mov", ".webm", ".mkv"} {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	return false
}

// isMediaArchiveURL 判断 URL 是否已经是归档桶域名，避免循环归档。
func isMediaArchiveURL(rawURL string, cfg media_archive_setting.Config) bool {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return false
	}
	if cfg.PublicBaseURL != "" && strings.HasPrefix(rawURL, strings.TrimRight(cfg.PublicBaseURL, "/")+"/") {
		return true
	}
	if cfg.Endpoint != "" && strings.HasPrefix(rawURL, strings.TrimRight(cfg.Endpoint, "/")+"/") {
		return true
	}
	return strings.HasPrefix(rawURL, strings.TrimRight(cfg.Endpoint, "/")+"/"+strings.Trim(cfg.Bucket, "/")+"/")
}

// firstNonEmpty 返回第一个非空字符串（trim 后）。
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

// logMediaArchiveFailure 记录非终态归档失败的 Warn 日志。
func logMediaArchiveFailure(ctx context.Context, action string, err error) {
	if err == nil {
		return
	}
	if ctx == nil {
		common.SysError(action + ": " + err.Error())
		return
	}
	logger.LogWarn(ctx, action+": "+err.Error())
}

// logMediaArchiveFinalFailure 记录终态失败 Error 日志，供监控告警使用。
func logMediaArchiveFinalFailure(ctx context.Context, action string, ref string, err error) {
	if err == nil {
		return
	}
	msg := fmt.Sprintf("%s: %s (ref=%s)", action, err.Error(), ref)
	if ctx == nil {
		common.SysError(msg)
		return
	}
	logger.LogError(ctx, msg)
}

// reportMediaArchiveFinalFailure 把日志与监控告警合并，供所有最终失败点统一调用。
func reportMediaArchiveFinalFailure(ctx context.Context, phase string, ref string, err error, meta archiver.Meta) {
	if err == nil {
		return
	}
	logMediaArchiveFinalFailure(ctx, phase, ref, err)
	NotifyMonitorMediaArchiveError(phase, ref, err.Error(), mediaArchiveMetaToAlertData(meta))
}

func mediaArchiveMetaToAlertData(meta archiver.Meta) map[string]interface{} {
	data := map[string]interface{}{
		"archive_kind": string(meta.Kind),
	}
	if meta.Model != "" {
		data["model_name"] = meta.Model
	}
	if meta.ChannelID > 0 {
		data["channel_id"] = meta.ChannelID
	}
	if meta.UserID > 0 {
		data["user_id"] = meta.UserID
	}
	if meta.RequestID != "" {
		data["request_id"] = meta.RequestID
	}
	if meta.TaskID != "" {
		data["task_id"] = meta.TaskID
	}
	return data
}

// rewriteTaskPayloadMediaNode 递归改写 JSON 中典型的媒体节点为归档 URL。
func rewriteTaskPayloadMediaNode(payload map[string]any, archivedURL string) bool {
	changed := false
	if value, ok := payload["video_url"].(string); ok && strings.TrimSpace(value) != "" {
		payload["video_url"] = archivedURL
		changed = true
	}
	if value, ok := payload["url"].(string); ok && strings.TrimSpace(value) != "" {
		payload["url"] = archivedURL
		changed = true
	}
	if response, ok := payload["response"].(map[string]any); ok {
		if rewriteTaskPayloadMediaNode(response, archivedURL) {
			payload["response"] = response
			changed = true
		}
	}
	if videos, ok := payload["videos"].([]any); ok {
		for i, item := range videos {
			videoMap, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if _, exists := videoMap["bytesBase64Encoded"]; exists {
				delete(videoMap, "bytesBase64Encoded")
				changed = true
			}
			if value, ok := videoMap["video_url"].(string); ok && strings.TrimSpace(value) != "" {
				videoMap["video_url"] = archivedURL
				changed = true
			}
			if value, ok := videoMap["url"].(string); ok && strings.TrimSpace(value) != "" {
				videoMap["url"] = archivedURL
				changed = true
			}
			videos[i] = videoMap
		}
		payload["videos"] = videos
	}
	if dataItems, ok := payload["data"].([]any); ok {
		for i, item := range dataItems {
			dataMap, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if _, exists := dataMap["b64_json"]; exists {
				delete(dataMap, "b64_json")
				changed = true
			}
			if _, exists := dataMap["b64Json"]; exists {
				delete(dataMap, "b64Json")
				changed = true
			}
			if value, ok := dataMap["url"].(string); ok && strings.TrimSpace(value) != "" {
				dataMap["url"] = archivedURL
				changed = true
			}
			dataItems[i] = dataMap
		}
		payload["data"] = dataItems
	}
	if _, exists := payload["bytesBase64Encoded"]; exists {
		delete(payload, "bytesBase64Encoded")
		changed = true
	}
	if changed {
		payload["archived_url"] = archivedURL
	}
	return changed
}

// mediaArchiveMetaFromInfo 从 RelayInfo 抽取归档 meta。
func mediaArchiveMetaFromInfo(info *relaycommon.RelayInfo, kind archiver.Kind, index int) archiver.Meta {
	return archiver.Meta{
		Kind:      kind,
		Model:     firstNonEmpty(strings.TrimSpace(info.OriginModelName), strings.TrimSpace(info.UpstreamModelName)),
		RequestID: strings.TrimSpace(info.RequestId),
		ChannelID: info.ChannelId,
		UserID:    info.UserId,
		Index:     index,
	}
}

// mediaArchiveProxyFromInfo 抽取渠道代理地址。
func mediaArchiveProxyFromInfo(info *relaycommon.RelayInfo) string {
	if info == nil || info.ChannelMeta == nil {
		return ""
	}
	return strings.TrimSpace(info.ChannelSetting.Proxy)
}

// decodeImageB64 解码 data:URL 或裸 base64 字符串为字节。
// MIME 不返回：archiver.Archive 内部基于字节魔数 DetectMime 兜底。
func decodeImageB64(b64 string) []byte {
	b64 = strings.TrimSpace(b64)
	if b64 == "" {
		return nil
	}
	if strings.HasPrefix(b64, "data:") {
		_, payload, err := DecodeBase64FileData(b64)
		if err != nil {
			return nil
		}
		data, err := decodeBase64Payload(payload)
		if err != nil {
			return nil
		}
		return data
	}
	data, err := decodeBase64Payload(b64)
	if err != nil {
		return nil
	}
	return data
}

func taskArchiveKind(task *model.Task) archiver.Kind {
	if task != nil && task.Platform == constant.TaskPlatformImage {
		return archiver.KindImage
	}
	return archiver.KindVideo
}

func archiveTaskResultReference(
	ctx context.Context,
	a *archiver.Archiver,
	ref string,
	kind archiver.Kind,
	meta archiver.Meta,
) (string, error) {
	src, err := taskResultArchiveSource(ref, kind)
	if err != nil {
		return "", err
	}
	return a.Archive(ctx, src, meta)
}

func taskResultArchiveSource(ref string, kind archiver.Kind) (archiver.Source, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return archiver.Source{}, fmt.Errorf("empty task result reference")
	}
	if strings.HasPrefix(ref, "data:") {
		prefix, payload, ok := strings.Cut(ref, ",")
		if !ok || payload == "" {
			return archiver.Source{}, fmt.Errorf("invalid data url")
		}
		switch {
		case kind == archiver.KindImage && strings.HasPrefix(prefix, "data:image/"):
			data := decodeImageB64(payload)
			if len(data) == 0 {
				return archiver.Source{}, fmt.Errorf("invalid image data url")
			}
			return archiver.Source{Bytes: data}, nil
		case kind == archiver.KindVideo && strings.HasPrefix(prefix, "data:video/"):
			data, err := decodeBase64Payload(payload)
			if err != nil {
				return archiver.Source{}, err
			}
			if len(data) == 0 {
				return archiver.Source{}, fmt.Errorf("invalid video data url")
			}
			return archiver.Source{Bytes: data}, nil
		}
	}
	return archiver.Source{URL: ref}, nil
}
