# Pricing Cache Refresh SOP

更新时间：2026-03-16

当你直接通过数据库修改了定价相关配置（例如 `options.key='ModelRatio'`）后，
无需重启服务，可通过以下接口立即刷新运行时定价缓存：

## 接口

- Method: `POST`
- Path: `/api/option/refresh_pricing_cache`
- Auth: `RootAuth`（使用 root token）

## curl 示例

```bash
curl -X POST 'https://zcheap.ai/api/option/refresh_pricing_cache' \
  -H 'Authorization: Bearer <ROOT_TOKEN>'
```

## 成功返回示例

```json
{"success":true,"message":"定价缓存刷新成功"}
```

## 适用范围

建议在以下数据库变更后执行一次：

- `ModelRatio`
- `CompletionRatio`
- `CacheRatio`
- `CreateCacheRatio`
- `ModelPrice`
- `GroupRatio`
- `GroupGroupRatio`
- `ImageRatio`
- `AudioRatio`
- `AudioCompletionRatio`

