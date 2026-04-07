package media_archive_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type Config struct {
	Enabled          bool
	Endpoint         string
	Region           string
	Bucket           string
	AccessKey        string
	SecretKey        string
	PublicBaseURL    string
	PathPrefix       string
	UsePathStyle     bool
	MaxDownloadBytes int64
}

func GetConfig() Config {
	maxDownloadBytes := int64(common.GetEnvOrDefault("MEDIA_ARCHIVE_MAX_DOWNLOAD_BYTES", 1024*1024*100))
	if maxDownloadBytes <= 0 {
		maxDownloadBytes = 1024 * 1024 * 100
	}
	return Config{
		Enabled:          common.GetEnvOrDefaultBool("MEDIA_ARCHIVE_ENABLED", false),
		Endpoint:         strings.TrimSpace(common.GetEnvOrDefaultString("MEDIA_ARCHIVE_S3_ENDPOINT", "")),
		Region:           strings.TrimSpace(common.GetEnvOrDefaultString("MEDIA_ARCHIVE_S3_REGION", "us-east-1")),
		Bucket:           strings.TrimSpace(common.GetEnvOrDefaultString("MEDIA_ARCHIVE_S3_BUCKET", "")),
		AccessKey:        strings.TrimSpace(common.GetEnvOrDefaultString("MEDIA_ARCHIVE_S3_ACCESS_KEY", "")),
		SecretKey:        strings.TrimSpace(common.GetEnvOrDefaultString("MEDIA_ARCHIVE_S3_SECRET_KEY", "")),
		PublicBaseURL:    strings.TrimSpace(common.GetEnvOrDefaultString("MEDIA_ARCHIVE_S3_PUBLIC_BASE_URL", "")),
		PathPrefix:       strings.TrimSpace(common.GetEnvOrDefaultString("MEDIA_ARCHIVE_PATH_PREFIX", "media")),
		UsePathStyle:     common.GetEnvOrDefaultBool("MEDIA_ARCHIVE_S3_PATH_STYLE", true),
		MaxDownloadBytes: maxDownloadBytes,
	}
}

func (c Config) IsReady() bool {
	return c.Enabled &&
		c.Endpoint != "" &&
		c.Bucket != "" &&
		c.AccessKey != "" &&
		c.SecretKey != ""
}
