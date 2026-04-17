# Media Archive SDK 迁移设计

**日期**：2026-04-18
**作者**：史泽颖（via AI brainstorming）
**状态**：待实施

## 背景

当前 `service/media_archive.go` 是一个 800+ 行的"上帝文件"，承担图片/视频/文本归档、HTTP 下载、S3 手签 SigV4 上传、MIME 检测、路径生成、告警接入等多个职责。其中最核心的上传路径是手工拼接 AWS SigV4 签名（`buildSignedUploadRequest`），存在三个问题：

1. **缺乏分片上传能力**：所有文件单次 PUT。40MB 视频一旦传到一半断开，整个文件重传。
2. **手签代码维护成本高**：AWS SDK v2 自带的 retry、checksum、multipart 等能力都没有。
3. **职责混杂**：业务胶水（`MaybeArchiveImageResponse`）、I/O 实现（`archiveURLToOSS`）、纯函数（`buildMediaArchiveObjectKey`）、工具函数（`extractContentTypeMime`）全部塞在一个文件，难以测试与演进。

本次升级目标：以最小兼容代价（零运维改动）把上传从手签切到 AWS SDK v2 `manager.Uploader`，同时把 archive 抽象成一个独立子包 `service/archiver/`，建立清晰的分层与接口边界。

## 目标

- **一刀切替换**：删除全部手签 SigV4 上传代码路径，不保留双轨切换开关。
- **职责解耦**：抽出 `Archiver` 顶层类型，下面分 `Downloader` + `Uploader` 两个接口，纯函数不做接口。
- **运维零改动**：docker-compose、env var、bucket 策略、CDN 配置全部不变；老对象 URL 继续可用。
- **测试可控**：下载/上传接口可 mock，单元测试不依赖真实网络。
- **分片能力就绪**：大文件（视频归档场景）自动享受 `manager.Uploader` 的分片并发上传与失败重试。

## 非目标

- 本次**不**做异步化（不引入 River/asynq 等任务队列）。归档继续在 HTTP 响应路径同步执行。
- 本次**不**改 bucket、CDN、DNS 任何服务端配置。
- 本次**不**迁移老数据，老 URL 继续由现有 bucket 公开读策略提供。
- 本次**不**替换 `retryablehttp` 下载实现（上一轮刚稳定，继续使用）。

## 架构

### 分层

```
┌─────────────────────────────────────────┐
│ Adapter 层（service/media_archive.go，薄）│
│   MaybeArchiveImageResponse              │
│   MaybeArchiveTaskResult                 │
│   MaybeArchiveTextResponse               │
│   MaybeArchiveStreamResponse             │
└───────────────┬─────────────────────────┘
                │ 胶水调用
                ▼
┌─────────────────────────────────────────┐
│ Archiver 层（service/archiver/）          │
│   type Archiver struct { down, up }      │
│   func Archive(ctx, src, meta) URL       │
└───────┬─────────────────────┬───────────┘
        │                     │
        ▼                     ▼
┌─────────────────┐   ┌──────────────────┐
│ Downloader      │   │ Uploader         │
│ interface       │   │ interface        │
│                 │   │                  │
│ httpDownloader  │   │ s3Uploader       │
│ (retryablehttp) │   │ (AWS SDK v2 +    │
│                 │   │  strip middleware)│
└─────────────────┘   └──────────────────┘
```

### 核心类型

```go
// service/archiver/archiver.go

type Kind string

const (
    KindImage Kind = "image"
    KindVideo Kind = "video"
)

// Source 表达"要归档什么"
type Source struct {
    URL   string        // HTTP(S) 或 data: URL
    Bytes []byte        // 或直接给字节
    Proxy string        // 可选下载代理
}

// Meta 业务上下文
type Meta struct {
    Kind      Kind
    Model     string
    ChannelID int
    UserID    int
    RequestID string
    TaskID    string
    Index     int
}

// Blob 下载产物
type Blob struct {
    Data     []byte
    MimeType string
}

// Archiver 顶层入口
type Archiver struct {
    down   Downloader
    up     Uploader
    maxSz  int64
}

func (a *Archiver) Archive(ctx context.Context, src Source, meta Meta) (string, error)
```

### 接口定义

