---
name: newapi-model-onboarding
description: |
  New-API 模型接入编排与防回归规范。
  用于新增或更新渠道模型时，统一完成渠道绑定、模型能力(capabilities)、参数(parameters)、价格(prices)与验收闭环。
  当任务涉及上游模型拉取、参数验证、models.endpoints、abilities、prices、/v1/models 返回对齐、provider_style/path/method 配置、enum 参数治理、文本模型多端点配置、claude_messages/openai_response/text_completion 扩展端点、capability key 扩展、api-sdk 契约对齐时使用。
---

# New-API 模型接入编排

## 目标

将“新增模型”从临时操作改为标准流程，避免以下问题再次出现：

- 数据库配置正确，但 `/v1/models` 返回降级
- `enum` 被错误降级为 `scalar`
- 只写描述不写结构化参数，导致 SDK 侧靠猜
- `path`/`method`/`provider_style` 配置漂移
- 模型能力与渠道能力不一致
- 文本模型实际支持多个端点，但只配置了一个端点
- 首次插入报 `models_id_seq` 主键冲突

## 标准 8 步流程（强制）

严格按以下顺序执行，不跳步：

1. 收集上游配置
2. 分析上游可用模型
3. 收集模型可用参数
4. 验证参数
5. 配置渠道 SQL
6. 配置模型 SQL 和参数 SQL
7. 配置价格 SQL
8. 验收整体 `/v1/models` 逻辑

每步都要产出可复用证据（SQL、命令、返回片段）。

## 快速入口（默认执行）

当用户说“接入模型/渠道/价格”时，按下列路径执行：

1. 使用 [references/model-onboarding-input.md](references/model-onboarding-input.md) 收集输入
2. 使用 [references/workflow-8-steps.md](references/workflow-8-steps.md) 执行 8 步流程
3. 使用 [references/model-json-template.md](references/model-json-template.md) 生成 endpoints JSON
4. 使用 [references/sql-playbook.md](references/sql-playbook.md) 执行 SQL
5. 使用 [references/refresh-runtime-cache.md](references/refresh-runtime-cache.md) 刷新缓存
6. 使用 [references/acceptance-checklist.md](references/acceptance-checklist.md) 验收

## 1) 收集上游配置

至少收集：

- `base_url`
- 鉴权方式与 Key 位置
- 上游可用端点路径与 method
- 上游返回风格（OpenAI 兼容 / 供应商特有）
- 渠道类型（`channel_type`）

未知配置不入库，先补齐。

## 2) 分析上游可用模型

- 调用上游模型列表接口（如 `/v1/models`）
- 对照渠道文档/价格页确认模型 ID
- 标记“可接入 / 待验证 / 不建议接入”

结果必须产出模型清单。

## 3) 收集模型可用参数

- 从上游文档与真实响应收集参数
- 拆分必填/可选、类型、默认值、枚举范围
- 视频模型重点确认：`duration/seconds`、参考图参数（`image_url`、`input_reference`）

结果必须产出结构化参数表。

## 4) 验证参数

- 最小参数用例验证
- 边界参数用例验证（尤其枚举、必填、互斥/组合约束）
- 对失败请求记录错误文本，反推参数约束

约束：

- 不允许只写“描述支持”，必须写结构化 schema
- 验证后才能写入 `endpoints`

## 5) 配置渠道 SQL

- 先校验/创建 `channels`
- 确认 `channel_type`、`base_url`、`models` 映射
- 绑定 `abilities`（`group + model + channel_id`）

模板见 [references/sql-playbook.md](references/sql-playbook.md)。

## 6) 配置模型 SQL 和参数 SQL

### 6.1 capability 必填字段

每个能力都必须包含：

- `supported`
- `path`
- `method`
- `provider_style`
- `async`
- `request_format`
- `sdk_method`
- `parameters`

### 6.2 参数 schema 强约束（防降级）

- `kind=scalar`：不能带 `options`
- `kind=enum`：必须带 `options`
- `options` 必须是字符串数组（即使 `value_type=integer` 也用 `"5"`、`"10"`）
- `default` 必须落在 `options` 内

### 6.3 防错规则

