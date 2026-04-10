# Model Capabilities 精确化设计

> 日期：2026-04-10
> 状态：草稿
> 涉及项目：new-api（Go 后端）、api-sdk（TypeScript）、前端应用

## 1. 问题

`/v1/models` 返回的 capabilities 不精确。根因：

1. `endpointToCapabilities` 把 `openai` 映射成 5 个能力（chat + TTS + STT + moderation + audio_translation），但大多数模型只支持 chat
2. `capabilityDefs` 是全局固定的，不同协议的相同能力（如 chat）使用了相同的 endpoint/sdk_method
3. 走 default 渠道的特殊模型（embedding、TTS、图片）被错误标记为 chat

## 2. 当前数据流

```
abilities 表 (model + channel_type)
    ↓
GetEndpointTypesByChannelType(channelType, modelName)
    ↓ default: → [EndpointTypeOpenAI]
    ↓
endpointToCapabilities[EndpointTypeOpenAI]
    = {"chat", "speech_to_text", "text_to_speech", "audio_translation", "moderation"}
    ↓
/v1/models 返回所有 5 个 capabilities（不精确）
```

## 3. 设计方案：两层修复

### 第 1 层：endpointToCapabilities 精确化（代码改动）

每个 EndpointType 只映射自己真正代表的能力，且 capability 定义按 EndpointType 区分（不共享全局 capabilityDefs）。

#### Chat 类

| EndpointType | capability key | endpoint | sdk_method |
|-------------|---------------|----------|------------|
| `openai` | chat | `/v1/chat/completions` | `aiApi.chatCompletions` |
| `openai-response` | chat | `/v1/responses` | `aiApi.responses` |
| `openai-response-compact` | chat | `/v1/responses` | `aiApi.responses` |
| `anthropic` | chat | `/v1/messages` | `aiApi.messages` |
| `gemini` | chat | `/v1/chat/completions` | `aiApi.chatCompletions` |

#### 图片类

| EndpointType | capability key | endpoint | sdk_method |
|-------------|---------------|----------|------------|
| `image-generation` | text_to_image | `/v1/images/generations` | `aiApi.imageGenerations` |
| `image-generation` | image_to_image | `/v1/images/edits` | `aiApi.imageEdits` |
| `jimeng` | jimeng_image | `/v1/images/generations` | `aiApi.imageGenerations` |

#### 视频类

| EndpointType | capability key | endpoint | sdk_method | async |
|-------------|---------------|----------|------------|-------|
| `openai-video` | video_generation | `/v1/chat/completions` | `aiApi.submitTask` | true |
| `kling` | kling_video | `/v1/videos/generations` | `aiApi.submitTask` | true |

#### 音频类（从 openai 中拆出，需新增 EndpointType 或 DB 覆盖）

| 能力 | endpoint | sdk_method |
|------|----------|------------|
| speech_to_text | `/v1/audio/transcriptions` | `aiApi.audioTranscriptions` |
| text_to_speech | `/v1/audio/speech` | `aiApi.audioSpeech` |
| audio_translation | `/v1/audio/translations` | `aiApi.audioTranslations` |

#### 其他

| EndpointType | capability key | endpoint | sdk_method |
|-------------|---------------|----------|------------|
| `embeddings` | embeddings | `/v1/embeddings` | `aiApi.embeddings` |
| `jina-rerank` | rerank | `/v1/rerank` | `aiApi.rerank` |
| `suno-proxy` | music_generation | `/suno/submit/{action}` | `aiApi.submitTask` |
| `midjourney-proxy` | midjourney_generation | `/mj/submit/imagine` | `aiApi.submitTask` |

### 第 2 层：models 表 capabilities 字段（DB 覆盖）

解决 EndpointType 推断不了的模型。新增 `capabilities` TEXT 字段存 JSON。

**优先级：DB capabilities > EndpointType 推断**

#### 需要 DB 覆盖的模型（走 default 渠道但不是 chat）

| 模型 | 走 default 渠道 | 推断结果（错误） | DB capabilities 覆盖（正确） |
|------|----------------|-----------------|---------------------------|
| doubao-seedream-4-5 | openai → chat ❌ | `{"text_to_image": true}` |
| doubao-seedream-4-0 | openai → chat ❌ | `{"text_to_image": true}` |
| whisper-1 | openai → chat ❌ | `{"speech_to_text": true}` |
| tts-1 | openai → chat ❌ | `{"text_to_speech": true}` |
| tts-1-hd | openai → chat ❌ | `{"text_to_speech": true}` |
| text-embedding-3-small | openai → chat ❌ | `{"embeddings": true}` |
| text-embedding-3-large | openai → chat ❌ | `{"embeddings": true}` |
| omni-moderation-latest | openai → chat ❌ | `{"moderation": true}` |

#### 不需要 DB 覆盖的模型（EndpointType 推断正确）

| 模型 | 渠道类型 | EndpointTypes | 推断结果 |
|------|---------|--------------|---------|
| gpt-5.4 | openai (default) | `[openai]` | chat ✓ |
| gpt-5 | openai (default) | `[openai]` | chat ✓ |
| claude-* | anthropic | `[anthropic, openai]` | chat ✓（原生 /v1/messages） |
| gemini-* | gemini | `[gemini, openai]` | chat ✓ |
| grok-3 | xai | `[openai, openai-response]` | chat ✓ |
| jimeng-4.5 | jimeng | `[jimeng]` | jimeng_image ✓ |
| sora-2 | sora | `[openai-video]` | video_generation ✓ |
| jina-* | jina | `[jina-rerank]` | rerank ✓ |

