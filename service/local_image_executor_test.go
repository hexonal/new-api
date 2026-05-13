package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service/archiver"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockImageChannelAdaptor struct {
	attempts    *int32
	serverURL   string
	convertErr  error
	convertFunc func(*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) (any, error)
	doFunc      func(*gin.Context, *relaycommon.RelayInfo, io.Reader) (any, error)
}

func (a *mockImageChannelAdaptor) Init(_ *relaycommon.RelayInfo) {}

func (a *mockImageChannelAdaptor) ConvertImageRequest(
	c *gin.Context,
	info *relaycommon.RelayInfo,
	request dto.ImageRequest,
) (any, error) {
	if a.convertFunc != nil {
		return a.convertFunc(c, info, request)
	}
	if a.convertErr != nil {
		return nil, a.convertErr
	}
	return request, nil
}

func (a *mockImageChannelAdaptor) DoRequest(
	c *gin.Context,
	info *relaycommon.RelayInfo,
	requestBody io.Reader,
) (any, error) {
	atomic.AddInt32(a.attempts, 1)
	if a.doFunc != nil {
		return a.doFunc(c, info, requestBody)
	}
	resp, err := http.Post(a.serverURL, "application/json", requestBody)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

type mockArchiveDownloaderForExec struct {
	received archiver.Source
	blob     archiver.Blob
}

func (d *mockArchiveDownloaderForExec) Fetch(
	_ context.Context,
	src archiver.Source,
	_ int64,
) (archiver.Blob, error) {
	d.received = src
	return d.blob, nil
}

type mockArchiveUploaderForExec struct {
	publicURL    string
	receivedKey  string
	receivedBlob archiver.Blob
}

func (u *mockArchiveUploaderForExec) Upload(
	_ context.Context,
	key string,
	blob archiver.Blob,
) (string, error) {
	u.receivedKey = key
	u.receivedBlob = blob
	return u.publicURL, nil
}

func mustDecodeTinyPNG(t *testing.T) []byte {
	t.Helper()

	imageBytes, err := base64.StdEncoding.DecodeString(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0XkAAAAASUVORK5CYII=",
	)
	require.NoError(t, err)
	return imageBytes
}

func seedLocalImageExecTask(
	t *testing.T,
	channelID int,
	quota int,
	inputRequest string,
) *model.Task {
	t.Helper()

	task := &model.Task{
		TaskID:      fmt.Sprintf("local_image_exec_%d", time.Now().UnixNano()),
		UserId:      1,
		Group:       "default",
		ChannelId:   channelID,
		Platform:    constant.TaskPlatformImage,
		Status:      model.TaskStatusInProgress,
		WorkerID:    "worker-a",
		HeartbeatAt: time.Now().Unix(),
		SubmitTime:  time.Now().Unix(),
		CreatedAt:   time.Now().Unix(),
		UpdatedAt:   time.Now().Unix(),
		Progress:    "0%",
		Quota:       quota,
		Properties: model.Properties{
			OriginModelName: "dall-e-3",
			RequestPath:     "/v1/images/generations",
		},
		PrivateData: model.TaskPrivateData{
			InputRequest:  inputRequest,
			BillingSource: BillingSourceWallet,
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "dall-e-3",
				PerCallBilling:  true,
			},
		},
	}
	require.NoError(t, model.DB.Create(task).Error)
	return task
}

func seedOpenAIChannelForExec(t *testing.T, id int, baseURL string) *model.Channel {
	t.Helper()

	ch := &model.Channel{
		Id:          id,
		Type:        constant.ChannelTypeOpenAI,
		Key:         "sk-test",
		Name:        "test-openai",
		Status:      common.ChannelStatusEnabled,
		BaseURL:     &baseURL,
		CreatedTime: time.Now().Unix(),
	}
	require.NoError(t, model.DB.Create(ch).Error)
	return ch
}

func TestExecute_Success(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 100)

	imageRequest := `{"model":"dall-e-3","prompt":"a lighthouse in the storm"}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"created":1,"data":[{"url":"https://example.com/result.png"}]}`))
	}))
	defer server.Close()

	seedOpenAIChannelForExec(t, 11, server.URL)
	task := seedLocalImageExecTask(t, 11, 20, imageRequest)

	var attempts int32
	previousFactory := GetChannelAdaptorFunc
	GetChannelAdaptorFunc = func(apiType int) ImageChannelAdaptor {
		require.Equal(t, constant.APITypeOpenAI, apiType)
		return &mockImageChannelAdaptor{
			attempts:  &attempts,
			serverURL: server.URL,
		}
	}
	t.Cleanup(func() {
		GetChannelAdaptorFunc = previousFactory
	})

	err := ExecuteLocalImageTask(context.Background(), "worker-a", task)
	require.NoError(t, err)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusSuccess, updated.Status)
	assert.Equal(t, "http://localhost:3000/v1/videos/"+task.TaskID+"/content", updated.PrivateData.ResultURL)
	assert.EqualValues(t, 1, atomic.LoadInt32(&attempts))
	assert.Equal(t, 100, getUserQuota(t, 1))
}

func TestExecute_SuccessArchivesImageResultURL(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 100)
	t.Setenv("MEDIA_ARCHIVE_ENABLED", "true")
	t.Setenv("MEDIA_ARCHIVE_S3_ENDPOINT", "https://oss.example.com")
	t.Setenv("MEDIA_ARCHIVE_S3_BUCKET", "oss")
	t.Setenv("MEDIA_ARCHIVE_S3_ACCESS_KEY", "ak")
	t.Setenv("MEDIA_ARCHIVE_S3_SECRET_KEY", "sk")
	t.Setenv("MEDIA_ARCHIVE_S3_PUBLIC_BASE_URL", "https://archive.example.com/new-api")

	downloader := &mockArchiveDownloaderForExec{
		blob: archiver.Blob{
			Data:     mustDecodeTinyPNG(t),
			MimeType: "image/png",
		},
	}
	uploader := &mockArchiveUploaderForExec{
		publicURL: "https://archive.example.com/new-api/output.png",
	}
	archiver.SetDefaultForTest(archiver.New(downloader, uploader, 1<<20, "test"))
	t.Cleanup(func() {
		archiver.ResetDefaultForTest()
	})

	imageRequest := `{"model":"dall-e-3","prompt":"archive the image result"}`
	seedOpenAIChannelForExec(t, 17, "https://example.invalid")
	task := seedLocalImageExecTask(t, 17, 20, imageRequest)

	var attempts int32
	previousFactory := GetChannelAdaptorFunc
	GetChannelAdaptorFunc = func(apiType int) ImageChannelAdaptor {
		require.Equal(t, constant.APITypeOpenAI, apiType)
		return &mockImageChannelAdaptor{
			attempts: &attempts,
			doFunc: func(_ *gin.Context, _ *relaycommon.RelayInfo, _ io.Reader) (any, error) {
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body: io.NopCloser(strings.NewReader(
						`{"created":1,"data":[{"url":"https://upstream.example/result.png"}]}`,
					)),
				}, nil
			},
		}
	}
	t.Cleanup(func() {
		GetChannelAdaptorFunc = previousFactory
	})

	err := ExecuteLocalImageTask(context.Background(), "worker-a", task)
	require.NoError(t, err)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusSuccess, updated.Status)
	assert.Equal(t, "https://archive.example.com/new-api/output.png", updated.PrivateData.ResultURL)
	assert.Equal(t, "https://archive.example.com/new-api/output.png", updated.PrivateData.OutputImageURL)
	assert.Contains(t, string(updated.Data), "https://archive.example.com/new-api/output.png")
	assert.NotContains(t, string(updated.Data), "https://upstream.example/result.png")
	assert.Equal(t, "https://upstream.example/result.png", downloader.received.URL)
	assert.Contains(t, uploader.receivedKey, "/image/")
	assert.Equal(t, "image/png", uploader.receivedBlob.MimeType)
}

