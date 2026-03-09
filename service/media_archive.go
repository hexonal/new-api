package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/media_archive_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type mediaArchiveKind string

const (
	mediaArchiveKindImage mediaArchiveKind = "image"
	mediaArchiveKindVideo mediaArchiveKind = "video"
)

type mediaArchiveMeta struct {
	Kind      mediaArchiveKind
	Model     string
	RequestID string
	TaskID    string
	ChannelID int
	UserID    int
	Index     int
	Proxy     string
}

type mediaArchiveUploader struct {
	mu       sync.RWMutex
	cacheKey string
	s3Client *s3.Client
}

var globalMediaArchiveUploader = &mediaArchiveUploader{}

func MaybeArchiveImageResponse(ctx context.Context, info *relaycommon.RelayInfo, imageResponse *dto.ImageResponse) {
	if imageResponse == nil || info == nil {
		return
	}
	cfg := media_archive_setting.GetConfig()
	if !cfg.IsReady() {
		return
	}

	meta := mediaArchiveMeta{
		Kind:      mediaArchiveKindImage,
		Model:     firstNonEmpty(strings.TrimSpace(info.OriginModelName), strings.TrimSpace(info.UpstreamModelName)),
		RequestID: strings.TrimSpace(info.RequestId),
		ChannelID: info.ChannelId,
		UserID:    info.UserId,
	}
	if info.ChannelMeta != nil {
		meta.Proxy = strings.TrimSpace(info.ChannelSetting.Proxy)
	}

	for i := range imageResponse.Data {
		meta.Index = i
		if archivedURL, ok := maybeArchiveImageData(ctx, imageResponse.Data[i], meta, cfg); ok {
			imageResponse.Data[i].Url = archivedURL
			imageResponse.Data[i].B64Json = ""
		}
	}
}

func MaybeArchiveTaskResult(ctx context.Context, task *model.Task, sourceURL string, responseBody []byte) (string, bool) {
	if task == nil {
		return "", false
	}
	cfg := media_archive_setting.GetConfig()
	if !cfg.IsReady() {
		return "", false
	}

	meta := mediaArchiveMeta{
		Kind:      mediaArchiveKindVideo,
		Model:     firstNonEmpty(strings.TrimSpace(task.Properties.OriginModelName), strings.TrimSpace(task.Properties.UpstreamModelName)),
		TaskID:    strings.TrimSpace(task.TaskID),
		ChannelID: task.ChannelId,
		UserID:    task.UserId,
	}

	if archivedURL, ok := maybeArchiveMediaReference(ctx, strings.TrimSpace(sourceURL), meta, cfg); ok {
		return archivedURL, true
	}
	payloadURL := extractTaskPayloadMediaURL(responseBody)
	if payloadURL == "" {
		return "", false
	}
	return maybeArchiveMediaReference(ctx, payloadURL, meta, cfg)
}

func maybeArchiveImageData(ctx context.Context, imageData dto.ImageData, meta mediaArchiveMeta, cfg media_archive_setting.Config) (string, bool) {
	if ref := strings.TrimSpace(imageData.Url); ref != "" {
		return maybeArchiveMediaReference(ctx, ref, meta, cfg)
	}
	if b64 := strings.TrimSpace(imageData.B64Json); b64 != "" {
		return maybeArchiveMediaReference(ctx, b64, meta, cfg)
	}
	return "", false
}

func maybeArchiveMediaReference(ctx context.Context, ref string, meta mediaArchiveMeta, cfg media_archive_setting.Config) (string, bool) {
	ref = strings.TrimSpace(ref)
	if ref == "" || isMediaArchiveURL(ref, cfg) {
		return "", false
	}

	switch {
	case strings.HasPrefix(ref, "data:"):
		mimeType, payload, err := DecodeBase64FileData(ref)
		if err != nil {
			logMediaArchiveFailure(ctx, "decode media data url", err)
			return "", false
		}
		data, err := decodeBase64Payload(payload)
		if err != nil {
			logMediaArchiveFailure(ctx, "decode media base64 payload", err)
			return "", false
		}
		return uploadArchivedBytes(ctx, data, firstNonEmpty(strings.TrimSpace(mimeType), detectMediaMimeType(data, meta.Kind)), meta, cfg)
	case strings.HasPrefix(ref, "http://") || strings.HasPrefix(ref, "https://"):
		return archiveURLToOSS(ctx, ref, meta, cfg)
	default:
		data, err := decodeBase64Payload(ref)
		if err != nil {
			logMediaArchiveFailure(ctx, "decode raw base64 media", err)
			return "", false
		}
		return uploadArchivedBytes(ctx, data, detectMediaMimeType(data, meta.Kind), meta, cfg)
	}
}

