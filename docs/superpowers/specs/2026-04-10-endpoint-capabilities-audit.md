# 端点与 Capabilities 全量审计

> 日期：2026-04-10

## 1. EndpointType 定义

### 1.1 当前定义（constant/endpoint_type.go）

| EndpointType | 值 | 含义 |
|-------------|-----|------|
| `EndpointTypeOpenAI` | `openai` | OpenAI 兼容协议（❌ 含义模糊，混合了 chat/tts/stt/moderation） |
| `EndpointTypeOpenAIResponse` | `openai-response` | OpenAI Responses API |
| `EndpointTypeOpenAIResponseCompact` | `openai-response-compact` | OpenAI Responses API（紧凑） |
| `EndpointTypeAnthropic` | `anthropic` | Anthropic Messages API |
| `EndpointTypeGemini` | `gemini` | Google Gemini API |
| `EndpointTypeImageGeneration` | `image-generation` | 图片生成（OpenAI 兼容） |
| `EndpointTypeEmbeddings` | `embeddings` | 向量嵌入 |
| `EndpointTypeJinaRerank` | `jina-rerank` | Jina Rerank |
| `EndpointTypeOpenAIVideo` | `openai-video` | 视频生成（OpenAI 兼容异步） |
| `EndpointTypeKling` | `kling` | 快影视频生成 |
| `EndpointTypeSuno` | `suno-proxy` | Suno 音乐生成 |
| `EndpointTypeMidjourney` | `midjourney-proxy` | Midjourney 图片生成 |
| `EndpointTypeJimeng` | `jimeng` | 即梦图片生成 |

### 1.2 调整后定义

将 `openai` 拆分为 5 个精确的 EndpointType：

| EndpointType | 值 | 含义 | capability |
|-------------|-----|------|-----------|
| ~~`EndpointTypeOpenAI`~~ | ~~`openai`~~ | ~~废弃~~ | ~~混合 5 个能力~~ |
| `EndpointTypeOpenAIChat` | `openai-chat` | OpenAI Chat Completions | chat |
| `EndpointTypeOpenAISTT` | `openai-stt` | OpenAI Speech-to-Text (Whisper) | speech_to_text |
| `EndpointTypeOpenAITTS` | `openai-tts` | OpenAI Text-to-Speech | text_to_speech |
| `EndpointTypeOpenAIAudioTranslation` | `openai-audio-translation` | OpenAI Audio Translation | audio_translation |
| `EndpointTypeOpenAIModeration` | `openai-moderation` | OpenAI Moderation | moderation |

保持不变的 EndpointType：

| EndpointType | 值 | capability |
|-------------|-----|-----------|
| `EndpointTypeOpenAIResponse` | `openai-response` | chat |
| `EndpointTypeOpenAIResponseCompact` | `openai-response-compact` | chat |
| `EndpointTypeAnthropic` | `anthropic` | chat |
| `EndpointTypeGemini` | `gemini` | chat |
| `EndpointTypeImageGeneration` | `image-generation` | text_to_image, image_to_image |
| `EndpointTypeEmbeddings` | `embeddings` | embeddings |
| `EndpointTypeJinaRerank` | `jina-rerank` | rerank |
| `EndpointTypeOpenAIVideo` | `openai-video` | video_generation |
| `EndpointTypeKling` | `kling` | kling_video |
| `EndpointTypeSuno` | `suno-proxy` | music_generation |
| `EndpointTypeMidjourney` | `midjourney-proxy` | midjourney_generation |
| `EndpointTypeJimeng` | `jimeng` | jimeng_image |

### 1.3 endpointToCapabilities 调整后

每个 EndpointType 1:1 映射到 capability（图片类 1:2 保持）：