## 4. 完整模型 Capabilities 对照表

以下是系统中 29 个模型的完整 capabilities 预期：

| 模型 | 渠道 | capabilities | 数据来源 |
|------|------|-------------|---------|
| gpt-5.4 | openai | `{chat}` | EndpointType 推断 |
| gpt-5.3-codex | openai | `{chat}` | EndpointType 推断 |
| gpt-5.2-codex | openai | `{chat}` | EndpointType 推断 |
| gpt-5.2 | openai | `{chat}` | EndpointType 推断 |
| gpt-5.1-codex | openai | `{chat}` | EndpointType 推断 |
| gpt-5.1-codex-mini | openai | `{chat}` | EndpointType 推断 |
| gpt-5.1-codex-max | openai | `{chat}` | EndpointType 推断 |
| gpt-5.1 | openai | `{chat}` | EndpointType 推断 |
| gpt-5 | openai | `{chat}` | EndpointType 推断 |
| gpt-5-codex | openai | `{chat}` | EndpointType 推断 |
| gpt-5-codex-mini | openai | `{chat}` | EndpointType 推断 |
| grok-4.1-expert | xai | `{chat}` | EndpointType 推断 |
| grok-4.1-thinking | xai | `{chat}` | EndpointType 推断 |
| grok-4.1-mini | xai | `{chat}` | EndpointType 推断 |
| grok-4-thinking | xai | `{chat}` | EndpointType 推断 |
| grok-4 | xai | `{chat}` | EndpointType 推断 |
| grok-3 | xai | `{chat}` | EndpointType 推断 |
| grok-3-thinking | xai | `{chat}` | EndpointType 推断 |
| grok-3-mini | xai | `{chat}` | EndpointType 推断 |
| gemini-3.1-pro-preview | gemini | `{chat}` | EndpointType 推断 |
| gemini-3-pro-preview | gemini | `{chat}` | EndpointType 推断 |
| gemini-3-flash-preview | gemini | `{chat}` | EndpointType 推断 |
| gemini-2.5-pro | gemini | `{chat}` | EndpointType 推断 |
| jimeng-4.5 | jimeng | `{text_to_image, image_to_image}` | EndpointType 推断 |
| jimeng-4.1 | jimeng | `{text_to_image, image_to_image}` | EndpointType 推断 |
| jimeng-4.0 | jimeng | `{text_to_image, image_to_image}` | EndpointType 推断 |
| sora-2 | sora | `{video_generation}` | EndpointType 推断 |
| doubao-seedream-4-5-251128 | default | `{text_to_image}` | **DB 覆盖** |
| doubao-seedream-4-0-250828 | default | `{text_to_image}` | **DB 覆盖** |

## 5. Chat Capability 的协议差异

同样是 `chat` capability，不同 EndpointType 对应不同的端点和 SDK 方法：

| 模型来源 | EndpointType（优先） | chat.endpoint | chat.sdk_method |
|---------|---------------------|--------------|-----------------|
| OpenAI (GPT) | openai | `/v1/chat/completions` | `aiApi.chatCompletions` |
| OpenAI (Response API) | openai-response | `/v1/responses` | `aiApi.responses` |
| Anthropic (Claude) | anthropic | `/v1/messages` | `aiApi.messages` |
| Google (Gemini) | gemini | `/v1/chat/completions` | `aiApi.chatCompletions` |
| xAI (Grok) | openai | `/v1/chat/completions` | `aiApi.chatCompletions` |
| 其他 OpenAI 兼容 | openai | `/v1/chat/completions` | `aiApi.chatCompletions` |

当一个模型有多个 EndpointType 时（如 Claude: `[anthropic, openai]`），capabilities 使用**第一个（原生协议）** 的定义。`supported_endpoint_types` 完整列出所有可用协议，前端可据此选择调用方式。

## 6. 实现改动清单

### 后端（new-api）

1. **`dto/model_capabilities.go`**
   - 重构 `endpointToCapabilities`：每个 EndpointType 只映射真实能力
   - 重构 `capabilityDefs` → 改为按 EndpointType 定义，不同协议的 chat 有不同 endpoint/sdk
   - 修改 `BuildModelCapabilities`：优先使用第一个 EndpointType 的定义

2. **`model/model_meta.go`**
   - models 表新增 `capabilities` TEXT 字段（JSON）

3. **`model/pricing.go`**
   - `updatePricing` 中读取 `model.capabilities`，有值时覆盖 EndpointType 推断

4. **`controller/model.go`**
   - `ListModels` 中：DB capabilities > EndpointType 推断

5. **Admin 后台**
   - 模型配置页新增 capabilities 多选控件

### 前端（api-sdk）

- `ModelCapabilities` 类型已就绪，无需改动
- `inferCapabilities()` 已处理有/无 capabilities 两种情况

### 数据库迁移

- `ALTER TABLE models ADD COLUMN capabilities TEXT DEFAULT ''`
- 对 `doubao-seedream-*` 等模型初始化 capabilities 数据

## 7. 向后兼容

- DB `capabilities` 为空时完全走现有 EndpointType 推断（降级）
- 现有 chat 模型的行为不变（`openai → chat` 依然正确）
- `supported_endpoint_types` 字段不变
- 前端无需改动即可受益于更精确的 capabilities
