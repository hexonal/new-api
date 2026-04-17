package archiver

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/media_archive_setting"
	"github.com/stretchr/testify/assert"
)

func TestBuildObjectKey_Structure(t *testing.T) {
	meta := Meta{
		Kind:      KindImage,
		Model:     "doubao-seedream-4-0",
		ChannelID: 28,
		UserID:    1,
		RequestID: "req-abc",
		Index:     0,
	}
	key := BuildObjectKey(meta, "image/jpeg", "new-api")

	// 应包含前缀、年月日分段、kind、model 规范化、channel-N、user-N
	assert.True(t, strings.HasPrefix(key, "new-api/"), "key prefix: %s", key)
	assert.Contains(t, key, "/image/")
	assert.Contains(t, key, "/doubao-seedream-4-0/")
	assert.Contains(t, key, "/channel-28/")
	assert.Contains(t, key, "/user-1/")
	assert.True(t, strings.HasSuffix(key, ".jpg"), "key suffix: %s", key)
}

func TestBuildObjectKey_IndexSuffix(t *testing.T) {
	meta := Meta{Kind: KindImage, Model: "m", ChannelID: 1, UserID: 1, RequestID: "r", Index: 3}
	key := BuildObjectKey(meta, "image/png", "p")
	assert.Contains(t, key, "-3.png")
}

func TestBuildPublicURL_WithPublicBase(t *testing.T) {
	cfg := media_archive_setting.Config{
		PublicBaseURL: "https://cdn.example.com/new-api",
		UsePathStyle:  true,
		Endpoint:      "https://oss.example.com",
		Bucket:        "oss",
	}
	got := BuildPublicURL(cfg, "path/to/obj.jpg")
	assert.Equal(t, "https://cdn.example.com/new-api/path/to/obj.jpg", got)
}

func TestBuildPublicURL_PathStyleFallback(t *testing.T) {
	cfg := media_archive_setting.Config{
		UsePathStyle: true,
		Endpoint:     "https://oss.example.com",
		Bucket:       "oss",
	}
	got := BuildPublicURL(cfg, "path/to/obj.jpg")
	assert.Equal(t, "https://oss.example.com/oss/path/to/obj.jpg", got)
}

func TestBuildPublicURL_VirtualHostedFallback(t *testing.T) {
	cfg := media_archive_setting.Config{
		UsePathStyle: false,
		Endpoint:     "https://oss.example.com",
		Bucket:       "oss",
	}
	got := BuildPublicURL(cfg, "path/to/obj.jpg")
	assert.Equal(t, "https://oss.oss.example.com/path/to/obj.jpg", got)
}