```go
var endpointToCapabilities = map[constant.EndpointType][]string{
    // Chat（按协议区分 endpoint/sdk_method）
    constant.EndpointTypeOpenAIChat:            {"chat"},          // /v1/chat/completions → aiApi.chatCompletions
    constant.EndpointTypeOpenAIResponse:        {"chat"},          // /v1/responses → aiApi.responses
    constant.EndpointTypeOpenAIResponseCompact: {"chat"},          // /v1/responses/compact → aiApi.responses
    constant.EndpointTypeAnthropic:             {"chat"},          // /v1/messages → aiApi.messages
    constant.EndpointTypeGemini:                {"chat"},          // /v1/chat/completions → aiApi.chatCompletions
    // Audio（从 openai 拆出）
    constant.EndpointTypeOpenAISTT:             {"speech_to_text"},
    constant.EndpointTypeOpenAITTS:             {"text_to_speech"},
    constant.EndpointTypeOpenAIAudioTranslation:{"audio_translation"},
    // Moderation（从 openai 拆出）
    constant.EndpointTypeOpenAIModeration:      {"moderation"},
    // Image
    constant.EndpointTypeImageGeneration:       {"text_to_image", "image_to_image"},
    constant.EndpointTypeJimeng:                {"jimeng_image"},
    // Video
    constant.EndpointTypeOpenAIVideo:           {"video_generation"},
    constant.EndpointTypeKling:                 {"kling_video"},
    // Embedding
    constant.EndpointTypeEmbeddings:            {"embeddings"},
    // Rerank
    constant.EndpointTypeJinaRerank:            {"rerank"},
    // Music
    constant.EndpointTypeSuno:                  {"music_generation"},
    // Midjourney
    constant.EndpointTypeMidjourney:            {"midjourney_generation"},
}
```

### 1.4 capabilityDefs 调整后（按协议区分 chat）

```go
// chat 不再是全局固定定义，改为按 EndpointType 定义
var endpointCapabilityDefs = map[constant.EndpointType]map[string]ModelCapability{
    EndpointTypeOpenAIChat: {
        "chat": {Endpoint: "/v1/chat/completions", RequestFormat: "json", SDKMethod: "aiApi.chatCompletions"},
    },
    EndpointTypeOpenAIResponse: {
        "chat": {Endpoint: "/v1/responses", RequestFormat: "json", SDKMethod: "aiApi.responses"},
    },
    EndpointTypeOpenAIResponseCompact: {
        "chat": {Endpoint: "/v1/responses/compact", RequestFormat: "json", SDKMethod: "aiApi.responses"},
    },
    EndpointTypeAnthropic: {
        "chat": {Endpoint: "/v1/messages", RequestFormat: "json", SDKMethod: "aiApi.messages"},
    },
    EndpointTypeGemini: {
        "chat": {Endpoint: "/v1/chat/completions", RequestFormat: "json", SDKMethod: "aiApi.chatCompletions"},
    },
    EndpointTypeOpenAISTT: {
        "speech_to_text": {Endpoint: "/v1/audio/transcriptions", RequestFormat: "multipart", SDKMethod: "aiApi.audioTranscriptions"},
    },
    EndpointTypeOpenAITTS: {
        "text_to_speech": {Endpoint: "/v1/audio/speech", RequestFormat: "blob_response", SDKMethod: "aiApi.audioSpeech"},
    },
    EndpointTypeOpenAIAudioTranslation: {
        "audio_translation": {Endpoint: "/v1/audio/translations", RequestFormat: "multipart", SDKMethod: "aiApi.audioTranslations"},
    },
    EndpointTypeOpenAIModeration: {
        "moderation": {Endpoint: "/v1/moderations", RequestFormat: "json", SDKMethod: "aiApi.moderations"},
    },
    // 其余保持 capabilityDefs 原有定义...
}
```

### 1.5 迁移影响

`openai` → `openai-chat` 是 breaking change，需同步修改：

