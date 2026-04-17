package archiver

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDetectMime_PNGMagic(t *testing.T) {
	// PNG magic bytes: 0x89 0x50 0x4E 0x47
	data := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
	assert.Equal(t, "image/png", DetectMime(data, KindImage))
}

func TestDetectMime_FallbackImage(t *testing.T) {
	assert.Equal(t, "image/png", DetectMime([]byte{}, KindImage))
}

func TestDetectMime_FallbackVideo(t *testing.T) {
	assert.Equal(t, "video/mp4", DetectMime([]byte{}, KindVideo))
}

func TestExtractContentType_StripsParams(t *testing.T) {
	assert.Equal(t, "image/jpeg", ExtractContentType("image/jpeg; charset=utf-8"))
}

func TestExtractContentType_DropsOctetStream(t *testing.T) {
	assert.Equal(t, "", ExtractContentType("application/octet-stream"))
}

func TestExtractContentType_Empty(t *testing.T) {
	assert.Equal(t, "", ExtractContentType(""))
}

func TestExtensionFromMimeType(t *testing.T) {
	assert.Equal(t, ".jpg", extensionFromMimeType("image/jpeg"))
	assert.Equal(t, ".png", extensionFromMimeType("image/png"))
	assert.Equal(t, ".mp4", extensionFromMimeType("video/mp4"))
	assert.Equal(t, ".webp", extensionFromMimeType("image/webp"))
}