```go
// service/archiver/downloader.go

type Downloader interface {
    Fetch(ctx context.Context, src Source, maxBytes int64) (Blob, error)
}

// service/archiver/uploader.go

type Uploader interface {
    Upload(ctx context.Context, key string, blob Blob) (publicURL string, err error)
}
```

### 纯函数

```go
// service/archiver/key.go
func BuildObjectKey(meta Meta, mimeType string, prefix string) string
func BuildPublicURL(cfg media_archive_setting.Config, objectKey string) string

// service/archiver/mime.go
func DetectMime(data []byte, kind Kind) string
func ExtractContentType(raw string) string
```

### 文件布局

```
service/archiver/
├── archiver.go         # Archiver struct + Source/Meta/Blob 定义 + Archive 主流程
├── downloader.go       # Downloader 接口 + httpDownloader 实现
├── uploader.go         # Uploader 接口 + s3Uploader 实现 + lazy init 单例
├── s3_middleware.go    # stripIncompatibleArtifacts（剥 x-id / Amz-Sdk-* / Accept-Encoding）
├── key.go              # BuildObjectKey / BuildPublicURL 纯函数
├── mime.go             # DetectMime / ExtractContentType 纯函数
├── factory.go          # GetDefault() 返回进程级单例 Archiver
└── archiver_test.go    # 单元测试，全部用 mock
```

## 关键实现细节

### SDK 客户端初始化

```go
// service/archiver/uploader.go
var (
    defaultS3ClientOnce sync.Once
    defaultS3Client     *s3.Client
)

func getDefaultS3Client() *s3.Client {
    defaultS3ClientOnce.Do(func() {
        cfg, _ := config.LoadDefaultConfig(context.Background(),
            config.WithRegion(mediaCfg.Region),
            config.WithCredentialsProvider(
                credentials.NewStaticCredentialsProvider(mediaCfg.AccessKey, mediaCfg.SecretKey, ""),
            ),
            config.WithRequestChecksumCalculation(aws.RequestChecksumCalculationWhenRequired),
            config.WithResponseChecksumValidation(aws.ResponseChecksumValidationWhenRequired),
        )
        defaultS3Client = s3.NewFromConfig(cfg, func(o *s3.Options) {
            o.BaseEndpoint = aws.String(mediaCfg.Endpoint)
            o.UsePathStyle = mediaCfg.UsePathStyle
            o.APIOptions = append(o.APIOptions, stripIncompatibleArtifacts)
        })
    })
    return defaultS3Client
}
```

### 中间件（RustFS/Caddy 兼容补丁）

```go
// service/archiver/s3_middleware.go

// stripIncompatibleArtifacts 剥除 AWS SDK v2 新增的元素，这些被
// Caddy 反代 / RustFS / 老版 MinIO 过滤后会导致 SigV4 签名不匹配。
// 必须插在 Signing 步骤之前。
func stripIncompatibleArtifacts(stack *middleware.Stack) error {
    return stack.Finalize.Insert(middleware.FinalizeMiddlewareFunc(
        "StripIncompatibleArtifacts",
        func(ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (middleware.FinalizeOutput, middleware.Metadata, error) {
            if req, ok := in.Request.(*smithyhttp.Request); ok {
                q := req.URL.Query()
                q.Del("x-id")
                req.URL.RawQuery = q.Encode()
                req.Header.Del("Amz-Sdk-Invocation-Id")
                req.Header.Del("Amz-Sdk-Request")
                req.Header.Del("Accept-Encoding")
            }
            return next.HandleFinalize(ctx, in)
        },
    ), "Signing", middleware.Before)
}
```

### Archiver.Archive 主流程

```go
func (a *Archiver) Archive(ctx context.Context, src Source, meta Meta) (string, error) {
    blob, err := a.down.Fetch(ctx, src, a.maxSz)
    if err != nil {
        return "", fmt.Errorf("download: %w", err)
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
```

### Adapter 层（保留在 `service/media_archive.go`）

文件收缩到 ~150 行，只剩业务胶水：