| 位置 | 影响 | 改动 |
|------|------|------|
| `constant/endpoint_type.go` | 常量定义 | 新增 5 个，废弃 1 个 |
| `common/endpoint_type.go` | `GetEndpointTypesByChannelType` default 分支 | `openai` → `openai-chat` |
| `common/endpoint_defaults.go` | 默认路径映射 | 新增 5 个端点路径 |
| `dto/model_capabilities.go` | capabilities 构建 | 重构为按 EndpointType 定义 |
| `model/pricing.go` | endpoint types 累积 | 无改动（透传字符串） |
| `controller/model.go` | /v1/models 响应 | 无改动（透传） |
| DB `models.endpoints` | 已配置的模型 | 需把 `"openai"` 替换为 `"openai-chat"` |
| api-sdk `ENDPOINT_TYPE_TO_CAPABILITIES` | 前端映射 | `openai` → `openai-chat` |
| api-sdk `inferCapabilities()` | 推断逻辑 | 同步新类型 |
| relay 路由 | 请求转发 | 需确认 relay 是否依赖 `openai` 字符串 |

## 2. 所有端点路径（来源：relay 适配器 + endpoint_defaults.go + router）

### 2.1 Chat 端点（new-api 对客户端暴露的路径）

| 协议 | new-api 路径 | 上游原生路径 | 说明 |
|------|-------------|-------------|------|
| OpenAI Chat | `/v1/chat/completions` | `/v1/chat/completions` | GPT、Grok、Kimi、DeepSeek 等 |
| OpenAI Responses | `/v1/responses` | `/v1/responses` | o3-pro 等 |
| Anthropic Messages | `/v1/messages` | `/v1/messages` | Claude 系列 |
| Gemini | `/v1/chat/completions`（代理） | `/v1beta/models/{model}:generateContent` | new-api 内部转换 |

### 2.2 图片端点

| 协议 | new-api 路径 | 上游原生路径 | 适用模型 |
|------|-------------|-------------|---------|
| OpenAI Image Gen | `/v1/images/generations` | `/v1/images/generations` | DALL-E、gpt-image-1 |
| OpenAI Image Edit | `/v1/images/edits` | `/v1/images/edits` | DALL-E |
| 即梦 (Jimeng) | `/v1/images/generations`（代理） | VolcEngine 原生 API | jimeng-4.x |
| 快影图片 (Kling) | 异步任务 | `/v1/images/omni-image` | kling 图片模型 |
| 悠船 (Youchuan) | 异步任务 | `/v1/tob/diffusion` | 悠船图片模型 |

### 2.3 视频端点

| 提供商 | ChannelType | new-api 路径 | 上游原生路径 | 当前 EndpointType | 问题 |
|--------|-----------|-------------|-------------|------------------|------|
| Sora (OpenAI) | Sora(55) | 异步任务 | `/v1/videos` | `openai-video` | ✓ |
| 快影 (Kling) | Kling(50) | 异步任务 | `/v1/videos/text2video`, `/v1/videos/image2video` | `kling` | ✓ |
| Vidu | Vidu(52) | 异步任务 | `/ent/v2/generations` | **default→openai** | ❌ 缺专属 EndpointType |
| 豆包视频 (Doubao) | DoubaoVideo(54) | 异步任务 | `/api/v3/contents/generations/tasks` | **default→openai** | ❌ 缺专属 EndpointType |
| PixVerse | PixVerse(59) | 异步任务 | `/openapi/v2/video/text/generate`, `/openapi/v2/video/img/generate` | **default→openai** | ❌ 缺专属 EndpointType |
| 海螺 (Hailuo) | 无专属 | 异步任务 | `/v1/video_generation` | **default→openai** | ❌ 缺专属 EndpointType |
| Replicate | Replicate(56) | 异步任务 | Replicate API | **default→openai** | ❌ 缺专属 EndpointType |

### 2.4 音频端点

| 能力 | new-api 路径 | 上游原生路径 | 适用模型 | 当前 EndpointType | 问题 |
|------|-------------|-------------|---------|------------------|------|
| 语音转文字 (STT) | `/v1/audio/transcriptions` | `/v1/audio/transcriptions` | whisper-1 | **default→openai** | ❌ 与 chat 混合 |
| 文字转语音 (TTS) | `/v1/audio/speech` | `/v1/audio/speech` | tts-1, tts-1-hd | **default→openai** | ❌ 与 chat 混合 |
| 音频翻译 | `/v1/audio/translations` | `/v1/audio/translations` | whisper-1 | **default→openai** | ❌ 与 chat 混合 |

