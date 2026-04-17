//go:build integration
// +build integration

package archiver

import (
	"context"
	"crypto/rand"
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting/media_archive_setting"
	"github.com/stretchr/testify/require"
)

// TestLiveOSSUploadAndPublicGet 必须手工触发：
//
//	MEDIA_ARCHIVE_S3_ACCESS_KEY=... MEDIA_ARCHIVE_S3_SECRET_KEY=... \
//	MEDIA_ARCHIVE_S3_ENDPOINT=https://oss.axis-ai.dev \
//	MEDIA_ARCHIVE_S3_BUCKET=oss \
//	MEDIA_ARCHIVE_S3_REGION=us-east-1 \
//	MEDIA_ARCHIVE_S3_PUBLIC_BASE_URL=https://oss.axis-ai.dev/oss \
//	MEDIA_ARCHIVE_S3_PATH_STYLE=true \
//	MEDIA_ARCHIVE_PATH_PREFIX=new-api \
//	MEDIA_ARCHIVE_ENABLED=true \
//	go test -tags=integration ./service/archiver/ -run TestLiveOSSUploadAndPublicGet -v
func TestLiveOSSUploadAndPublicGet(t *testing.T) {
	if os.Getenv("MEDIA_ARCHIVE_S3_ACCESS_KEY") == "" {
		t.Skip("MEDIA_ARCHIVE_S3_ACCESS_KEY unset")
	}
	cfg := media_archive_setting.GetConfig()
	require.True(t, cfg.IsReady(), "config must be ready")

	payload := make([]byte, 64*1024)
	_, _ = rand.Read(payload)

	up := newS3Uploader(cfg)
	objectKey := "new-api/_archiver_integration/" + time.Now().UTC().Format("20060102T150405") + ".bin"
	publicURL, err := up.Upload(context.Background(), objectKey, Blob{
		Data:     payload,
		MimeType: "application/octet-stream",
	})
	require.NoError(t, err)
	t.Logf("uploaded: %s", publicURL)

	resp, err := http.Get(publicURL)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body, _ := io.ReadAll(resp.Body)
	require.Equal(t, len(payload), len(body))
	require.Equal(t, payload[:64], body[:64])
	t.Logf("public GET verified: %d bytes", len(body))

	t.Logf("NOT deleting: %s", publicURL)
}
