package archiver

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/setting/media_archive_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// captureHandler 把每次请求的 path、query、headers 都记下来，供断言使用。
type captureHandler struct {
	mu       sync.Mutex
	requests []*http.Request
	bodies   [][]byte
}

func (h *captureHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mu.Lock()
	defer h.mu.Unlock()
	body, _ := io.ReadAll(r.Body)
	r.Body.Close()
	clone := r.Clone(r.Context())
	clone.Body = nil
	h.requests = append(h.requests, clone)
	h.bodies = append(h.bodies, body)

	q := r.URL.Query()
	if r.Method == http.MethodPost && q.Has("uploads") {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`<?xml version="1.0"?><InitiateMultipartUploadResult><UploadId>test-upload-id</UploadId></InitiateMultipartUploadResult>`))
		return
	}
	if r.Method == http.MethodPost && q.Has("uploadId") {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`<?xml version="1.0"?><CompleteMultipartUploadResult><Location>fake</Location></CompleteMultipartUploadResult>`))
		return
	}
	w.Header().Set("ETag", `"deadbeef"`)
	w.WriteHeader(http.StatusOK)
}

func TestS3Uploader_SmallFile_SingleRequest(t *testing.T) {
	handler := &captureHandler{}
	srv := httptest.NewServer(handler)
	defer srv.Close()

	cfg := media_archive_setting.Config{
		Enabled:       true,
		Endpoint:      srv.URL,
		Region:        "us-east-1",
		Bucket:        "oss",
		AccessKey:     "ak",
		SecretKey:     "sk",
		UsePathStyle:  true,
		PublicBaseURL: srv.URL + "/oss",
	}
	up := newS3Uploader(cfg)

	url, err := up.Upload(context.Background(), "some/key/obj.bin", Blob{
		Data:     []byte("small-payload"),
		MimeType: "application/octet-stream",
	})
	require.NoError(t, err)
	assert.Equal(t, srv.URL+"/oss/some/key/obj.bin", url)

	handler.mu.Lock()
	defer handler.mu.Unlock()
	require.Len(t, handler.requests, 1, "small file should be single PUT")
	req := handler.requests[0]
	assert.Equal(t, http.MethodPut, req.Method)
	assert.Equal(t, "/oss/some/key/obj.bin", req.URL.Path)

	assert.Empty(t, req.URL.Query().Get("x-id"), "x-id must be stripped")
	assert.Empty(t, req.Header.Get("Amz-Sdk-Invocation-Id"), "Amz-Sdk-Invocation-Id must be stripped")
	assert.Empty(t, req.Header.Get("Amz-Sdk-Request"), "Amz-Sdk-Request must be stripped")
	assert.NotEmpty(t, req.Header.Get("Authorization"))
	assert.True(t, strings.HasPrefix(req.Header.Get("Authorization"), "AWS4-HMAC-SHA256"))
}

func TestS3Uploader_LargeFile_Multipart(t *testing.T) {
	handler := &captureHandler{}
	srv := httptest.NewServer(handler)
	defer srv.Close()

	cfg := media_archive_setting.Config{
		Enabled:       true,
		Endpoint:      srv.URL,
		Region:        "us-east-1",
		Bucket:        "oss",
		AccessKey:     "ak",
		SecretKey:     "sk",
		UsePathStyle:  true,
		PublicBaseURL: srv.URL + "/oss",
	}
	up := newS3Uploader(cfg)

	// 15 MB > 5 MB PartSize → 触发 multipart
	data := make([]byte, 15*1024*1024)
	_, err := up.Upload(context.Background(), "big/key/obj.bin", Blob{
		Data:     data,
		MimeType: "application/octet-stream",
	})
	require.NoError(t, err)

	handler.mu.Lock()
	defer handler.mu.Unlock()
	// 1 × Initiate + N × UploadPart + 1 × Complete
	assert.GreaterOrEqual(t, len(handler.requests), 4, "multipart should issue >=4 requests, got %d", len(handler.requests))

	var hasInitiate, hasComplete bool
	for _, r := range handler.requests {
		q, _ := url.ParseQuery(r.URL.RawQuery)
		if r.Method == http.MethodPost && q.Has("uploads") {
			hasInitiate = true
		}
		if r.Method == http.MethodPost && q.Has("uploadId") {
			hasComplete = true
		}
	}
	assert.True(t, hasInitiate, "should have InitiateMultipartUpload")
	assert.True(t, hasComplete, "should have CompleteMultipartUpload")
}
