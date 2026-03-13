package common

import (
	"fmt"
	"strings"
)

var taskInputVideoKeys = []string{
	"reference_video_urls",
	"video_urls",
	"reference_video_url",
	"video_url",
}

var taskInputAudioKeys = []string{
	"reference_audio_urls",
	"audio_urls",
	"reference_audio_url",
	"audio_url",
}

// DescribeTaskInputType returns normalized input modalities in fixed order:
// text,image,video,audio (comma-separated).
func DescribeTaskInputType(req TaskSubmitReq) string {
	modalities := detectTaskInputModalities(req)
	return strings.Join(modalities, ",")
}

func hasTaskNonTextInput(req TaskSubmitReq) bool {
	for _, modality := range detectTaskInputModalities(req) {
		if modality != "text" {
			return true
		}
	}
	return false
}

func detectTaskInputModalities(req TaskSubmitReq) []string {
	modalities := make([]string, 0, 4)
	if strings.TrimSpace(req.Prompt) != "" {
		modalities = append(modalities, "text")
	}
	if hasTaskImageInput(req) {
		modalities = append(modalities, "image")
	}
	if hasTaskMetadataResource(req.Metadata, taskInputVideoKeys...) {
		modalities = append(modalities, "video")
	}
	if hasTaskMetadataResource(req.Metadata, taskInputAudioKeys...) {
		modalities = append(modalities, "audio")
	}
	return modalities
}

func hasTaskImageInput(req TaskSubmitReq) bool {
	if strings.TrimSpace(req.Image) != "" || strings.TrimSpace(req.InputReference) != "" {
		return true
	}
	for _, image := range req.Images {
		if strings.TrimSpace(image) != "" {
			return true
		}
	}
	return false
}

func hasTaskMetadataResource(metadata map[string]interface{}, keys ...string) bool {
	if len(metadata) == 0 {
		return false
	}
	for _, key := range keys {
		raw, ok := metadata[key]
		if !ok || raw == nil {
			continue
		}
		if hasTaskResourceURL(raw) {
			return true
		}
	}
	return false
}

func hasTaskResourceURL(raw any) bool {
	switch v := raw.(type) {
	case string:
		return strings.TrimSpace(v) != ""
	case []string:
		for _, item := range v {
			if strings.TrimSpace(item) != "" {
				return true
			}
		}
	case []any:
		for _, item := range v {
			if hasTaskResourceURL(item) {
				return true
			}
		}
	case map[string]any:
		if url, ok := v["url"]; ok {
			return hasTaskResourceURL(url)
		}
		return strings.TrimSpace(fmt.Sprintf("%v", v)) != ""
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", v)) != ""
	}
	return false
}