### 2.5 其他端点

| 能力 | new-api 路径 | 上游原生路径 | 适用模型 | 当前 EndpointType |
|------|-------------|-------------|---------|------------------|
| 向量嵌入 | `/v1/embeddings` | `/v1/embeddings` | text-embedding-3-* | `embeddings` ✓ |
| 内容审核 | `/v1/moderations` | `/v1/moderations` | omni-moderation-* | **default→openai** ❌ |
| 重排序 | `/v1/rerank` | `/v1/rerank` | jina-reranker | `jina-rerank` ✓ |
| 音乐生成 | `/suno/submit/{action}` | Suno API | suno 模型 | `suno-proxy` ✓ |
| Midjourney | `/mj/submit/imagine` | MJ API | mj 模型 | `midjourney-proxy` ✓ |
| 实时对话 | `/v1/realtime` | `/v1/realtime` | realtime 模型 | 无 |

## 3. ChannelType → EndpointType 映射（common/endpoint_type.go）

`GetEndpointTypesByChannelType(channelType, modelName)` 的完整映射：

### 3.1 当前映射

| ChannelType | ID | 返回的 EndpointTypes | 备注 |
|------------|-----|---------------------|------|
| Jina | 38 | `[jina-rerank]` | |
| Midjourney / MidjourneyPlus | 2/5 | `[midjourney-proxy]` | |
| SunoAPI | 36 | `[suno-proxy]` | |
| Kling | 50 | `[kling]` | |
| Jimeng | 51 | `[jimeng]` | |
| Anthropic / AWS | 14/33 | `[anthropic, openai]` | 原生 + 兼容 |
| Gemini / VertexAI | 24/41 | `[gemini, openai]` | 原生 + 兼容 |
| OpenRouter | 20 | `[openai]` | 仅 OpenAI 兼容 |
| xAI | 48 | `[openai, openai-response]` | |
| Sora | 55 | `[openai-video]` | |
| **default**（所有其他 40+ 渠道） | * | `[openai]` | ⚠️ 一刀切 |

### 3.2 调整后映射

| ChannelType | ID | 调整后的 EndpointTypes | 变化 |
|------------|-----|----------------------|------|
| Jina | 38 | `[jina-rerank]` | 不变 |
| Midjourney / MidjourneyPlus | 2/5 | `[midjourney-proxy]` | 不变 |
| SunoAPI | 36 | `[suno-proxy]` | 不变 |
| Kling | 50 | `[kling]` | 不变 |
| Jimeng | 51 | `[jimeng]` | 不变 |
| Anthropic / AWS | 14/33 | `[anthropic, openai-chat]` | openai → openai-chat |
| Gemini / VertexAI | 24/41 | `[gemini, openai-chat]` | openai → openai-chat |
| OpenRouter | 20 | `[openai-chat]` | openai → openai-chat |
| xAI | 48 | `[openai-chat, openai-response]` | openai → openai-chat |
| Sora | 55 | `[openai-video]` | 不变 |
| **default** | * | `[openai-chat]` | openai → openai-chat |

**额外规则**：
- 若模型名命中 `IsOpenAIResponseOnlyModel`（o3-pro, o3-deep-research, o4-mini-deep-research）→ 返回 `[openai-response]`
- 若模型名命中 `IsImageGenerationModel`（dall-e-*, gpt-image-1, flux-*, imagen-*）→ 在头部插入 `image-generation`

**走 default 的渠道**（全部返回 `[openai]`）：

