package archiver

import (
	"context"
	"fmt"
)

// Kind 表示归档媒体的类别，用于对象 key 的路径分段以及 MIME 回退。
type Kind string

const (
	KindImage Kind = "image"
	KindVideo Kind = "video"
)

// Source 表达"要归档什么"。URL 与 Bytes 至少提供一个；两者都给时优先 Bytes。
type Source struct {
	URL   string
	Bytes []byte
	Proxy string
}

// Meta 携带业务上下文，用于生成对象 key 和告警定位。
type Meta struct {
	Kind      Kind
	Model     string
	ChannelID int
	UserID    int
	RequestID string
	TaskID    string
	Index     int
}

// Blob 是下载产物。
type Blob struct {
	Data     []byte
	MimeType string
}

// Downloader 抽象媒体下载；生产实现走 retryablehttp，测试可注入 mock。
type Downloader interface {
	Fetch(ctx context.Context, src Source, maxBytes int64) (Blob, error)
}

// Uploader 抽象归档上传；生产实现走 AWS SDK v2 manager.Uploader。
type Uploader interface {
	Upload(ctx context.Context, key string, blob Blob) (publicURL string, err error)
}

// Archiver 组合下载 + 上传，同时负责对象 key 生成与 MIME 回退。
type Archiver struct {
	down       Downloader
	up         Uploader
	maxBytes   int64
	pathPrefix string
}

// New 构造 Archiver。maxBytes 为下载大小上限（字节），pathPrefix 为 object key 前缀。
func New(down Downloader, up Uploader, maxBytes int64, pathPrefix string) *Archiver {
	return &Archiver{
		down:       down,
		up:         up,
		maxBytes:   maxBytes,
		pathPrefix: pathPrefix,
	}
}

// Archive 顺序执行下载→（MIME 回退）→生成 key→上传，返回公开访问 URL。
// 任何环节失败都以错误返回；本函数不负责告警，由 adapter 层处理。
func (a *Archiver) Archive(ctx context.Context, src Source, meta Meta) (string, error) {
	blob, err := a.down.Fetch(ctx, src, a.maxBytes)
	if err != nil {
		return "", fmt.Errorf("download: %w", err)
	}
	if len(blob.Data) == 0 {
		return "", fmt.Errorf("download: empty body")
	}
	if blob.MimeType == "" {
		blob.MimeType = DetectMime(blob.Data, meta.Kind)
	}
	key := BuildObjectKey(meta, blob.MimeType, a.pathPrefix)
	url, err := a.up.Upload(ctx, key, blob)
	if err != nil {
		return "", fmt.Errorf("upload: %w", err)
	}
	return url, nil
}
