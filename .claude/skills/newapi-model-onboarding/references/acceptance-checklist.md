# 接入验收清单（Step 8）

## 8.1 缓存刷新

> ⚠️ **安全红线**：root sk 是整库最高权限凭证，导出后**不得**粘贴到 commit/PR/issue、写入代码/配置文件、在可被导出的对话中明文打印。详细规则见 `refresh-runtime-cache.md` 的"安全红线"章节。拿到后立即调用 refresh 接口，不要在对话里做其他任何事。

先通过 MCP 查询 root sk：

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

优先调用刷新接口：

```bash
curl --location --request POST 'https://<domain>/api/option/refresh_pricing_cache' \
  --header 'Authorization: Bearer <root_token>' \
  --header 'Accept: application/json'
```

仅当刷新失败且无法快速恢复时，才执行重启兜底。

## 8.2 DB 验收

- `models.endpoints` 已写入
- `abilities` 已绑定目标 channel
- `prices` 已存在目标模型价格
- `enum.options` 无非字符串值
- `models_id_seq`、`channels_id_seq` 未落后于表内 `MAX(id)`

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

## 8.3 /v1/models 结构验收

### 结构完整性

```bash
curl -sS --location --request GET 'https://<domain>/v1/models' \
  --header 'Authorization: Bearer <token>' \
  --header 'Accept: application/json' \
| jq -r '.data[] as $m
  | ($m.capabilities // {}) | to_entries[]
  | select((.value.path // "") == "" or (.value.method // "") == "" or (.value.provider_style // "") == "" or (.value.request_format // "") == "" or (.value.sdk_method // "") == "")
  | [$m.id,.key,.value.path,.value.method,.value.provider_style,.value.request_format,.value.sdk_method]
  | @tsv'
```

输出应为空。

### 枚举参数验收

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

预期参数必须保持 `kind=enum`，不能降级为 `scalar`。

## 8.4 功能验收

- 文生图：提交成功
- 图生图：提交成功
- 文生视频 / 图生视频：提交成功并轮询到终态
- 失败时查看 `tasks.fail_reason`，回写参数 schema

## 8.5 文本模型多端点验收

适用于支持多个文本端点的模型（例如 `chat` + `claude_messages`）。

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

输出中每个端点都应满足：

- `path` 非空
- `method` 非空
- `provider_style` 非空
- `request_format` 非空
- `sdk_method` 非空

## 8.6 模型级特性标记验收

验证 `reasoning` 和 `function_calling` 字段与系统设置 Option 一致：

```bash
curl -sS --location --request GET 'https://<domain>/v1/models' \
  --header 'Authorization: Bearer <token>' \
  --header 'Accept: application/json' \
| jq -r '.data[] | select(.reasoning==true or .function_calling==true)
  | [.id,.reasoning,.function_calling]
  | @tsv'
```

输出应与 `ModelReasoningMap` / `ModelFunctionCallingMap` Option 中配置的模型一致。

## 8.7 最终输出

- 上游配置摘要
- 上游模型清单
- 参数验证结论
- 渠道/模型/价格 SQL 结果
- `/v1/models` 核对结论
- 功能验收结果（含任务 ID）
