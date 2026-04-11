# 8 步工作流详细版

> 与 SKILL.md 第 23-34 行的"标准 8 步流程"对齐，但扩展了**每步的输入/输出/常见错误**。SKILL.md 是总纲，本文件是执行手册。

## Step 1 收集上游配置

**输入**：上游供应商文档 / 价格页 / 联系人提供的参数

**要点**：

- Base URL（含协议与端口）
- Auth 方式：`Authorization: Bearer` / `api-key: xxx` / query string / 自定义 header
- 端点路径与 Method（逐一列出）
- Channel Type（对照 `new-api/constant/endpoint_type.go` 选择）
- 返回协议风格：OpenAI 兼容 / Anthropic / Gemini / 自研

**产出**：一个 "上游配置摘要" markdown 表格

**常见错误**：

- 只收集了 base_url 就动手——结果 key 传错 header 位置
- 误把"兼容 OpenAI"当作"100% 兼容"——实际可能只支持 chat 不支持 tools

## Step 2 分析上游可用模型

**输入**：Step 1 的 base_url + token

**要点**：

- 调上游 `/v1/models`（或供应商专属列表接口）
- 过滤别名（很多供应商返回 `model-latest` / `model-20240101` 多个别名指向同一模型）
- 标记每个模型的状态：`可接入 / 待验证 / 不建议接入`
- 不建议接入的原因要写清楚（例：文档缺失、价格未公开、上游限速过严）

**产出**：模型清单表格，每行 `id | 别名 | 状态 | 备注`

**常见错误**：

- 盲目接入所有别名——导致同一个物理模型有 3-5 条 `models` 记录，价格计算分裂
- 不做状态标记——后续审计时无法知道为什么某个模型没跑通

## Step 3 收集模型可用参数

**输入**：Step 2 的可接入模型清单

**要点**：

- 从上游文档与真实响应收集参数
- 每个参数拆分：`必填 / 可选 / 类型 / 默认值 / 枚举范围`
- 视频模型重点确认：`duration` / `seconds` / `image_url` / `input_reference` / `character_url` / `character_timestamps`
- 图像模型重点确认：`size` / `n` / `response_format` / `quality`
- 音频模型重点确认：`voice` / `response_format` / `speed` / `language`

**产出**：结构化参数表（对应 SKILL.md 的"输入收集模板 C 段"）

**常见错误**：

- 只写"描述支持 size 参数"而不写具体枚举值——后续无法做 schema 校验
- 把"上游接受但实际会被降级"的参数当成一级支持

## Step 4 验证参数

**输入**：Step 3 的参数表

**要点**：

- **最小用例**：只传必填参数，验证能返回成功结果
- **边界用例**：
  - 枚举参数传非法值 → 应该拿到 400 + 明确错误信息
  - 必填参数不传 → 应该拿到 400
  - 可选参数极值（`n=0` / `n=100` / 超长 prompt）
- **错误文本回收**：对每个失败请求，把错误文本记录下来作为 schema 的反向约束依据

**产出**：参数验证结论（每个参数注明"已验证 / 未验证 / 已知陷阱"）

**约束**：

- 不允许只写"描述支持"，必须写结构化 schema
- 验证后才能写入 `endpoints`

**常见错误**：

- 跳过边界验证——上线后用户传边界值触发上游 500
- 未记录错误文本——schema 写得过宽

## Step 5 配置渠道 SQL

**输入**：Step 1 的 Channel Type + Step 2 的模型清单

**要点**：

- 先 `SELECT` 确认 `channels` 是否已存在
- 若不存在则 `INSERT`，注意 `channels_id_seq` 的 max(id) 漂移（见 sql-playbook.md §2）
- 配置 `channel_type` / `base_url` / `models` 映射
- 在 `abilities` 表绑定 `group + model + channel_id`（一条 ability 对应一个组能访问一个 channel 的一个模型）

**产出**：`channels` / `abilities` 的 SQL 执行回执

**常见错误**：