```go
// service/media_archive.go

func MaybeArchiveImageResponse(ctx context.Context, info *relaycommon.RelayInfo, resp *dto.ImageResponse) {
    if resp == nil || info == nil {
        return
    }
    cfg := media_archive_setting.GetConfig()
    if !cfg.IsReady() {
        return
    }
    a := archiver.GetDefault()
    for i := range resp.Data {
        meta := metaFromInfo(info, archiver.KindImage, i)
        src := archiver.Source{
            URL:   strings.TrimSpace(resp.Data[i].Url),
            Bytes: decodeB64IfPresent(resp.Data[i].B64Json),
            Proxy: info.ChannelSetting.Proxy,
        }
        archived, err := a.Archive(ctx, src, meta)
        if err != nil {
            NotifyMonitorMediaArchiveError("archive", firstNonEmpty(src.URL, "b64"), err.Error(), metaToAlertData(meta))
            continue
        }
        resp.Data[i].Url = archived
        resp.Data[i].B64Json = ""
    }
}
```

### 告警接入

`archiver` 包**不直接调用** `service.NotifyMonitor*`（避免循环依赖）。`Archive` 方法返回 `error`，由 adapter 层判断后决定是否告警。这保持了层级依赖单向向下：adapter → archiver → SDK。

## 测试策略

### 单元测试（进 CI）

`archiver_test.go` 覆盖所有分支，全部用 mock：

| 用例 | Mock 行为 | 预期 |
|---|---|---|
| 正常下载+上传 | down 返回 blob；up 返回 URL | Archive 返回 URL |
| 下载失败 | down 返回 error | Archive 返回 error，不调 up |
| 上传失败 | up 返回 error | Archive 返回 error |
| 下载为空 bytes | down 返回 0 字节 blob | Archive 返回 error（payload empty） |
| mime 自动检测 | blob.MimeType=""，data 是 PNG | up 被调用时 blob.MimeType="image/png" |
| BuildObjectKey 一致性 | 相同 meta + mime | 返回相同 key（幂等） |

### 集成测试（不进 CI）

`archiver_integration_test.go` + build tag `integration`，需要真实 AK/SK via env：

```go
//go:build integration

func TestLiveUploadAndPublicGet(t *testing.T) {
    // 从 env 加载真实凭证
    // 上传一个 1KB 随机字节
    // 匿名 HTTP GET 验证公开访问
    // DeleteObject 清理
}
```

本地触发方式：`go test -tags=integration ./service/archiver/ -run TestLive…`

## 兼容性

| 关注点 | 处理 |
|---|---|
| docker-compose.yml | **零改动**，所有 env var 一对一映射 |
| `setting/media_archive_setting/media_archive.go` | **不改** |
| 老对象 URL | 继续有效，bucket 策略不变 |
| Object key 格式 | `BuildObjectKey` 纯函数从 `buildMediaArchiveObjectKey` 平移，字节一致 |
| Public URL 格式 | `BuildPublicURL` 从 `buildMediaArchivePublicURL` 平移 |
| 公开读策略 | 不改 bucket 端，沿用现有 Caddy + RustFS 配置 |
| CDN 缓存 | 不失效，相同 URL 指向相同对象 |
| Adapter 外部 API | `MaybeArchiveImageResponse` / `MaybeArchiveTaskResult` / `MaybeArchiveTextResponse` / `MaybeArchiveStreamResponse` 的函数签名**不变** |

## 迁移步骤