- 绝不使用 `endpoint` 字段，统一使用 `path + method`
- `provider_style` 必须与能力一致，且**只能从下列固定集合选取**（与 new-api/setting/model_capability 和 api-sdk 的 `ModelProviderStyle` 联合类型对齐，禁止自造）：
  - 文本（可 Provider）：`openai-chat` / `openai-completion` / `openai-response` / `anthropic` -- 属于 `TextModelProviderStyle`，可通过 `createAiGatewayProvider()` 路由
  - 图像（仅 aiApi）：`openai-image`
  - 音频（仅 aiApi）：`openai-stt` / `openai-tts` / `openai-audio-translation`
  - 视频（仅 aiApi）：`openai-video`
  - 其他（仅 aiApi）：`openai-embeddings` / `openai-moderation` / `openai-realtime` / `suno` / `midjourney` / `jina`
- 图生视频若上游要求双参（如 `image_url + input_reference`）必须同时标记 `required`
- 文本模型若支持多个端点（如 OpenAI Chat + Anthropic Messages + OpenAI Responses），必须全部写入 `capabilities`，不能只保留一个
- 多文本端点模型必须显式维护”主端点”和”扩展端点”：
  - 主端点：`chat`（供默认 SDK 路由，走 `/v1/chat/completions`）
  - 扩展端点：使用下列**与 api-sdk 契约对齐**的 capability key，不得自造：
    - `claude_messages` → Anthropic 原生 `/v1/messages` 协议（`provider_style: anthropic`，`sdk_method: aiApi.messages`）
    - `openai_response` → OpenAI Responses API `/v1/responses`（`provider_style: openai-response`，`sdk_method: aiApi.responses`）
    - `text_completion` → OpenAI 传统 `/v1/completions`（`provider_style: openai-completion`，`sdk_method: aiApi.completions`）

### 6.4 SDK 契约对齐（强制）

**Go 端 capability key 必须与 SDK 的 `ModelCapabilityKey` 联合类型完全一致**，否则 `invokeModelCapability(model, 'xxx', input)` 会抛 `capability_schema_not_found`。

对齐矩阵：

| Go 端 (new-api) | SDK 端 (api-sdk) | 对应 endpoint | sdk_method |
|----|----|----|----|
| `capabilitySpecsFromEndpointType` 的 case 名 | `types.ts:ModelCapabilityKey` 联合成员 | `AI_ENDPOINT_PATHS` 常量 | `DISPATCH_HANDLERS` 条目 |
| `chat` | `'chat'` | `CHAT_COMPLETIONS` | `aiApi.chatCompletions` |
| `claude_messages` | `'claude_messages'` | `MESSAGES` | `aiApi.messages` |
| `openai_response` | `'openai_response'` | `RESPONSES` | `aiApi.responses` |
| `text_completion` | `'text_completion'` | `COMPLETIONS` | `aiApi.completions` |

**新增 capability key 必须同一 PR 里改两边**：

1. `hexonal-project/new-api/dto/model_capability_schema.go` 的 `capabilitySpecsFromEndpointType` / `inferSDKMethod` / `inferProviderStyle`
2. `hexonal-project/api-sdk/src/ai-gateway/types.ts` 的 `ModelCapabilityKey` 联合类型 + `CAPABILITY_ENDPOINT_MAP` 条目
3. `hexonal-project/api-sdk/src/ai-gateway/capability-dispatch.ts` 的 `SyncCapabilityTransport` 字段 + `CapabilityDispatchKey` 联合类型 + `DISPATCH_HANDLERS` / `SDK_METHOD_TO_DISPATCH` / `PATH_TO_DISPATCH` 条目
4. 前两项改完后跑 `go build ./...` 和 `npx tsc --noEmit` 两边都通过，才算完成
5. 若为文本类 capability，确认 `provider_style` 属于 `TextModelProviderStyle`（`openai-chat`/`openai-completion`/`openai-response`/`anthropic`），否则 `createAiGatewayProvider` 无法路由

### 6.5 模型级特性标记配置（强制）

模型级特性标记（`reasoning`、`function_calling`）**不是自动推导的**，必须由管理员在系统设置中显式配置对应的 Option，否则 `/v1/models` 返回的特性值始终为 `false`。

#### 配置位置

系统设置 → Option 配置（`options` 表），通过管理后台或 API 写入。

#### Option 定义