func archiveURLToOSS(ctx context.Context, sourceURL string, meta mediaArchiveMeta, cfg media_archive_setting.Config) (string, bool) {
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(sourceURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		logMediaArchiveFailure(ctx, "validate archive source url", err)
		return "", false
	}

	client, err := GetHttpClientWithProxy(meta.Proxy)
	if err != nil {
		logMediaArchiveFailure(ctx, "create archive http client", err)
		return "", false
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		logMediaArchiveFailure(ctx, "create archive request", err)
		return "", false
	}
	resp, err := client.Do(req)
	if err != nil {
		logMediaArchiveFailure(ctx, "download media for archive", err)
		return "", false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		logMediaArchiveFailure(ctx, "download media for archive", fmt.Errorf("status %d", resp.StatusCode))
		return "", false
	}

	reader := io.LimitReader(resp.Body, cfg.MaxDownloadBytes+1)
	data, err := io.ReadAll(reader)
	if err != nil {
		logMediaArchiveFailure(ctx, "read media for archive", err)
		return "", false
	}
	if int64(len(data)) > cfg.MaxDownloadBytes {
		logMediaArchiveFailure(ctx, "read media for archive", fmt.Errorf("payload exceeds limit %d", cfg.MaxDownloadBytes))
		return "", false
	}

	mimeType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if idx := strings.Index(mimeType, ";"); idx >= 0 {
		mimeType = strings.TrimSpace(mimeType[:idx])
	}
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = detectMediaMimeType(data, meta.Kind)
	}
	return uploadArchivedBytes(ctx, data, mimeType, meta, cfg)
}

func uploadArchivedBytes(ctx context.Context, data []byte, mimeType string, meta mediaArchiveMeta, cfg media_archive_setting.Config) (string, bool) {
	objectKey := buildMediaArchiveObjectKey(meta, mimeType, cfg.PathPrefix)
	archivedURL, err := globalMediaArchiveUploader.uploadBytes(ctx, data, mimeType, objectKey, cfg)
	if err != nil {
		logMediaArchiveFailure(ctx, "upload media to oss", err)
		return "", false
	}
	return archivedURL, true
}

func (u *mediaArchiveUploader) uploadBytes(ctx context.Context, data []byte, mimeType string, objectKey string, cfg media_archive_setting.Config) (string, error) {
	client, err := u.getClient(cfg)
	if err != nil {
		return "", err
	}
	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(cfg.Bucket),
		Key:         aws.String(objectKey),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(mimeType),
		ACL:         s3types.ObjectCannedACLPublicRead,
	})
	if err != nil {
		return "", err
	}
	return buildMediaArchivePublicURL(cfg, objectKey), nil
}

func (u *mediaArchiveUploader) getClient(cfg media_archive_setting.Config) (*s3.Client, error) {
	cacheKey := strings.Join([]string{
		cfg.Endpoint,
		cfg.Region,
		cfg.Bucket,
		cfg.AccessKey,
		strconv.FormatBool(cfg.UsePathStyle),
	}, "|")

	u.mu.RLock()
	if u.s3Client != nil && u.cacheKey == cacheKey {
		client := u.s3Client
		u.mu.RUnlock()
		return client, nil
	}
	u.mu.RUnlock()

	u.mu.Lock()
	defer u.mu.Unlock()
	if u.s3Client != nil && u.cacheKey == cacheKey {
		return u.s3Client, nil
	}

	awsCfg := aws.Config{
		Region:      firstNonEmpty(cfg.Region, "us-east-1"),
		Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
	}
	awsCfg.BaseEndpoint = aws.String(cfg.Endpoint)
	u.s3Client = s3.NewFromConfig(awsCfg, func(options *s3.Options) {
		options.UsePathStyle = cfg.UsePathStyle
	})
	u.cacheKey = cacheKey
	return u.s3Client, nil
}

