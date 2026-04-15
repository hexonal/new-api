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
	logInputBodyKey     = "log_input_body"
	logOutputBodyKey    = "log_output_body"
	logOutputChunksKey  = "log_output_chunks"
	logPreviewMaxChars  = 4000
)

func SetLogInputPreview(c *gin.Context, value string) {
	setLogPreviewValue(c, logPreviewInputKey, value)
}

func SetLogOutputPreview(c *gin.Context, value string) {
	setLogPreviewValue(c, logPreviewOutputKey, value)
}

func SetLogInputBody(c *gin.Context, value string) {
	if c == nil {
		return
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	c.Set(logInputBodyKey, value)
}

func SetLogInputBodyBytes(c *gin.Context, value []byte) {
	if len(value) == 0 {
		return
	}
	SetLogInputBody(c, string(value))
}

func SetLogOutputBody(c *gin.Context, value string) {
	if c == nil {
		return
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	c.Set(logOutputBodyKey, value)
}

func SetLogOutputBodyBytes(c *gin.Context, value []byte) {
	if len(value) == 0 {
		return
	}
	SetLogOutputBody(c, string(value))
}

func GetLogOutputBody(c *gin.Context) string {
	return strings.TrimSpace(getContextString(c, logOutputBodyKey))
}

func AppendLogOutputChunk(c *gin.Context, value string) {
	if c == nil {
		return
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	current, ok := c.Get(logOutputChunksKey)
	if !ok {
		c.Set(logOutputChunksKey, []string{value})
		return
	}
	chunks, castOK := current.([]string)
	if !castOK {
		c.Set(logOutputChunksKey, []string{value})
		return
	}
	chunks = append(chunks, value)
	c.Set(logOutputChunksKey, chunks)
}

func FinalizeLogOutputStreamBody(c *gin.Context) {
	if c == nil {
		return
	}
	current, ok := c.Get(logOutputChunksKey)
	if !ok {
		return
	}
	chunks, castOK := current.([]string)
	if !castOK || len(chunks) == 0 {
		return
	}
	payload := map[string]any{
		"stream": true,
		"chunks": chunks,
	}
	encoded, err := common.Marshal(payload)
	if err != nil {
		return
	}
	SetLogOutputBodyBytes(c, encoded)
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

	if inputBody := strings.TrimSpace(getContextString(ctx, logInputBodyKey)); inputBody != "" {
		other["input_body"] = inputBody
	} else if relayInfo != nil && relayInfo.Request != nil {
		if requestJSON := strings.TrimSpace(common.GetJsonString(relayInfo.Request)); requestJSON != "" && requestJSON != "null" {
			other["input_body"] = requestJSON
		}
	} else if inputBody := strings.TrimSpace(buildBodyJSON(ctx)); inputBody != "" {
		other["input_body"] = inputBody
	} else if input := strings.TrimSpace(getContextString(ctx, logPreviewInputKey)); input != "" {
		other["input_preview"] = trimLogPreview(input)
	}

	if outputBody := strings.TrimSpace(getContextString(ctx, logOutputBodyKey)); outputBody != "" {
		other["output_body"] = outputBody
	}

	if ctx != nil {
		if media, ok := ctx.Get(logPreviewMediaKey); ok {
			if urls, castOK := media.([]string); castOK && len(urls) > 0 {
				other["output_media"] = urls
			}
		}
	}
}

func BuildTaskLogInputBody(c *gin.Context, relayInfo *relaycommon.RelayInfo) string {
	if relayInfo != nil && relayInfo.Request != nil {
		requestJSON := strings.TrimSpace(common.GetJsonString(relayInfo.Request))
		if requestJSON != "" && requestJSON != "null" {
			return requestJSON
		}
	}
	if bodyJSON := strings.TrimSpace(buildBodyJSON(c)); bodyJSON != "" {
		return bodyJSON
	}
	return ""
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

func buildBodyJSON(c *gin.Context) string {
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
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
		return trimmed
	}
	return ""
}