| ChannelType | ID | 名称 | 实际场景 |
|------------|-----|------|---------|
| OpenAI | 1 | OpenAI | chat/embedding/tts/stt/moderation |
| Azure | 3 | Azure | chat/embedding/tts/stt |
| Ollama | 4 | Ollama | chat/embedding |
| OpenAIMax | 6 | OpenAIMax | chat |
| OhMyGPT | 7 | OhMyGPT | chat |
| Custom | 8 | Custom | 任意 |
| Baidu | 15 | 百度 | chat |
| Zhipu | 16 | 智谱 | chat |
| Ali | 17 | 阿里 | chat/embedding/image |
| Xunfei | 18 | 讯飞 | chat |
| 360 | 19 | 360 | chat |
| Tencent | 23 | 腾讯混元 | chat |
| Moonshot | 25 | Kimi | chat |
| Zhipu_v4 | 26 | 智谱V4 | chat |
| Perplexity | 27 | Perplexity | chat |
| LingYiWanWu | 31 | 零一万物 | chat |
| Cohere | 34 | Cohere | chat/embedding |
| MiniMax | 35 | MiniMax | chat |
| Dify | 37 | Dify | chat |
| Cloudflare | 39 | Cloudflare | chat |
| SiliconFlow | 40 | 硅基流动 | chat/image/embedding |
| Mistral | 42 | Mistral | chat |
| DeepSeek | 43 | DeepSeek | chat |
| MokaAI | 44 | MokaAI | chat |
| VolcEngine | 45 | 豆包/火山引擎 | chat/image |
| BaiduV2 | 46 | 百度V2 | chat |
| Xinference | 47 | Xinference | chat/embedding |
| Coze | 49 | Coze | chat |
| Vidu | 52 | Vidu | video |
| Submodel | 53 | Submodel | chat |
| DoubaoVideo | 54 | 豆包视频 | video |
| Replicate | 56 | Replicate | image/video |
| Codex | 57 | Codex | chat |
| Youchuan | 58 | 悠船 | chat |
| PixVerse | 59 | PixVerse | video |

## 4. 当前 endpointToCapabilities 映射（dto/model_capabilities.go）

| EndpointType | 映射的 capabilities | 问题 |
|-------------|--------------------|----|
| `openai` | chat, speech_to_text, text_to_speech, audio_translation, moderation | ❌ 5合1，绝大多数模型只支持 chat |
| `openai-response` | chat | ✓ |
| `openai-response-compact` | chat | ✓ |
| `anthropic` | chat | ✓ |
| `gemini` | chat | ✓ |
| `image-generation` | text_to_image, image_to_image | ✓ |
| `embeddings` | embeddings | ✓ |
| `jina-rerank` | rerank | ✓ |
| `openai-video` | video_generation | ✓ |
| `kling` | kling_video | ✓ |
| `suno-proxy` | music_generation | ✓ |
| `midjourney-proxy` | midjourney_generation | ✓ |
| `jimeng` | jimeng_image | ✓ |

## 5. capabilityDefs 静态定义（dto/model_capabilities.go）

当前所有 capability 共用固定的 endpoint/sdk_method：

| capability key | endpoint | request_format | sdk_method | async |
|---------------|----------|---------------|------------|-------|
| chat | `/v1/chat/completions` | json | `aiApi.chatCompletions` | - |
| text_to_image | `/v1/images/generations` | json | `aiApi.imageGenerations` | - |
| image_to_image | `/v1/images/edits` | multipart | `aiApi.imageEdits` | - |
| speech_to_text | `/v1/audio/transcriptions` | multipart | `aiApi.audioTranscriptions` | - |
| text_to_speech | `/v1/audio/speech` | blob_response | `aiApi.audioSpeech` | - |
| audio_translation | `/v1/audio/translations` | multipart | `aiApi.audioTranslations` | - |
| embeddings | `/v1/embeddings` | json | `aiApi.embeddings` | - |
| moderation | `/v1/moderations` | json | `aiApi.moderations` | - |
| rerank | `/v1/rerank` | json | `aiApi.rerank` | - |
| video_generation | `/v1/chat/completions` | json | `aiApi.submitTask` | true |
| kling_video | `/v1/videos/generations` | json | `aiApi.submitTask` | true |
| music_generation | `/suno/submit/{action}` | json | `aiApi.submitTask` | true |
| midjourney_generation | `/mj/submit/imagine` | json | `aiApi.submitTask` | true |
| jimeng_image | `/v1/images/generations` | json | `aiApi.imageGenerations` | true |
| realtime | `/v1/realtime` | websocket | N/A | - |