1. **新增** `service/archiver/` 整包（带单元测试）。
2. **改写** `service/media_archive.go`：
   - **保留**（adapter 层业务胶水）：
     - `MaybeArchiveImageResponse`、`MaybeArchiveTaskResult`、`MaybeArchiveTextResponse`、`MaybeArchiveStreamResponse`、`MaybeArchiveTaskStoredResult`：改为调用 `archiver.GetDefault().Archive(...)`
     - `RewriteTaskResultData`、`rewriteTaskPayloadMediaNode`：任务响应结构体 JSON 改写，与归档协作但不是归档本身
     - `rewriteTextMediaReferences`：文本中扫描 URL 并归档，与 `MaybeArchiveTextResponse` 紧耦合；**保留在 adapter 层**，内部循环调用 `archiver.GetDefault().Archive(...)`
     - 告警辅助函数：`NotifyMonitorMediaArchiveError`、`metaToAlertData`、`metaFromInfo`（新增胶水函数）
     - 正则：`markdownMediaLinkPattern`、`rawURLPattern`
     - 辅助：`newMediaArchiveContext`、`logMediaArchiveFailure`、`logMediaArchiveFinalFailure`、`reportMediaArchiveFinalFailure`
     - 存量工具函数：`extractVideoBytesDataURL`、`extractTaskPayloadMediaURL`、`extractMapString`、`decodeBase64Payload`、`firstNonEmpty`、`looksLikeMediaReference`、`isMediaArchiveURL`、`sanitizePathSegment`
   - **删除**（已被 archiver 包取代）：
     - `archiveURLToOSS`（被 `Archiver.Archive` 替代）
     - `downloadMediaForArchive` / `downloadViaWorker` / `doDownloadMediaOnce` / `readArchiveBodyWithCheck` / `newMediaArchiveRetryableClient`（迁入 `archiver/downloader.go`）
     - `uploadArchivedBytes` / `uploadArchivedBytesToOSS` / `buildSignedUploadRequest`（被 `s3Uploader` 替代）
     - `archiveBackoffDelay` / `sleepWithContext` / `isRetryableArchiveError` / `archiveHTTPError`（由 retryablehttp 与 SDK adaptive retry 取代）
     - `maybeArchiveImageData` / `maybeArchiveMediaReference`（职责并入 `Archiver.Archive` 或 adapter）
     - `buildMediaArchiveObjectKey` / `buildMediaArchivePublicURL` / `buildMediaArchiveUploadURL`（纯函数迁到 `archiver/key.go`，签名保持一致）
     - `extractContentTypeMime` / `detectMediaMimeType` / `extensionFromMimeType`（迁到 `archiver/mime.go`）
   - **调整入口**：`MaybeArchiveImageResponse` 等函数内部不再构造 meta 加载 cfg 循环调用底层函数，而是组装 `archiver.Source` + `archiver.Meta` 后一次调用 `Archive`
3. **删除** `go.mod` 不再需要的 SigV4 手签依赖（保留 `aws-sdk-go-v2/service/s3`、`aws-sdk-go-v2/feature/s3/manager`、`aws-sdk-go-v2/credentials`、`aws-sdk-go-v2/config`、`aws/aws-sdk-go-v2`、`smithy-go`）。
4. **跑测试**：`go test ./service/archiver/...`
5. **跑构建**：`cd hexonal-project/new-api && go build ./...`
6. **本地触发一次真实归档**：走 image generation 端到端，验证 URL 被正确替换为 oss.axis-ai.dev 域名。
7. **视频归档验证**（可选）：用之前的 40MB mp4 URL 触发一次完整 archive 流程。

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| SDK middleware 遗漏某个 header 导致生产签名失败 | 前置端到端测试（本地验证脚本已证实 PUT + multipart 都通过） |
| 分片上传引入新错误码 | `manager.Uploader` 的错误通过 `errors.As` 解包为 `smithy.APIError`，adapter 层统一记入告警 |
| 老 URL 变化 | 无；`BuildObjectKey` 和 `BuildPublicURL` 从旧函数字节级平移 |
| 回滚 | `git revert` 整次 commit。由于 env 不变、bucket 不变，回滚立即恢复手签上传，老 URL 依然可访问 |

## 代码量预估

| 文件 | 净增行数 |
|---|---|
| `service/archiver/archiver.go` | +60 |
| `service/archiver/downloader.go` | +80 |
| `service/archiver/uploader.go` | +80 |
| `service/archiver/s3_middleware.go` | +25 |
| `service/archiver/key.go` | +50 |
| `service/archiver/mime.go` | +25 |
| `service/archiver/factory.go` | +40 |
| `service/archiver/archiver_test.go` | +200 |
| `service/media_archive.go` | −550 / +150 = 净 −400 |
| `go.mod` / `go.sum` | +6 依赖行 |
| **净变化** | **+ ~410 行** |

减去老代码后净增约 410 行，主要是单元测试和接口声明。生产代码净变化很小。

## 确认清单

- [x] 包路径 `service/archiver/`
- [x] SDK 客户端 lazy singleton
- [x] Adapter 层负责告警，archiver 包只返回 error
- [x] 集成测试不进 CI
- [x] docker-compose / env / bucket / CDN **零改动**
- [x] 老 URL 继续有效
- [x] `Maybe*` 公开函数签名不变
