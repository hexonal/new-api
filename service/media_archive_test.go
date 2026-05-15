package service

import (
	"context"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/archiver"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const mediaArchiveTestPublicURL = "https://archive.example.com/new-api/output.png"

type mediaArchiveTestDownloader struct {
	received []archiver.Source
	blob     archiver.Blob
}

func (d *mediaArchiveTestDownloader) Fetch(
	_ context.Context,
	src archiver.Source,
	_ int64,
) (archiver.Blob, error) {
	d.received = append(d.received, src)
	return d.blob, nil
}

type mediaArchiveTestUploader struct {
	publicURLs    []string
	receivedKeys  []string
	receivedBlobs []archiver.Blob
}

func (u *mediaArchiveTestUploader) Upload(
	_ context.Context,
	key string,
	blob archiver.Blob,
) (string, error) {
	index := len(u.receivedKeys)
	u.receivedKeys = append(u.receivedKeys, key)
	u.receivedBlobs = append(u.receivedBlobs, blob)
	if index < len(u.publicURLs) {
		return u.publicURLs[index], nil
	}
	return mediaArchiveTestPublicURL, nil
}

func TestMaybeArchiveTaskResultArchivesAiRouterDataURL(t *testing.T) {
	enableMediaArchiveTestConfig(t)
	downloader, uploader := installMediaArchiveTestArchiver(t)
	upstreamURL := "https://ws.esxscloud.com/aiagent/src/d/20260515/in/result.jpeg"
	body := aiRouterImageEnvelope(upstreamURL)

	archivedURL, rewritten, ok := MaybeArchiveTaskResult(context.Background(), newAiRouterImageArchiveTask(), "", body)
	require.True(t, ok)
	assert.Equal(t, mediaArchiveTestPublicURL, archivedURL)
	assert.Equal(t, upstreamURL, downloader.received[0].URL)
	assert.Contains(t, uploader.receivedKeys[0], "/image/")
	assert.Equal(t, "image/png", uploader.receivedBlobs[0].MimeType)

	assertAiRouterRewrittenPayload(t, rewritten, archivedURL, upstreamURL)
}

func enableMediaArchiveTestConfig(t *testing.T) {
	t.Helper()

	t.Setenv("MEDIA_ARCHIVE_ENABLED", "true")
	t.Setenv("MEDIA_ARCHIVE_S3_ENDPOINT", "https://oss.example.com")
	t.Setenv("MEDIA_ARCHIVE_S3_BUCKET", "oss")
	t.Setenv("MEDIA_ARCHIVE_S3_ACCESS_KEY", "ak")
	t.Setenv("MEDIA_ARCHIVE_S3_SECRET_KEY", "sk")
	t.Setenv("MEDIA_ARCHIVE_S3_PUBLIC_BASE_URL", "https://archive.example.com/new-api")
}

func installMediaArchiveTestArchiver(t *testing.T, publicURLs ...string) (*mediaArchiveTestDownloader, *mediaArchiveTestUploader) {
	t.Helper()
	if len(publicURLs) == 0 {
		publicURLs = []string{mediaArchiveTestPublicURL}
	}
	downloader := &mediaArchiveTestDownloader{
		blob: archiver.Blob{
			Data:     mustDecodeTinyPNG(t),
			MimeType: "image/png",
		},
	}
	uploader := &mediaArchiveTestUploader{
		publicURLs: publicURLs,
	}
	archiver.SetDefaultForTest(archiver.New(downloader, uploader, 1<<20, "test"))
	t.Cleanup(func() {
		archiver.ResetDefaultForTest()
	})
	return downloader, uploader
}

func aiRouterImageEnvelope(upstreamURL string) []byte {
	return []byte(`{"code":"success","data":{"amount_usd":0.032,"format":"jpeg","status":"succeeded","task_id":"task_upstream","url":"` + upstreamURL + `"}}`)
}

func aiRouterMultiImageEnvelope(firstURL string, secondURL string) []byte {
	return []byte(`{"code":"success","data":[{"url":"` + firstURL + `"},{"url":"` + firstURL + `"},{"url":"` + secondURL + `"}]}`)
}

func newAiRouterImageArchiveTask() *model.Task {
	return &model.Task{
		TaskID:   "task_public",
		Platform: constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeOpenAIImageTask)),
		Action:   constant.TaskActionImageGenerate,
		Properties: model.Properties{
			RequestPath:     "/v1/images",
			OriginModelName: "doubao-seedream-4-5-251128",
		},
	}
}