**问题**：`chat` capability 固定为 `/v1/chat/completions` + `aiApi.chatCompletions`，但 Anthropic 模型应为 `/v1/messages` + `aiApi.messages`，OpenAI Response 模型应为 `/v1/responses` + `aiApi.responses`。

## 6. 最终修复方案

### 三级优先级

```
Model.Endpoints（admin 后台配置）> 模型名检测（代码）> 渠道类型推断（代码）
```

- **Model.Endpoints** 已有 UI 和代码支持（pricing.go 206-225 行），不需要新增 DB 字段
- **模型名检测** 扩展已有的 `IsImageGenerationModel` 模式
- **渠道类型推断** 修复 `GetEndpointTypesByChannelType` + `endpointToCapabilities`

### 改动清单

#### 1. constant/endpoint_type.go — 拆分 EndpointType

新增：
```go
EndpointTypeOpenAIChat            EndpointType = "openai-chat"
EndpointTypeOpenAISTT             EndpointType = "openai-stt"
EndpointTypeOpenAITTS             EndpointType = "openai-tts"
EndpointTypeOpenAIAudioTranslation EndpointType = "openai-audio-translation"
EndpointTypeOpenAIModeration      EndpointType = "openai-moderation"
EndpointTypeVideoGeneration       EndpointType = "video-generation"
```

废弃（保留常量但不再使用）：
```go
EndpointTypeOpenAI  // "openai" → 替换为 "openai-chat"
```

#### 2. common/endpoint_type.go — 修复 GetEndpointTypesByChannelType

补充视频渠道 case：
```go
case constant.ChannelTypeVidu, constant.ChannelTypeDoubaoVideo,
     constant.ChannelTypePixVerse, constant.ChannelTypeReplicate:
    endpointTypes = []constant.EndpointType{constant.EndpointTypeVideoGeneration}
```

修改 default 分支（加入模型名检测）：
```go
default:
    if IsOpenAIResponseOnlyModel(modelName) {
        endpointTypes = []constant.EndpointType{EndpointTypeOpenAIResponse}
    } else if IsSTTModel(modelName) {
        endpointTypes = []constant.EndpointType{EndpointTypeOpenAISTT}
    } else if IsTTSModel(modelName) {
        endpointTypes = []constant.EndpointType{EndpointTypeOpenAITTS}
    } else if IsEmbeddingModel(modelName) {
        endpointTypes = []constant.EndpointType{EndpointTypeEmbeddings}
    } else if IsModerationModel(modelName) {
        endpointTypes = []constant.EndpointType{EndpointTypeOpenAIModeration}
    } else {
        endpointTypes = []constant.EndpointType{EndpointTypeOpenAIChat}
    }
```

所有现有 case 中 `EndpointTypeOpenAI` → `EndpointTypeOpenAIChat`。

#### 3. common/model.go — 新增模型名检测函数

```go
func IsSTTModel(name string) bool
func IsTTSModel(name string) bool
func IsEmbeddingModel(name string) bool
func IsModerationModel(name string) bool
```

#### 4. common/endpoint_defaults.go — 补充新 EndpointType 的默认路径

```go
EndpointTypeOpenAIChat:             {Path: "/v1/chat/completions", Method: "POST"},
EndpointTypeOpenAISTT:              {Path: "/v1/audio/transcriptions", Method: "POST"},
EndpointTypeOpenAITTS:              {Path: "/v1/audio/speech", Method: "POST"},
EndpointTypeOpenAIAudioTranslation: {Path: "/v1/audio/translations", Method: "POST"},
EndpointTypeOpenAIModeration:       {Path: "/v1/moderations", Method: "POST"},
EndpointTypeVideoGeneration:        {Path: "/v1/videos/generations", Method: "POST"},
```