func TestExecute_4xxFatal(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 100)

	imageRequest := `{"model":"dall-e-3","prompt":"fatal upstream request"}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "bad request", http.StatusBadRequest)
	}))
	defer server.Close()

	seedOpenAIChannelForExec(t, 12, server.URL)
	task := seedLocalImageExecTask(t, 12, 20, imageRequest)

	var attempts int32
	previousFactory := GetChannelAdaptorFunc
	GetChannelAdaptorFunc = func(apiType int) ImageChannelAdaptor {
		require.Equal(t, constant.APITypeOpenAI, apiType)
		return &mockImageChannelAdaptor{
			attempts:  &attempts,
			serverURL: server.URL,
		}
	}
	t.Cleanup(func() {
		GetChannelAdaptorFunc = previousFactory
	})

	err := ExecuteLocalImageTask(context.Background(), "worker-a", task)
	require.Error(t, err)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, updated.Status)
	assert.Contains(t, updated.FailReason, "upstream 400")
	assert.EqualValues(t, 1, atomic.LoadInt32(&attempts))
	assert.Equal(t, 120, getUserQuota(t, 1))
}

func TestExecute_5xxExhausted(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 100)

	imageRequest := `{"model":"dall-e-3","prompt":"retry exhausted"}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream temporarily unavailable", http.StatusInternalServerError)
	}))
	defer server.Close()

	seedOpenAIChannelForExec(t, 13, server.URL)
	task := seedLocalImageExecTask(t, 13, 20, imageRequest)

	var attempts int32
	previousFactory := GetChannelAdaptorFunc
	GetChannelAdaptorFunc = func(apiType int) ImageChannelAdaptor {
		require.Equal(t, constant.APITypeOpenAI, apiType)
		return &mockImageChannelAdaptor{
			attempts:  &attempts,
			serverURL: server.URL,
		}
	}
	t.Cleanup(func() {
		GetChannelAdaptorFunc = previousFactory
	})

	err := ExecuteLocalImageTask(context.Background(), "worker-a", task)
	require.Error(t, err)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, updated.Status)
	assert.True(t, strings.Contains(updated.FailReason, "upstream 500") || strings.Contains(updated.FailReason, "upstream status 500"))
	assert.EqualValues(t, 3, atomic.LoadInt32(&attempts))
	assert.Equal(t, 120, getUserQuota(t, 1))
}

func TestExecute_Edits_Success(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 100)

	inputImageBytes := mustDecodeTinyPNG(t)
	imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(inputImageBytes)
	}))
	defer imageServer.Close()
	fetchSetting := system_setting.GetFetchSetting()
	previousAllowPrivateIP := fetchSetting.AllowPrivateIp
	previousAllowedPorts := append([]string(nil), fetchSetting.AllowedPorts...)
	fetchSetting.AllowPrivateIp = true
	fetchSetting.AllowedPorts = append(fetchSetting.AllowedPorts, strings.TrimPrefix(imageServer.URL, "http://127.0.0.1:"))
	t.Cleanup(func() {
		fetchSetting.AllowPrivateIp = previousAllowPrivateIP
		fetchSetting.AllowedPorts = previousAllowedPorts
	})

	imageRequest := `{"model":"gpt-image-1","prompt":"edit this image","size":"1024x1024","quality":"high","n":2}`
	seedOpenAIChannelForExec(t, 14, "https://example.invalid")
	task := seedLocalImageExecTask(t, 14, 20, imageRequest)
	task.PrivateData.ImageTaskMode = "edits"
	task.PrivateData.InputImageURL = imageServer.URL + "/input.png"
	require.NoError(t, model.DB.Save(task).Error)

	var attempts int32
	previousFactory := GetChannelAdaptorFunc
	GetChannelAdaptorFunc = func(apiType int) ImageChannelAdaptor {
		require.Equal(t, constant.APITypeOpenAI, apiType)
		return &mockImageChannelAdaptor{
			attempts: &attempts,
			convertFunc: func(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
				require.Equal(t, relayconstant.RelayModeImagesGenerations, info.RelayMode)
				require.Equal(t, "/v1/images/generations", c.Request.URL.Path)
				require.NotEmpty(t, request.Image)
				require.NotNil(t, c.Request.GetBody)

				bodyReader, err := c.Request.GetBody()
				require.NoError(t, err)
				bodyBytes, err := io.ReadAll(bodyReader)
				require.NoError(t, err)
				return bytes.NewBuffer(bodyBytes), nil
			},
			doFunc: func(c *gin.Context, _ *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
				bodyBytes, err := io.ReadAll(requestBody)
				require.NoError(t, err)
				require.Equal(t, "application/json", c.Request.Header.Get("Content-Type"))

				var payload map[string]json.RawMessage
				require.NoError(t, common.Unmarshal(bodyBytes, &payload))
				assertJSONFieldEquals(t, payload, "prompt", "edit this image")
				assertJSONFieldEquals(t, payload, "model", "gpt-image-1")
				assertJSONFieldEquals(t, payload, "size", "1024x1024")
				assertJSONFieldEquals(t, payload, "quality", "high")
				assertJSONFieldEquals(t, payload, "n", float64(2))
				assertJSONFieldContainsURL(t, payload, "image", imageServer.URL+"/input.png")

				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body: io.NopCloser(strings.NewReader(
						`{"created":1,"data":[{"url":"https://example.com/edited.png"}]}`,
					)),
				}, nil
			},
		}
	}
	t.Cleanup(func() {
		GetChannelAdaptorFunc = previousFactory
	})

	err := ExecuteLocalImageTask(context.Background(), "worker-a", task)
	require.NoError(t, err)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusSuccess, updated.Status)
	assert.Equal(t, "http://localhost:3000/v1/videos/"+task.TaskID+"/content", updated.PrivateData.ResultURL)
	assert.EqualValues(t, 1, atomic.LoadInt32(&attempts))
}

