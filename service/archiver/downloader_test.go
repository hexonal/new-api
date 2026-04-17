package archiver

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	// 测试使用 httptest 随机高端口，关闭 SSRF 防护并允许 127.0.0.1。
	fs := system_setting.GetFetchSetting()
	fs.EnableSSRFProtection = false
	fs.AllowPrivateIp = true
	// 测试环境注入简易的 HTTPClientProvider，避免依赖 service 包（循环依赖）。
	SetHTTPClientProvider(func(proxy string) (*http.Client, error) {
		return &http.Client{}, nil
	})
}

func TestHTTPDownloader_Success(t *testing.T) {
	body := []byte("hello-image-bytes")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(body)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	}))
	defer srv.Close()

	d := newHTTPDownloader()
	blob, err := d.Fetch(context.Background(), Source{URL: srv.URL}, 10*1024*1024)
	require.NoError(t, err)
	assert.Equal(t, body, blob.Data)
	assert.Equal(t, "image/png", blob.MimeType)
}

func TestHTTPDownloader_BytesShortcut(t *testing.T) {
	d := newHTTPDownloader()
	blob, err := d.Fetch(context.Background(), Source{Bytes: []byte("hi")}, 1024)
	require.NoError(t, err)
	assert.Equal(t, []byte("hi"), blob.Data)
}

func TestHTTPDownloader_ContentLengthMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Content-Length", "100")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("short-data"))
	}))
	defer srv.Close()

	d := newHTTPDownloader()
	_, err := d.Fetch(context.Background(), Source{URL: srv.URL}, 10*1024)
	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "truncated") || strings.Contains(err.Error(), "unexpected EOF"), "got: %v", err)
}

func TestHTTPDownloader_SizeLimitDeclared(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "2000000")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	d := newHTTPDownloader()
	_, err := d.Fetch(context.Background(), Source{URL: srv.URL}, 1024)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeds limit")
}

func TestHTTPDownloader_Retry5xxThenSucceed(t *testing.T) {
	var attempts int32
	body := []byte("retry-success")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&attempts, 1)
		if n < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(body)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	}))
	defer srv.Close()

	d := newHTTPDownloader()
	blob, err := d.Fetch(context.Background(), Source{URL: srv.URL}, 10*1024)
	require.NoError(t, err)
	assert.Equal(t, body, blob.Data)
	assert.Equal(t, int32(3), atomic.LoadInt32(&attempts))
}

func TestHTTPDownloader_404NoRetry(t *testing.T) {
	var attempts int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attempts, 1)
		http.NotFound(w, r)
	}))
	defer srv.Close()

	d := newHTTPDownloader()
	_, err := d.Fetch(context.Background(), Source{URL: srv.URL}, 10*1024)
	require.Error(t, err)
	assert.Equal(t, int32(1), atomic.LoadInt32(&attempts), "4xx must not retry")
}

func TestHTTPDownloader_ContextCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		_, _ = io.WriteString(w, "late")
	}))
	defer srv.Close()

	d := newHTTPDownloader()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, err := d.Fetch(ctx, Source{URL: srv.URL}, 10*1024)
	require.Error(t, err)
}
