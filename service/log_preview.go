package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

const (
	logPreviewInputKey  = "log_preview_input"
	logPreviewOutputKey = "log_preview_output"
	logPreviewMediaKey  = "log_preview_media"
	logPreviewMaxChars  = 4000
)

func SetLogInputPreview(c *gin.Context, value string) {
	setLogPreviewValue(c, logPreviewInputKey, value)
}

func SetLogOutputPreview(c *gin.Context, value string) {
	setLogPreviewValue(c, logPreviewOutputKey, value)
}

func SetLogOutputMedia(c *gin.Context, values []string) {
	if c == nil {
		return
	}
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			normalized = append(normalized, trimLogPreview(trimmed))
		}
	}
	if len(normalized) == 0 {
		return
	}
	c.Set(logPreviewMediaKey, normalized)
}

func SetLogImageResponse(c *gin.Context, imageResponse *dto.ImageResponse) {
	if imageResponse == nil {
		return
	}
	urls := make([]string, 0, len(imageResponse.Data))
	for _, item := range imageResponse.Data {
		if trimmed := strings.TrimSpace(item.Url); trimmed != "" {
			urls = append(urls, trimmed)
		}
	}
	SetLogOutputMedia(c, urls)
}

func AppendLogPreview(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, other map[string]interface{}) {
	if other == nil {
		return
	}

	if input := strings.TrimSpace(getContextString(ctx, logPreviewInputKey)); input != "" {
		other["input_preview"] = trimLogPreview(input)
	} else if input := strings.TrimSpace(buildBodyPreview(ctx)); input != "" {
		other["input_preview"] = input
	} else if relayInfo != nil && relayInfo.Request != nil {
		if requestJSON := strings.TrimSpace(common.GetJsonString(relayInfo.Request)); requestJSON != "" && requestJSON != "null" {
			other["input_preview"] = trimLogPreview(requestJSON)
		}
	}

	if output := strings.TrimSpace(getContextString(ctx, logPreviewOutputKey)); output != "" {
		other["output_preview"] = trimLogPreview(output)
	}

	if ctx != nil {
		if media, ok := ctx.Get(logPreviewMediaKey); ok {
			if urls, castOK := media.([]string); castOK && len(urls) > 0 {
				other["output_media"] = urls
				if output := strings.TrimSpace(firstNonEmptyStrings(urls...)); output != "" {
					other["output_preview"] = trimLogPreview(output)
				}
			}
		}
	}
}

func BuildTaskLogInputPreview(c *gin.Context, relayInfo *relaycommon.RelayInfo) string {
	if bodyPreview := strings.TrimSpace(buildBodyPreview(c)); bodyPreview != "" {
		return bodyPreview
	}
	if relayInfo == nil || relayInfo.Request == nil {
		return ""
	}
	return trimLogPreview(common.GetJsonString(relayInfo.Request))
}

func trimLogPreview(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= logPreviewMaxChars {
		return value
	}
	return strings.TrimSpace(string(runes[:logPreviewMaxChars])) + "...(truncated)"
}

func getContextString(c *gin.Context, key string) string {
	if c == nil {
		return ""
	}
	value, ok := c.Get(key)
	if !ok {
		return ""
	}
	str, _ := value.(string)
	return str
}

func setLogPreviewValue(c *gin.Context, key string, value string) {
	if c == nil {
		return
	}
	value = trimLogPreview(value)
	if value == "" {
		return
	}
	c.Set(key, value)
}

func firstNonEmptyStrings(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func buildBodyPreview(c *gin.Context) string {
	if c == nil {
		return ""
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil || storage == nil {
		return ""
	}
	body, err := storage.Bytes()
	if err != nil || len(body) == 0 {
		return ""
	}
	return trimLogPreview(string(body))
}
