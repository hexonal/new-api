# SQL Playbook - 新增模型接入

以下 SQL 为模板，执行前替换占位符。

## Step 0) 预检：root sk + sequence 健康

### 0.1 用 MCP 查询 root sk（用于刷新缓存）

> ⚠️ **安全红线**：root sk 是整库最高权限凭证，导出后**不得**粘贴到 commit/PR/issue、写入代码/配置文件、在可被导出的对话中明文打印。详细规则见 `refresh-runtime-cache.md` 的"安全红线"章节。

```sql
SELECT
  u.id AS user_id,
  u.username,
  'sk-' || TRIM(t.key) AS root_sk
FROM users u
JOIN tokens t ON t.user_id = u.id
WHERE u.role = 100
  AND u.status = 1
  AND t.status = 1
ORDER BY t.id ASC
LIMIT 1;
```

规则：

- 只使用 MCP 查询得到的 root sk 调 `refresh_pricing_cache`
- token 选择规则固定为：`root 用户 + t.id ASC 的第一条`
- 不手填、不猜测、不复用业务 token
- **拿到后立即调用 refresh 接口，不要在对话里做其他任何事**——减少 token 在上下文的停留时间

### 0.2 检查 models/channels 自增序列是否落后

```sql
SELECT
  'models' AS table_name,
  COALESCE((SELECT MAX(id) FROM models), 0) AS max_id,
  (SELECT last_value FROM models_id_seq) AS seq_last_value
UNION ALL
SELECT
  'channels' AS table_name,
  COALESCE((SELECT MAX(id) FROM channels), 0) AS max_id,
  (SELECT last_value FROM channels_id_seq) AS seq_last_value;
```

### 0.3 修复序列漂移（首次插入冲突时必做）

```sql
SELECT setval('models_id_seq', COALESCE((SELECT MAX(id) FROM models), 0) + 1, false);
SELECT setval('channels_id_seq', COALESCE((SELECT MAX(id) FROM channels), 0) + 1, false);
```

## Step 5) 配置渠道 SQL

### 5.1 查询渠道

```sql
SELECT id, name, type, status, base_url, models
FROM channels
WHERE name ILIKE '%<channel_name>%';
```

### 5.2 新增渠道（按需）

> ⚠️ **敏感凭证**：`<channel_key>` 是上游供应商 API key，**不得**在对话里明文替换后再展示或提交。
> - 建议通过受信任的密钥管理工具（如 1Password CLI、环境变量注入）临时拿到 key 后立即执行 SQL，执行完立即清除变量
> - 不要把真实 key 值写进 commit message、PR 描述、issue、聊天记录
> - 单引号包裹 + `$$` dollar-quoted 在 key 含特殊字符时更安全：`VALUES (..., $$<channel_key>$$, ...)`

```sql
INSERT INTO channels(type, key, status, name, base_url, models, "group", created_time)
VALUES (<channel_type>, '<channel_key>', 1, '<channel_name>', '<base_url>', '<models_json_or_csv>', 'default', EXTRACT(EPOCH FROM NOW())::bigint);
```

### 5.3 绑定 abilities

```sql
INSERT INTO abilities("group", model, channel_id, enabled, priority, weight, tag)
VALUES ('default', '<model_name>', <channel_id>, true, 0, 0, NULL)
ON CONFLICT ("group", model, channel_id)
DO UPDATE SET enabled = EXCLUDED.enabled,
              priority = EXCLUDED.priority,
              weight = EXCLUDED.weight,
              tag = EXCLUDED.tag;
```

## Step 6) 配置模型 SQL 与参数 SQL

### 6.1 查询模型

```sql
SELECT id, model_name, vendor_id, endpoints
FROM models
WHERE model_name = '<model_name>';
```

### 6.2 更新 endpoints + supported_endpoint_types

