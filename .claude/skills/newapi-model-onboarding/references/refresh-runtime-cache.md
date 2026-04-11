# 运行时刷新接口

## 推荐接口

- 方法：`POST`
- 路径：`/api/option/refresh_pricing_cache`
- 鉴权：`RootAuth`（root token）

该接口会执行：

- 重新加载 Option 到内存
- 刷新定价缓存
- 重新初始化 channel cache
- 清理 channel affinity cache
- 广播刷新信号到其他 Pod

## 调用示例

### ⚠️ 安全红线：root sk 不得泄露到长期上下文

**root sk 是整库最高权限凭证**，一旦泄露可以任意创建/删除 channel、users、修改价格。

**禁止**：
- ❌ 把 root sk 粘贴到 commit、PR、issue、comment
- ❌ 把 root sk 写入代码 / 配置文件 / 环境变量默认值
- ❌ 在能被长期保存的对话（例如需要导出分享的）里明文打印 root sk
- ❌ 通过不受信任的第三方 MCP/日志系统中转

**允许**：
- ✅ 在当前**一次性**的本地 MCP 查询里临时获取、立即调用 refresh 接口后即可遗忘
- ✅ 优先使用专门的受限 token（如果 new-api 后续增加"仅刷新缓存"权限的 key，改用那个）

先通过 MCP 执行 SQL 临时获取 root sk（禁止手填/猜测）：

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

拿到后**立刻**调用刷新接口（不要做别的事，减少 token 在上下文里的停留时间）：

```bash
curl --location --request POST 'https://<domain>/api/option/refresh_pricing_cache' \
  --header 'Authorization: Bearer <root_token>' \
  --header 'Accept: application/json'
```

调用成功后，**不要**在回答里重复/展示 root sk 明文——让它只存在于一条 MCP 查询结果 + 一条 curl 命令的上下文片段内。

## 何时重启

仅在下列情况再重启：

- 刷新接口异常且短期无法恢复
- 本地开发环境临时兜底
- 用户明确要求重启