func extractTaskPayloadMediaURL(body []byte) string {
	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err != nil {
		return ""
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

func detectMediaMimeType(data []byte, kind mediaArchiveKind) string {
	if detected := http.DetectContentType(data); detected != "" && detected != "application/octet-stream" {
		return detected
	}
	if kind == mediaArchiveKindVideo {
		return "video/mp4"
	}
	return "image/png"
}

func buildMediaArchiveObjectKey(meta mediaArchiveMeta, mimeType string, prefix string) string {
	now := time.Now().UTC()
	identity := sanitizePathSegment(firstNonEmpty(meta.TaskID, meta.RequestID, common.GetUUID()))
	parts := []string{
		sanitizePathSegment(firstNonEmpty(prefix, "media")),
		now.Format("2006"),
		now.Format("01"),
		now.Format("02"),
		sanitizePathSegment(string(meta.Kind)),
		sanitizePathSegment(firstNonEmpty(meta.Model, "unknown-model")),
	}
	if meta.ChannelID > 0 {
		parts = append(parts, "channel-"+strconv.Itoa(meta.ChannelID))
	}
	if meta.UserID > 0 {
		parts = append(parts, "user-"+strconv.Itoa(meta.UserID))
	}
	filename := identity
	if meta.Index > 0 {
		filename += "-" + strconv.Itoa(meta.Index)
	}
	if ext := extensionFromMimeType(mimeType); ext != "" {
		filename += ext
	}
	parts = append(parts, filename)
	return path.Join(parts...)
}

func buildMediaArchivePublicURL(cfg media_archive_setting.Config, objectKey string) string {
	objectKey = strings.TrimLeft(strings.TrimSpace(objectKey), "/")
	if cfg.PublicBaseURL != "" {
		return strings.TrimRight(cfg.PublicBaseURL, "/") + "/" + objectKey
	}
	base := strings.TrimRight(cfg.Endpoint, "/")
	if cfg.UsePathStyle {
		return base + "/" + path.Join(cfg.Bucket, objectKey)
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed.Host == "" {
		return base + "/" + path.Join(cfg.Bucket, objectKey)
	}
	return parsed.Scheme + "://" + cfg.Bucket + "." + parsed.Host + "/" + objectKey
}

func isMediaArchiveURL(rawURL string, cfg media_archive_setting.Config) bool {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return false
	}
	if cfg.PublicBaseURL != "" && strings.HasPrefix(rawURL, strings.TrimRight(cfg.PublicBaseURL, "/")+"/") {
		return true
	}
	return strings.HasPrefix(rawURL, strings.TrimRight(cfg.Endpoint, "/")+"/"+strings.Trim(cfg.Bucket, "/")+"/")
}

func extensionFromMimeType(mimeType string) string {
	exts, err := mime.ExtensionsByType(mimeType)
	if err != nil || len(exts) == 0 {
		switch mimeType {
		case "image/webp":
			return ".webp"
		case "video/mp4":
			return ".mp4"
		default:
			return ""
		}
	}
	return exts[0]
}

func sanitizePathSegment(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	if value == "" {
		return common.GetUUID()
	}
	var out strings.Builder
	lastDash := false
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z':
			out.WriteRune(r)
			lastDash = false
		case r >= '0' && r <= '9':
			out.WriteRune(r)
			lastDash = false
		case r == '.' || r == '_' || r == '-':
			out.WriteRune(r)
			lastDash = false
		default:
			if !lastDash {
				out.WriteByte('-')
				lastDash = true
			}
		}
	}
	return strings.Trim(out.String(), "-")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

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