#### 5. dto/model_capabilities.go — 重构 capabilities 构建

将 `capabilityDefs` 改为按 EndpointType 定义（chat 按协议区分 endpoint/sdk_method）：

| EndpointType | capability | endpoint | sdk_method |
|-------------|-----------|----------|------------|
| openai-chat | chat | /v1/chat/completions | aiApi.chatCompletions |
| openai-response | chat | /v1/responses | aiApi.responses |
| anthropic | chat | /v1/messages | aiApi.messages |
| gemini | chat | /v1/chat/completions | aiApi.chatCompletions |
| openai-stt | speech_to_text | /v1/audio/transcriptions | aiApi.audioTranscriptions |
| openai-tts | text_to_speech | /v1/audio/speech | aiApi.audioSpeech |
| openai-audio-translation | audio_translation | /v1/audio/translations | aiApi.audioTranslations |
| openai-moderation | moderation | /v1/moderations | aiApi.moderations |
| video-generation | video_generation | /v1/videos/generations | aiApi.submitTask (async) |
| 其余 | 保持不变 | | |

`endpointToCapabilities` 每个 EndpointType 严格 1:1 映射（图片类 1:2 保持）。

#### 6. api-sdk — 同步更新

`ENDPOINT_TYPE_TO_CAPABILITIES` 映射同步 `openai` → `openai-chat`，新增类型。
`inferCapabilities()` 适配新的 EndpointType。

#### 7. relay 路由检查

确认 relay 内部路由不依赖 `"openai"` 字符串做 EndpointType 匹配。
如有依赖，同步替换为 `"openai-chat"`。

### 不需要做的事

- ❌ 不新增 DB 字段 — `Model.Endpoints` 已覆盖 admin 覆盖需求
- ❌ 不改 admin 后台 UI — 现有键值对编辑器足够
- ❌ 不为每个视频 provider 单独建 EndpointType — 通用 `video-generation` 足够

## 7. 问题总结（原始问题保留）

### 问题 A：openai 映射过宽

`endpointToCapabilities["openai"]` 包含 5 个能力，但绝大多数 openai 类型模型只支持 chat。

**影响**：gpt-5.4 等纯 chat 模型返回了 speech_to_text、text_to_speech 等错误能力。

### 问题 B：chat capability 无协议差异

`capabilityDefs["chat"]` 固定为 `/v1/chat/completions`，但不同协议有不同端点：

| 协议 | 实际端点 | 实际 SDK 方法 | 当前返回 |
|------|---------|-------------|---------|
| openai | `/v1/chat/completions` | `aiApi.chatCompletions` | ✓ 正确 |
| anthropic | `/v1/messages` | `aiApi.messages` | ❌ 返回 /v1/chat/completions |
| openai-response | `/v1/responses` | `aiApi.responses` | ❌ 返回 /v1/chat/completions |
| gemini | `/v1/chat/completions`（代理） | `aiApi.chatCompletions` | ✓ 正确 |

### 问题 C：default 渠道一刀切

40+ 渠道走 default 全返回 `[openai]`，但其中包含：
- 视频渠道：Vidu(52)、DoubaoVideo(54)、PixVerse(59)
- 图片/混合渠道：SiliconFlow(40)、VolcEngine(45)、Ali(17)、Replicate(56)
- Embedding 渠道：部分模型走 OpenAI/Ollama/Cohere 但只做 embedding

这些模型在 default 分支下全被标记为 chat，实际能力完全不对。

### 问题 D：模型名匹配覆盖不足

当前已有的模型名匹配：
- `IsImageGenerationModel`：dall-e-3, dall-e-2, gpt-image-1, flux-*, imagen-*
- `IsOpenAIResponseOnlyModel`：o3-pro, o3-deep-research, o4-mini-deep-research

**未覆盖**：doubao-seedream-*、whisper-*、tts-*、text-embedding-*、omni-moderation-* 等。