| Option Key | 用途 | 值格式 |
|------------|------|--------|
| `ModelReasoningMap` | 标记哪些模型支持推理/思考链 | JSON `map[string]bool` |
| `ModelFunctionCallingMap` | 标记哪些模型支持 function/tool calling | JSON `map[string]bool` |

#### 值格式规范

```json
{
  "model-name-lowercase": true,
  "another-model": true
}
```

- **key 必须是模型名的小写形式**（查询时会自动 `ToLower` 匹配）
- **value 只接受 `bool` 类型**，非 bool 值会被静默跳过
- **只需要写 `true` 的模型**，不支持的模型不需要写 `false`（不在 map 中 = 不支持）
- **空字符串或 `{}`** = 没有模型支持该特性

#### 判定标准

配置前必须确认模型**确实支持**对应特性，不能随意标记：

| 特性 | 判定依据 |
|------|---------|
| `reasoning` | 模型支持 CoT/思考链输出（如 `o1`、`o3`、`claude-3.5-sonnet` 的 extended thinking、`deepseek-r1`） |
| `function_calling` | 模型支持在请求中传入 `tools`/`functions` 参数并在响应中返回 `tool_calls`（需上游文档明确支持或实测验证） |

**禁止**：
- 未经验证就标记 `true`
- 把纯文本模型标记为支持 `function_calling`
- 把不支持推理的模型标记为 `reasoning`

#### 配置示例

```json
// ModelReasoningMap
{"o1": true, "o1-mini": true, "o3": true, "o3-mini": true, "deepseek-r1": true}

// ModelFunctionCallingMap
{"gpt-4o": true, "gpt-4o-mini": true, "gpt-4.1": true, "claude-sonnet-4-20250514": true, "claude-3.5-sonnet": true}
```

#### 生效机制

- Option 写入后，调用 `POST /api/option/refresh_pricing_cache` 即可热生效（无需重启）
- `/v1/models` 响应中的 `reasoning` 和 `function_calling` 字段会立即反映新配置

## 7) 配置价格 SQL

- 在 `prices` 写入 `model + type + channel_type + input + output`
- `type` 只允许 `tokens` 或 `times`
- 价格来源需要可追溯（文档/页面/实测）

## 8) 验收整体 /v1/models 逻辑

### 8.1 先刷新缓存（优先）

- 先用 MCP 查询 root sk（禁止手填/猜测）
- 再调用 `POST /api/option/refresh_pricing_cache`
- 不默认重启服务
- 仅在刷新失败或用户明确要求时重启兜底

### 8.2 验收点

- `/v1/models` 的 `supported_endpoint_types` 正确
- `capabilities.*` 中 `path/method/provider_style/request_format/sdk_method` 不为空
- 预期枚举参数保持 `kind=enum`，未降级
- DB 与 `/v1/models` 一致
- 文本模型若声明多端点，`/v1/models` 必须看到全部能力 key（包括扩展端点如 `claude_messages` / `openai_response`）
- `models_id_seq`、`channels_id_seq` 与表内 `MAX(id)` 无漂移
- 模型级特性标记正确：`reasoning`、`function_calling` 与 `ModelReasoningMap`、`ModelFunctionCallingMap` Option 一致

### 8.3 功能验收

- 文生图：`/v1/images/generations`
- 图生图：`/v1/images/edits`
- 文生视频/图生视频：`/v1/videos` 提交 + 轮询任务状态
- 失败必须回查 `tasks.fail_reason` 并修正 schema

## 参考资料

- 输入收集模板：[references/model-onboarding-input.md](references/model-onboarding-input.md)
- 8 步工作流模板：[references/workflow-8-steps.md](references/workflow-8-steps.md)
- endpoints 模板库：[references/model-json-template.md](references/model-json-template.md)
- SQL 操作模板：[references/sql-playbook.md](references/sql-playbook.md)
- 缓存刷新接口：[references/refresh-runtime-cache.md](references/refresh-runtime-cache.md)
- 验收清单与命令：[references/acceptance-checklist.md](references/acceptance-checklist.md)

## 交付清单（固定输出）

1. 上游配置摘要
2. 上游模型清单（可接入/待验证/不建议）
3. 参数验证结论
4. 渠道 SQL 结果
5. 模型与参数 SQL 结果
6. 价格 SQL 结果
7. `/v1/models` 核对结论
8. 功能验收结果（含任务 ID）