func TestExecute_Edits_WithMask_Success(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 100)

	inputImageBytes := mustDecodeTinyPNG(t)
	maskImageBytes := mustDecodeTinyPNG(t)
	imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(inputImageBytes)
	}))
	defer imageServer.Close()
	maskServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(maskImageBytes)
	}))
	defer maskServer.Close()

	fetchSetting := system_setting.GetFetchSetting()
	previousAllowPrivateIP := fetchSetting.AllowPrivateIp
	previousAllowedPorts := append([]string(nil), fetchSetting.AllowedPorts...)
	fetchSetting.AllowPrivateIp = true
	fetchSetting.AllowedPorts = append(
		fetchSetting.AllowedPorts,
		strings.TrimPrefix(imageServer.URL, "http://127.0.0.1:"),
		strings.TrimPrefix(maskServer.URL, "http://127.0.0.1:"),
	)
	t.Cleanup(func() {
		fetchSetting.AllowPrivateIp = previousAllowPrivateIP
		fetchSetting.AllowedPorts = previousAllowedPorts
	})

	imageRequest := `{"model":"gpt-image-1","prompt":"mask this image","size":"1024x1024"}`
	seedOpenAIChannelForExec(t, 16, "https://example.invalid")
	task := seedLocalImageExecTask(t, 16, 20, imageRequest)
	task.PrivateData.ImageTaskMode = "edits"
	task.PrivateData.InputImageURL = imageServer.URL + "/input.png"
	task.PrivateData.InputMaskURL = maskServer.URL + "/mask.png"
	require.NoError(t, model.DB.Save(task).Error)

	var attempts int32
	previousFactory := GetChannelAdaptorFunc
	GetChannelAdaptorFunc = func(apiType int) ImageChannelAdaptor {
		require.Equal(t, constant.APITypeOpenAI, apiType)
		return &mockImageChannelAdaptor{
			attempts: &attempts,
			convertFunc: func(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
				require.Equal(t, relayconstant.RelayModeImagesGenerations, info.RelayMode)
				require.Equal(t, "/v1/images/generations", c.Request.URL.Path)
				require.NotEmpty(t, request.Image)
				bodyReader, err := c.Request.GetBody()
				require.NoError(t, err)
				bodyBytes, err := io.ReadAll(bodyReader)
				require.NoError(t, err)
				return bytes.NewBuffer(bodyBytes), nil
			},
			doFunc: func(c *gin.Context, _ *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
				bodyBytes, err := io.ReadAll(requestBody)
				require.NoError(t, err)
				require.Equal(t, "application/json", c.Request.Header.Get("Content-Type"))

				var payload map[string]json.RawMessage
				require.NoError(t, common.Unmarshal(bodyBytes, &payload))
				assertJSONFieldEquals(t, payload, "prompt", "mask this image")
				assertJSONFieldContainsURL(t, payload, "image", imageServer.URL+"/input.png")
				assertJSONFieldEquals(t, payload, "mask", maskServer.URL+"/mask.png")

				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body: io.NopCloser(strings.NewReader(
						`{"created":1,"data":[{"url":"https://example.com/masked.png"}]}`,
					)),
				}, nil
			},
		}
	}
	t.Cleanup(func() {
		GetChannelAdaptorFunc = previousFactory
	})

	err := ExecuteLocalImageTask(context.Background(), "worker-a", task)
	require.NoError(t, err)

	var updated model.Task
	require.NoError(t, model.DB.First(&updated, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusSuccess, updated.Status)
	assert.Equal(t, "http://localhost:3000/v1/videos/"+task.TaskID+"/content", updated.PrivateData.ResultURL)
	assert.EqualValues(t, 1, atomic.LoadInt32(&attempts))
}

