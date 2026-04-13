# 模型接入输入模板

新增模型前，先补齐以下输入，缺项不落库。

## A. 基础信息

- `model_name`:
- `vendor_name`:
- `channel_name`:
- `channel_type`:
- `base_url`:

## B. 能力与端点

逐能力填写。`capability_key` **只能从下列固定白名单选取**（与 api-sdk 的 `ModelCapabilityKey` 联合类型和 new-api 的 `capabilitySpecsFromEndpointType` 对齐，禁止自造）：

- 文本生成：`chat` / `text_completion` / `openai_response` / `claude_messages`
- 音频：`speech_to_text` / `text_to_speech` / `audio_translation`
- 图像：`text_to_image` / `image_to_image`
- 视频：`text_to_video` / `image_to_video`
- 其他：`embeddings` / `moderation` / `rerank`
- 特殊协议（不走 `invokeModelCapability`）：`realtime`（WebSocket）/ `music_generation`（Suno 异步）/ `midjourney_generation`（MJ 异步）

填写字段：

- `capability_key`:（必须来自上述白名单）
- `path`:
- `method`:
- `provider_style`:（只能来自 SKILL.md 6.3 节列出的固定集合）
- `async`:
- `request_format`:（`json` / `multipart` / `blob_response` / `websocket` 四选一）
- `sdk_method`:（形如 `aiApi.<methodName>`，必须与 api-sdk 的 `CapabilityTransport` 方法名一致）

## C. 参数定义

逐参数填写：

- `name`:
- `required`:
- `default`:
- `description`:
- `schema.kind`:
- `schema.value_type`:
- `schema.options`（若 enum，必须字符串数组）:

## D. 价格配置

- `price_type`（tokens / times）:
- `input_price`:
- `output_price`:
- `extra_ratios`（可选）:

## E. 模型级特性标记

逐项确认，**必须有上游文档或实测依据**，不能随意标记：

- `reasoning`（是否推理模型）:
  - 判定依据（文档链接/实测结果）:
- `function_calling`（是否支持 tool/function calling）:
  - 判定依据（文档链接/实测结果）:

> 详细配置规范见 SKILL.md §6.5。配置方式：系统设置 Option `ModelReasoningMap` / `ModelFunctionCallingMap`，值为 JSON `{"model-name-lowercase": true}`。未经验证不得标记为 `true`。

## F. 验收目标

- `/v1/models` 期望 `supported_endpoint_types`:
- `/v1/models` 期望特性标记（`reasoning` / `function_calling`）:
- 期望枚举参数列表:
- 最少功能验收用例:
