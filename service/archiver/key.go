package archiver

import (
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/media_archive_setting"
)

// BuildObjectKey 按 meta + mime + 前缀生成对象 key。
// 路径结构：{prefix}/YYYY/MM/DD/{kind}/{model}/channel-N/user-N/{identity}[-{index}]{ext}
// 该函数字节级复刻旧 buildMediaArchiveObjectKey，以保证老 URL 不变。
func BuildObjectKey(meta Meta, mimeType string, prefix string) string {
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

// BuildPublicURL 按 cfg 的公开访问规则生成外部 URL。
// 字节级复刻旧 buildMediaArchivePublicURL。
func BuildPublicURL(cfg media_archive_setting.Config, objectKey string) string {
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

// sanitizePathSegment 清洗路径片段为小写 [a-z0-9._-]，其他字符折叠为 '-'。
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

// firstNonEmpty 返回第一个非空白的字符串。
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