```sql
UPDATE models
SET endpoints = '<endpoints_json_text>',
    supported_endpoint_types = '<supported_endpoint_types_json_text>',
    vendor_id = <vendor_id>,
    updated_time = EXTRACT(EPOCH FROM NOW())::bigint
WHERE model_name = '<model_name>';
```

说明：

- `supported_endpoint_types` 至少包含主能力（如 `chat`）
- 若模型存在多个文本能力，`capabilities` 必须完整写入全部端点 key

### 6.3 枚举降级防线

```sql
WITH endpoint_rows AS (
  SELECT
    m.model_name,
    cap.key AS capability,
    prm.key AS parameter,
    prm.value->'schema' AS schema
  FROM models m
  CROSS JOIN LATERAL jsonb_each(COALESCE(m.endpoints::jsonb, '{}'::jsonb)) cap
  CROSS JOIN LATERAL jsonb_each(COALESCE(cap.value->'parameters', '{}'::jsonb)) prm
)
SELECT model_name, capability, parameter, schema->'options' AS options
FROM endpoint_rows
WHERE schema->>'kind'='enum'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(schema->'options','[]'::jsonb)) elem
    WHERE jsonb_typeof(elem) <> 'string'
  );
```

## Step 7) 配置价格 SQL

### 7.1 查询现状

```sql
SELECT model, type, channel_type, input, output, locked, extra_ratios
FROM prices
WHERE model = '<model_name>';
```

### 7.2 写入价格

```sql
INSERT INTO prices(model, type, channel_type, input, output, locked, extra_ratios)
VALUES ('<model_name>', '<tokens_or_times>', <channel_type>, <input_price>, <output_price>, false, NULL)
ON CONFLICT DO NOTHING;
```

## Step 8) 刷新 + 验收

### 8.1 刷新缓存（优先）

先执行 Step 0.1 拿到 root sk，再调用：

```bash
curl --location --request POST 'https://<domain>/api/option/refresh_pricing_cache' \
  --header 'Authorization: Bearer <root_token>' \
  --header 'Accept: application/json'
```

### 8.2 重启兜底（仅必要时）

> ⚠️ **重启会导致服务中断**（包括正在进行的流式请求被断开、所有 channel 连接池重建）。**仅在 refresh_pricing_cache 接口异常且短期无法修复时使用**，且必须先评估:
> - 当前是否有长时间运行的异步任务（music/video）—— 重启会让任务状态断链
> - 峰值时段是否可以承受 30s+ 服务中断
> - 是否有更轻的替代方案（仅重启 cache goroutine、只重启单个 pod）
>
> 本项目 new-api 部署在固定服务器上，SSH 命令如下（私钥路径与 IP 固定，不要改）：

```bash
ssh -i ~/.ssh/id_rsa_dify_server root@167.114.174.225 "docker restart one-api"
```

### 8.3 /v1/models 验收

```bash
curl -sS --location --request GET 'https://<domain>/v1/models' \
  --header 'Authorization: Bearer <token>' \
  --header 'Accept: application/json' \
| jq -r '.data[] as $m
  | select($m.id=="<model_name>")
  | ($m.capabilities // {}) | to_entries[] as $c
  | ($c.value.parameters // {}) | to_entries[]
  | [$m.id,$c.key,.key,.value.schema.kind,.value.schema.value_type,((.value.schema.options // [])|@json)]
  | @tsv'
```

### 8.4 文本模型多端点验收（重点）

```bash
curl -sS --location --request GET 'https://<domain>/v1/models' \
  --header 'Authorization: Bearer <token>' \
  --header 'Accept: application/json' \
| jq -r '.data[] | select(.id=="<model_name>")
  | .capabilities
  | to_entries[]
  | select((.key=="chat") or (.key=="claude_messages"))
  | [.key,.value.path,.value.method,.value.provider_style,.value.request_format,.value.sdk_method]
  | @tsv'
```

预期：

- `chat` 与扩展文本端点（如 `claude_messages`）都存在
- `path/method/provider_style/request_format/sdk_method` 均非空