- 忘记 setval 导致首次插入报 `duplicate key value violates unique constraint "channels_pkey"`
- `abilities.group` 写错导致某些用户组看不到新模型

## Step 6 配置模型 SQL 和参数 SQL

**输入**：Step 3/4 的参数结构 + Step 5 的 channel_id

**要点**：

- 每个能力必须填完 `supported / path / method / provider_style / async / request_format / sdk_method / parameters` **8 个字段**（见 SKILL.md §6.1）
- 参数 schema 遵守"强约束"（见 SKILL.md §6.2）：
  - `kind=scalar` 不能带 `options`
  - `kind=enum` 必须带 `options`（字符串数组）
  - `default` 落在 `options` 内
- `capability_key` 只能从 SKILL.md §6.3 的白名单选取
- 对齐 SDK（见 SKILL.md §6.4）：任何新增 capability key 同 PR 改 api-sdk 两端

**产出**：`models` 表的 `endpoints` JSON（参考 `model-json-template.md` 的模板）

**常见错误**：

- `kind=enum` 忘填 `options` → 被 new-api 降级为 `scalar` → SDK 拿到后无法做值校验
- `default` 不在 `options` 里 → `/v1/models` 序列化时会丢 default
- 把 Anthropic messages 端点写成 `sdk_method: aiApi.chatCompletions` → 协议错配运行时炸

## Step 7 配置价格 SQL

**输入**：上游价格页 / Step 2 的模型清单

**要点**：

- `prices` 表写入 `model + type + channel_type + input + output`
- `type` 只允许 `tokens` 或 `times`
  - `tokens`：按 input/output token 数计费（chat/embeddings 常见）
  - `times`：按调用次数计费（image/video/audio 常见）
- 价格来源必须可追溯：标注出处 URL / 截图日期 / 实测记录
- 多币种要统一成 CNY 或 USD（和 new-api 的 billing 规则一致）

**产出**：`prices` 表的 SQL 执行回执

**常见错误**：

- 混用 `tokens` 和 `times` 类型 → 同一个 model 的账单计算漂移
- 只写 input 不写 output → output 按 0 计费，公司亏钱
- 价格未标注来源 → 上游涨价后无法快速定位

## Step 8 验收整体 /v1/models 逻辑

**输入**：前 7 步产出

**子步骤**（严格按顺序）：

### 8.1 刷新缓存（优先）

- 先用 MCP 查询 root sk（**不要手填/截屏/粘贴到长上下文**，见 `refresh-runtime-cache.md` 安全警告）
- 调 `POST /api/option/refresh_pricing_cache`
- 不默认重启服务
- 仅在刷新失败或用户明确要求时重启兜底

### 8.2 校验返回结构

- `/v1/models` 的 `supported_endpoint_types` 正确
- `capabilities.*` 中 `path/method/provider_style/request_format/sdk_method` 均非空
- 预期枚举参数保持 `kind=enum`，未降级为 `scalar`
- DB 与 `/v1/models` 一致（用 jq 对比两边）
- 文本模型若声明多端点，必须看到全部 capability key（`chat` + 扩展端点如 `claude_messages` / `openai_response`）
- `models_id_seq` / `channels_id_seq` 与表内 `MAX(id)` 无漂移

### 8.3 功能验收

- 文生图：`/v1/images/generations` 提交成功，返回 URL 可访问
- 图生图：`/v1/images/edits` 提交成功
- 文生视频/图生视频：`/v1/videos` 提交 + 轮询任务状态到终态
- 失败必须回查 `tasks.fail_reason` 并修正 schema

**产出**：完整的 8 项"交付清单"（见 SKILL.md 末尾）

**常见错误**：

- 跳过 8.2 直接做 8.3 → 功能调用成功但 schema 有漂移，下次重启后崩
- 失败只看 HTTP status 不看 `tasks.fail_reason` → 漏掉上游真实错误
- 重启而非刷新缓存 → 线上服务中断 30s+
