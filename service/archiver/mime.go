package archiver

import (
	"mime"
	"net/http"
	"strings"
)

// DetectMime 从字节魔数检测 MIME；失败则按 Kind 回退到默认值。
// 复刻旧 detectMediaMimeType 行为。
func DetectMime(data []byte, kind Kind) string {
	if detected := http.DetectContentType(data); detected != "" &&
		detected != "application/octet-stream" &&
		!strings.HasPrefix(detected, "text/") {
		return detected
	}
	if kind == KindVideo {
		return "video/mp4"
	}
	return "image/png"
}

// ExtractContentType 规范化 Content-Type 头：
// 1. 去除 ";charset=..." 参数；
// 2. 将 application/octet-stream 视为"未知"返回空串，让调用方用 DetectMime 兜底。
// 复刻旧 extractContentTypeMime 行为。
func ExtractContentType(raw string) string {
	mimeType := strings.TrimSpace(raw)
	if idx := strings.Index(mimeType, ";"); idx >= 0 {
		mimeType = strings.TrimSpace(mimeType[:idx])
	}
	if mimeType == "application/octet-stream" {
		return ""
	}
	return mimeType
}

// extensionFromMimeType 返回带点的扩展名。
// 复刻旧 extensionFromMimeType 行为。
func extensionFromMimeType(mimeType string) string {
	switch mimeType {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "video/mp4":
		return ".mp4"
	}
	exts, err := mime.ExtensionsByType(mimeType)
	if err != nil || len(exts) == 0 {
		return ""
	}
	return exts[0]
}