func assertAiRouterRewrittenPayload(t *testing.T, rewritten []byte, archivedURL string, upstreamURL string) {
	t.Helper()
	assert.Contains(t, string(rewritten), archivedURL)
	assert.NotContains(t, string(rewritten), upstreamURL)

	var payload struct {
		Data struct {
			URL         string `json:"url"`
			ArchivedURL string `json:"archived_url"`
		} `json:"data"`
		ArchivedURL string `json:"archived_url"`
	}
	require.NoError(t, common.Unmarshal(rewritten, &payload))
	assert.Equal(t, archivedURL, payload.Data.URL)
	assert.Equal(t, archivedURL, payload.Data.ArchivedURL)
	assert.Equal(t, archivedURL, payload.ArchivedURL)
}

func TestMaybeArchiveTaskResultArchivesAllUniqueAiRouterDataURLs(t *testing.T) {
	enableMediaArchiveTestConfig(t)
	firstSource := "https://ws.esxscloud.com/aiagent/src/d/a.jpeg"
	secondSource := "https://ws.esxscloud.com/aiagent/src/d/b.jpeg"
	firstArchive := "https://archive.example.com/new-api/a.png"
	secondArchive := "https://archive.example.com/new-api/b.png"
	downloader, uploader := installMediaArchiveTestArchiver(t, firstArchive, secondArchive)

	archivedURL, rewritten, ok := MaybeArchiveTaskResult(
		context.Background(),
		newAiRouterImageArchiveTask(),
		firstSource,
		aiRouterMultiImageEnvelope(firstSource, secondSource),
	)
	require.True(t, ok)
	assert.Equal(t, firstArchive, archivedURL)
	assert.Len(t, downloader.received, 2)
	assert.Equal(t, firstSource, downloader.received[0].URL)
	assert.Equal(t, secondSource, downloader.received[1].URL)
	assert.Len(t, uploader.receivedKeys, 2)

	assertMultiImagePayloadRewritten(t, rewritten, firstArchive, secondArchive)
}

func assertMultiImagePayloadRewritten(t *testing.T, rewritten []byte, firstArchive string, secondArchive string) {
	t.Helper()
	var payload struct {
		Data []struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(rewritten, &payload))
	require.Len(t, payload.Data, 3)
	assert.Equal(t, firstArchive, payload.Data[0].URL)
	assert.Equal(t, firstArchive, payload.Data[1].URL)
	assert.Equal(t, secondArchive, payload.Data[2].URL)
}

func TestTaskArchiveKindUsesImageActionAndRequestPath(t *testing.T) {
	imageTask := &model.Task{
		Platform: constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeOpenAIImageTask)),
		Action:   constant.TaskActionImageGenerate,
	}
	assert.Equal(t, archiver.KindImage, taskArchiveKind(imageTask))

	imagePathTask := &model.Task{
		Platform: constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeOpenAIImageTask)),
		Properties: model.Properties{
			RequestPath: "/v1/images",
		},
	}
	assert.Equal(t, archiver.KindImage, taskArchiveKind(imagePathTask))

	videoTask := &model.Task{
		Platform: constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeOpenAIImageTask)),
		Action:   constant.TaskActionImageGenerate,
		Properties: model.Properties{
			RequestPath: "/v1/videos",
		},
	}
	assert.Equal(t, archiver.KindVideo, taskArchiveKind(videoTask))
}