func assertJSONFieldEquals(t *testing.T, payload map[string]json.RawMessage, key string, expected any) {
	t.Helper()

	raw, ok := payload[key]
	require.True(t, ok, "missing json field %s", key)

	switch want := expected.(type) {
	case string:
		var value string
		require.NoError(t, common.Unmarshal(raw, &value))
		assert.Equal(t, want, value)
	case float64:
		var value float64
		require.NoError(t, common.Unmarshal(raw, &value))
		assert.Equal(t, want, value)
	default:
		t.Fatalf("unsupported expected type for %s", key)
	}
}

func assertJSONFieldContainsURL(t *testing.T, payload map[string]json.RawMessage, key string, expectedURL string) {
	t.Helper()

	raw, ok := payload[key]
	require.True(t, ok, "missing json field %s", key)

	var urls []string
	require.NoError(t, common.Unmarshal(raw, &urls))
	require.NotEmpty(t, urls)
	assert.Equal(t, expectedURL, urls[0])
}

func TestExecute_SendsIdempotencyKeyHeader(t *testing.T) {
	truncate(t)
	seedUser(t, 1, 100)

	imageRequest := `{"model":"dall-e-3","prompt":"check idempotency header"}`
	serverHeaders := make(chan http.Header, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serverHeaders <- r.Header.Clone()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"created":1,"data":[{"url":"https://example.com/idempotent.png"}]}`))
	}))
	defer server.Close()

	seedOpenAIChannelForExec(t, 15, server.URL)
	task := seedLocalImageExecTask(t, 15, 20, imageRequest)
	task.PrivateData.UpstreamIdempotencyKey = "idem-local-image-123"
	require.NoError(t, model.DB.Save(task).Error)

	var attempts int32
	previousFactory := GetChannelAdaptorFunc
	GetChannelAdaptorFunc = func(apiType int) ImageChannelAdaptor {
		require.Equal(t, constant.APITypeOpenAI, apiType)
		return &mockImageChannelAdaptor{
			attempts: &attempts,
			doFunc: func(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
				req, err := http.NewRequest(c.Request.Method, server.URL+c.Request.URL.Path, requestBody)
				require.NoError(t, err)
				req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
				req.Header.Set("Accept", c.Request.Header.Get("Accept"))
				for key, value := range info.RuntimeHeadersOverride {
					req.Header.Set(key, fmt.Sprint(value))
				}
				return http.DefaultClient.Do(req)
			},
		}
	}
	t.Cleanup(func() {
		GetChannelAdaptorFunc = previousFactory
	})

	err := ExecuteLocalImageTask(context.Background(), "worker-a", task)
	require.NoError(t, err)

	headers := <-serverHeaders
	assert.Equal(t, "idem-local-image-123", headers.Get("Idempotency-Key"))
	assert.Equal(t, "idem-local-image-123", headers.Get("X-New-Api-Idempotency-Key"))
	assert.EqualValues(t, 1, atomic.LoadInt32(&attempts))
}
