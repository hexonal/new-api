package archiver

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeDownloader struct {
	blob Blob
	err  error
}

func (f *fakeDownloader) Fetch(ctx context.Context, src Source, maxBytes int64) (Blob, error) {
	return f.blob, f.err
}

type fakeUploader struct {
	receivedKey  string
	receivedBlob Blob
	publicURL    string
	err          error
}

func (f *fakeUploader) Upload(ctx context.Context, key string, blob Blob) (string, error) {
	f.receivedKey = key
	f.receivedBlob = blob
	return f.publicURL, f.err
}

func TestArchiver_HappyPath(t *testing.T) {
	d := &fakeDownloader{blob: Blob{Data: []byte{0x89, 'P', 'N', 'G'}, MimeType: "image/png"}}
	u := &fakeUploader{publicURL: "https://cdn/obj.png"}
	a := New(d, u, 100*1024*1024, "new-api")

	url, err := a.Archive(context.Background(), Source{URL: "https://x"}, Meta{Kind: KindImage, Model: "m", ChannelID: 1, UserID: 1, RequestID: "r"})
	require.NoError(t, err)
	assert.Equal(t, "https://cdn/obj.png", url)
	assert.Equal(t, []byte{0x89, 'P', 'N', 'G'}, u.receivedBlob.Data)
	assert.Contains(t, u.receivedKey, "new-api/")
	assert.Contains(t, u.receivedKey, "/image/")
}

func TestArchiver_DownloadError(t *testing.T) {
	d := &fakeDownloader{err: errors.New("boom")}
	u := &fakeUploader{}
	a := New(d, u, 100*1024*1024, "new-api")

	_, err := a.Archive(context.Background(), Source{URL: "https://x"}, Meta{Kind: KindImage})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "download")
	assert.Empty(t, u.receivedKey, "uploader must not be called on download error")
}

func TestArchiver_UploadError(t *testing.T) {
	d := &fakeDownloader{blob: Blob{Data: []byte("x"), MimeType: "image/png"}}
	u := &fakeUploader{err: errors.New("403 InvalidAccessKeyId")}
	a := New(d, u, 100*1024*1024, "new-api")

	_, err := a.Archive(context.Background(), Source{URL: "https://x"}, Meta{Kind: KindImage})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "upload")
}

func TestArchiver_EmptyMimeFallsBackToDetect(t *testing.T) {
	pngBytes := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
	d := &fakeDownloader{blob: Blob{Data: pngBytes, MimeType: ""}}
	u := &fakeUploader{publicURL: "https://cdn/x"}
	a := New(d, u, 100*1024*1024, "new-api")

	_, err := a.Archive(context.Background(), Source{URL: "https://x"}, Meta{Kind: KindImage})
	require.NoError(t, err)
	assert.Equal(t, "image/png", u.receivedBlob.MimeType, "DetectMime should fill missing MIME")
}

func TestArchiver_EmptyBlobIsError(t *testing.T) {
	d := &fakeDownloader{blob: Blob{}}
	u := &fakeUploader{}
	a := New(d, u, 100*1024*1024, "new-api")

	_, err := a.Archive(context.Background(), Source{URL: "https://x"}, Meta{Kind: KindImage})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "empty")
}
