# magic666.top 模型验证记录

> 日期：2026-04-10
> 状态：已验证
> 渠道地址：`https://magic666.top`
> 验证密钥：`sk-Kf0k8IThnDVN2TPSFdA0SJJZjIhp8TZ1Hy96ibytm5jzYLFu`

## 1. 验证背景

本次验证目标：

1. 对照 `https://magic666.top/api/pricing` 中的图像/视频模型
2. 使用渠道自己的 `sk` 直接请求接口验证可用性
3. 输出可直接接入的模型名单

补充现象：

1. `GET /v1/models` 返回空列表：`{"data":[],"object":"list","success":true}`
2. 因此本次以 `pricing` 中的模型名为准，直接发起真实调用验证

## 2. 已确认可用的模型

### 图像模型

| 模型 | 接口 | 验证结果 | 备注 |
|------|------|---------|------|
| `doubao-seedream-4-0-250828` | `POST /v1/images/generations` | `200` | 可直接使用 |
| `doubao-seedream-4-5-251128` | `POST /v1/images/generations` | `200` | 需使用 `1920x1920`，`1024x1024` 会报尺寸不足 |
| `jimeng-4.0` | `POST /v1/images/generations` | `200` | 可直接使用 |
| `jimeng-4.1` | `POST /v1/images/generations` | `200` | 可直接使用 |

### 视频模型

| 模型 | 接口 | 验证结果 | 备注 |
|------|------|---------|------|
| `kling-o1-1080p` | `POST /v1/videos` | `200` | 返回 `queued` 任务 |
| `sora3` | `POST /v1/videos` | `200` | 返回 `queued` 任务，响应中的实际模型为 `sora-2-max` |

## 3. 能力矩阵

| 模型 | 文生图 | 图生图 | 文生视频 | 图生视频 | 备注 |
|------|--------|--------|----------|----------|------|
| `doubao-seedream-4-0-250828` | 支持 | 支持 | 不适用 | 不适用 | `/v1/images/generations` 与 `/v1/images/edits` 都已实测 `200` |
| `doubao-seedream-4-5-251128` | 支持 | 支持 | 不适用 | 不适用 | 图像接口需传足够大的 `size`，`1920x1920` 已实测通过 |
| `jimeng-4.0` | 支持 | 不支持 | 不适用 | 不适用 | 文生图 `200`，图生图 `/v1/images/edits` 返回 `get_channel_failed` |
| `jimeng-4.1` | 支持 | 不支持 | 不适用 | 不适用 | 文生图 `200`，图生图 `/v1/images/edits` 返回 `get_channel_failed` |
| `jimeng-4.5` | 不支持 | 不支持 | 不适用 | 不适用 | 当前无可用渠道 |
| `kling-o1-1080p` | 不适用 | 不适用 | 支持 | 支持 | `prompt` 或 `prompt + image_url` 都已实测 `200` |
| `sora3` | 不适用 | 不适用 | 支持 | 支持 | `prompt` 或 `prompt + image_url` 都已实测 `200` |
| `sora-2-pro-oai` | 不适用 | 不适用 | 不支持 | 不支持 | 当前无可用渠道 |
| `veo3.1-fast-components` | 不适用 | 不适用 | 不支持 | 不支持 | 上游许可证已过期 |

判定标准：

1. `支持`：已直接调用目标接口并拿到 `200`
2. `不支持`：已直接调用目标接口并拿到明确失败原因
3. `待确认`：调用未拿到稳定成功或明确失败结论

## 4. 参数总表

说明：

1. 这一节分为“文档声明参数”和“渠道实测参数”
2. `文档声明` 表示在 MagicAPI Apifox 文档里出现过
3. `已验证` 表示我已经用 `magic666.top` 这条渠道实际请求过
4. `未验证` 表示字段在文档里出现过，但还没逐项验证

### 4.1 文生图：`POST /v1/images/generations`

参考文档：

1. doubao 生成图像：`/v1/images/generations`
2. 文档示例字段：`model`、`prompt`、`n`、`size`

| 参数 | 类型 | 文档来源 | 是否已验证 | 备注 |
|------|------|----------|-----------|------|
| `model` | string | 文档声明 | 已验证 | 必填 |
| `prompt` | string | 文档声明 | 已验证 | 必填 |
| `n` | number | 文档声明 | 部分验证 | `doubao-seedream-4-0-250828` 已验证支持 `n=2` |
| `size` | string | 文档声明 | 部分验证 | 不同模型要求不同，存在最小像素门槛 |

模型级实测结论：

| 模型 | 最小可用参数 | `size` 状态 | 备注 |
|------|-------------|-------------|------|
| `doubao-seedream-4-0-250828` | `model`、`prompt` | 可选 | 不带 `size` 可用 |
| `doubao-seedream-4-5-251128` | `model`、`prompt`、`size` | 必填 | `1920x1920` 已通过，`1024x1024` 不可用 |
| `jimeng-4.0` | `model`、`prompt` | 可选 | 已验证，扩展参数测试结果不稳定 |
| `jimeng-4.1` | `model`、`prompt` | 可选 | 已验证，扩展参数测试结果不稳定 |

### 4.2 图生图：`POST /v1/images/edits`

参考文档：

1. OpenAI Images 标准接口包含 `创建图片编辑`
2. 当前 `magic666` 渠道对该接口已实测

| 参数 | 类型 | 来源 | 是否已验证 | 备注 |
|------|------|------|-----------|------|
| `model` | string | 接口实测 | 已验证 | 必填 |
| `prompt` | string | 接口实测 | 已验证 | 必填 |
| `image` | file | 接口实测 | 已验证 | 必填，使用 multipart/form-data |
| `mask` | file | 标准接口常见字段 | 部分验证 | 字段可被接口接受，但当前被上游素材下载 TLS 问题拦住 |
| `size` | string | 标准接口常见字段 | 未验证 | 当前未逐项验证 |
| `n` | number | 标准接口常见字段 | 未验证 | 当前未逐项验证 |

模型级实测结论：

| 模型 | 图生图状态 | 备注 |
|------|-----------|------|
| `doubao-seedream-4-0-250828` | 支持 | `model + prompt + image` 已通过 |
| `doubao-seedream-4-5-251128` | 支持 | `model + prompt + image` 已通过 |
| `jimeng-4.0` | 不支持 | 返回 `get_channel_failed` |
| `jimeng-4.1` | 不支持 | 返回 `get_channel_failed` |

### 4.3 文生视频 / 图生视频：`POST /v1/videos`

参考文档：

1. sora 视频接口：`/v1/videos`
2. 文档示例字段：`model`、`prompt`、`size`、`seconds`、`input_reference`、`character_url`、`character_timestamps`
3. 当前 `magic666` 渠道实测时，还验证了 `image_url`、`duration`

| 参数 | 类型 | 来源 | 是否已验证 | 备注 |
|------|------|------|-----------|------|
| `model` | string | 文档声明 | 已验证 | 必填 |
| `prompt` | string | 文档声明 | 已验证 | 必填 |
| `size` | string | 文档声明 | 部分验证 | `sora3` 可选，其他模型未逐项全测 |
| `seconds` | string | 文档声明 | 部分验证 | `sora-2-pro-oai` 需要字符串，但模型本身当前无渠道 |
| `input_reference` | file/string | 文档声明 | 已验证 | `sora3` 携带 base64 data URL 可正常入队 |
| `character_url` | string | 文档声明 | 已验证 | `sora3` 携带该字段可正常入队 |
| `character_timestamps` | string | 文档声明 | 已验证 | `sora3` 携带该字段可正常入队 |
| `image_url` | string | 接口实测 | 已验证 | 可作为图生视频参考图 |
| `duration` | number/string | 接口实测 | 已验证 | 不同模型类型要求不一致 |

模型级实测结论：

| 模型 | 文生视频 | 图生视频 | 最小可用参数 | 类型约束 |
|------|----------|----------|-------------|----------|
| `kling-o1-1080p` | 支持 | 支持 | 文生视频：`model + prompt`；图生视频：`model + prompt + image_url` | `duration` 传字符串或数字都可 |
| `sora3` | 支持 | 支持 | 文生视频：`model + prompt`；图生视频：`model + prompt + image_url` | `duration` 如果传值，必须是数字 |

## 5. 可用模型参数要求

### 图像模型

#### `doubao-seedream-4-0-250828`

已验证最小可用请求体：

```json
{
  "model": "doubao-seedream-4-0-250828",
  "prompt": "a cute cat"
}
```

说明：

1. 不带 `size` 已验证可用
2. `size=1024x1024` 也已验证可用
3. `n=2` 已验证可用
4. `size=512x512` 不可用，错误提示要求最小像素 `921600`
5. 目前只能确认 `model`、`prompt` 是必填
6. `size` 是可选，但传值时要满足尺寸下限
7. 使用接口：`POST /v1/images/generations`

#### `doubao-seedream-4-5-251128`

已验证可用请求体：

```json
{
  "model": "doubao-seedream-4-5-251128",
  "prompt": "a cute cat",
  "size": "1920x1920"
}
```

说明：

1. `size=1024x1024` 不可用
2. 错误原因：像素低于最小要求 `3686400`
3. `size=1920x1920` 已验证可用
4. 图生图 `/v1/images/edits` 已验证可用
5. 当前不能把 `size` 判定为可选
6. 当前应按“需要显式传入足够大的 `size`”处理
7. 使用接口：`POST /v1/images/generations`

#### `jimeng-4.0`

已验证最小可用请求体：

```json
{
  "model": "jimeng-4.0",
  "prompt": "a cute cat"
}
```

说明：

1. 不带 `size` 已验证可用
2. `size=1024x1024` 也已验证可用
3. 目前只能确认 `model`、`prompt` 是必填
4. `size` 是可选
5. 该模型响应较慢，单次请求耗时可到 30 秒以上
6. `n`、更小尺寸等扩展参数测试结果目前不稳定
7. 使用接口：`POST /v1/images/generations`

#### `jimeng-4.1`

已验证最小可用请求体：

```json
{
  "model": "jimeng-4.1",
  "prompt": "a cute cat"
}
```

说明：

1. 不带 `size` 已验证可用
2. `size=1024x1024` 也已验证可用
3. 目前只能确认 `model`、`prompt` 是必填
4. `size` 是可选
5. 该模型响应较慢，单次请求耗时可到 35 秒左右
6. `n`、更小尺寸等扩展参数测试结果目前不稳定
7. 使用接口：`POST /v1/images/generations`

### 视频模型

#### `kling-o1-1080p`

已验证最小可用请求体：

```json
{
  "model": "kling-o1-1080p",
  "prompt": "a cute cat walking in a garden",
  "image_url": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba"
}
```

说明：

1. 只传 `model`、`prompt`、`image_url` 已验证返回 `queued`
2. `duration` 可选
3. `size` 可选
4. `duration` 传字符串 `"5"` 或数字 `5` 都已验证可用
5. 使用接口：`POST /v1/videos`

#### `sora3`

已验证最小可用请求体：

```json
{
  "model": "sora3",
  "prompt": "a cute cat walking in a garden"
}
```

说明：

1. 只传 `model`、`prompt` 已验证返回 `queued`
2. `image_url` 可选
3. `duration` 可选
4. `size` 可选
5. `duration` 传数字 `5` 可用，传字符串 `"5"` 会报类型错误
6. `input_reference` 已验证可用
7. `character_url` 已验证可用
8. `character_timestamps` 已验证可用
9. 不传 `duration` 时，系统会走默认值
10. 响应中的实际下发模型名为 `sora-2-max`
11. 使用接口：`POST /v1/videos`

## 6. 已确认当前不可用的模型

| 模型 | 接口 | 验证结果 | 原因 |
|------|------|---------|------|
| `jimeng-4.5` | `POST /v1/images/generations` | `500` | `get_channel_failed`，`auto/default` 下取不到可用渠道 |
| `jimeng-4.5-4k` | `POST /v1/images/generations` | `500` | `No available channel for model jimeng-4.5-4k under group default` |
| `sora-2-pro-oai` | `POST /v1/videos` | `500` | `no available channel found ... for model sora-2-pro-oai` |
| `veo3.1-fast-components` | `POST /v1/videos` | `400` | 上游返回 `许可证已过期` |

## 7. 已移除项说明

数据库检查结果：

1. `jimeng-4.5`
2. `jimeng-4.5-4k`
3. `sora-2-pro-oai`
4. `veo3.1-fast-components`

当前均不在我们的 `models` / `abilities` 表中，无需额外删除。

当前 `magic666` 渠道配置状态：

1. `magic666-img` 仅保留：
   - `jimeng-4.0`
   - `jimeng-4.1`
   - `doubao-seedream-4-0-250828`
   - `doubao-seedream-4-5-251128`
2. `magic666-video` 当前仅保留：
   - `sora-2`

## 8. 建议接入名单

当前建议接入：

1. `doubao-seedream-4-0-250828`
2. `doubao-seedream-4-5-251128`
3. `jimeng-4.0`
4. `jimeng-4.1`
5. `kling-o1-1080p`
6. `sora3`

按能力分类建议接入：

1. 文生图：
   - `doubao-seedream-4-0-250828`
   - `doubao-seedream-4-5-251128`
   - `jimeng-4.0`
   - `jimeng-4.1`
2. 图生图：
   - `doubao-seedream-4-0-250828`
   - `doubao-seedream-4-5-251128`
3. 文生视频：
   - `kling-o1-1080p`
   - `sora3`
4. 图生视频：
   - `kling-o1-1080p`
   - `sora3`

## 9. 最终推荐配置

这一节是给接入和配置直接使用的最终建议。

### 9.1 推荐接入矩阵

| 能力 | 主推荐模型 | 备选模型 | 推荐原因 |
|------|-----------|---------|---------|
| 文生图 | `doubao-seedream-4-0-250828` | `jimeng-4.0`、`jimeng-4.1` | `doubao-seedream-4-0-250828` 参数最稳，`model + prompt` 即可 |
| 高质量文生图 | `doubao-seedream-4-5-251128` | 无 | 已验证可用，但必须显式传大尺寸 |
| 图生图 | `doubao-seedream-4-0-250828` | `doubao-seedream-4-5-251128` | 两者都已实测通过 `/v1/images/edits` |
| 文生视频 | `sora3` | `kling-o1-1080p` | `sora3` 最小参数最少，`model + prompt` 即可 |
| 图生视频 | `kling-o1-1080p` | `sora3` | `kling-o1-1080p` 明确适合带 `image_url` 做参考图生成 |

### 9.2 推荐默认模型

如果系统里每个能力只先上一个默认模型，建议：

1. 文生图默认：`doubao-seedream-4-0-250828`
2. 高质量文生图默认：`doubao-seedream-4-5-251128`
3. 图生图默认：`doubao-seedream-4-0-250828`
4. 文生视频默认：`sora3`
5. 图生视频默认：`kling-o1-1080p`

### 9.3 推荐请求模板

#### 文生图默认模板

```json
{
  "model": "doubao-seedream-4-0-250828",
  "prompt": "a cute cat"
}
```

#### 高质量文生图模板

```json
{
  "model": "doubao-seedream-4-5-251128",
  "prompt": "a cute cat",
  "size": "1920x1920"
}
```

#### 图生图默认模板

使用 `multipart/form-data`：

1. `model=doubao-seedream-4-0-250828`
2. `prompt=turn the image into a watercolor cat portrait`
3. `image=@your_file.png`

#### 文生视频默认模板

```json
{
  "model": "sora3",
  "prompt": "a cute cat walking in a garden"
}
```

#### 图生视频默认模板

```json
{
  "model": "kling-o1-1080p",
  "prompt": "a cute cat walking in a garden",
  "image_url": "https://your-image-url"
}
```

### 9.4 不建议接入

以下模型本轮建议明确不接入：

1. `jimeng-4.5`
2. `jimeng-4.5-4k`
3. `sora-2-pro-oai`
4. `veo3.1-fast-components`

原因：

1. `jimeng-4.5` / `jimeng-4.5-4k`：当前无可用渠道
2. `sora-2-pro-oai`：当前无可用渠道
3. `veo3.1-fast-components`：上游许可证过期

### 9.5 谨慎接入项

以下模型不是不能用，但本轮不建议作为首选默认：

1. `jimeng-4.0`
2. `jimeng-4.1`

原因：

1. 文生图可用
2. 但响应整体偏慢
3. 扩展参数如 `n`、小尺寸的表现不够稳定
4. 更适合作为备选模型，而不是首个默认模型

## 10. 原始验证摘要

### 可用请求示例

#### `doubao-seedream-4-0-250828`

- 请求：`POST /v1/images/generations`
- 结果：`200`

#### `kling-o1-1080p`

- 请求：`POST /v1/videos`
- 结果：`200`
- 响应关键字段：`"status":"queued"`

#### `sora3`

- 请求：`POST /v1/videos`
- 结果：`200`
- 响应关键字段：`"model":"sora-2-max"`

### 不可用请求示例

#### `jimeng-4.5`

- 请求：`POST /v1/images/generations`
- 结果：`500`
- 关键错误：`get_channel_failed`

#### `veo3.1-fast-components`

- 请求：`POST /v1/videos`
- 结果：`400`
- 关键错误：`许可证已过期`

## 11. new-api / api-sdk 最终协议设计

这一节用于固化后续实现方向。

结论：

1. 不考虑兼容旧结构
2. `endpoints` 是唯一事实源
3. 参数按端点定义，不再只做模型级平铺
4. `supported_endpoint_types` 只从 `endpoints` 派生
5. 参数按“保守开放”原则建模，只暴露已稳定验证的字段和值

### 11.1 设计原则

1. 模型支持哪些能力，只看 `endpoints`
2. 每个端点需要哪些参数，只看对应 `endpoint.parameters`
3. 所有端点共享的参数，放在 `common_parameters`
4. `size` 这类参数优先使用 `enum` 固化，不再默认开放自由字符串
5. 不稳定参数不进入对外 schema，最多保留在内部验证文档

### 11.2 能力命名规范

能力名只表达业务能力，不混入厂商名或协议名。

固定能力名：

1. `text`
2. `text_to_image`
3. `image_to_image`
4. `text_to_video`
5. `image_to_video`

协议或厂商风格单独使用 `provider_style` 表达，例如：

1. `openai-image`
2. `openai-video`
3. `jimeng`
4. `kling`

### 11.3 推荐响应结构

推荐模型元数据结构：

```json
{
  "id": "doubao-seedream-4-0-250828",
  "supported_endpoint_types": [
    "text_to_image",
    "image_to_image"
  ],
  "common_parameters": {
    "model": {
      "type": "string",
      "required": true,
      "default": "doubao-seedream-4-0-250828"
    }
  },
  "endpoints": {
    "text_to_image": {
      "path": "/v1/images/generations",
      "method": "POST",
      "provider_style": "openai-image",
      "async": false,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "size": {
          "type": "string",
          "required": false,
          "enum": [
            "1024x1024"
          ],
          "default": "1024x1024",
          "description": "当前稳定开放尺寸"
        }
      }
    }
  }
}
```

字段语义：

1. `supported_endpoint_types`
   - 纯派生字段
   - 值来自 `endpoints` 的 key
2. `common_parameters`
   - 存所有端点共享的参数
   - 当前建议只放 `model`
3. `endpoints`
   - 每个 key 表示一个能力端点
   - 内含 `path`、`method`、`provider_style`、`async`、`parameters`
4. `parameters`
   - 当前只定义该端点稳定支持的参数

### 11.4 参数 schema 规范

第一版建议只支持以下字段：

1. `type`
2. `required`
3. `default`
4. `enum`
5. `description`

参数定义示例：

```json
{
  "size": {
    "type": "string",
    "required": false,
    "enum": [
      "1024x1024"
    ],
    "default": "1024x1024",
    "description": "当前稳定开放尺寸"
  }
}
```

约束：

1. `enum` 用于“平台承诺支持的安全值”
2. 没有稳定验证过的值，不进入 `enum`
3. 若参数仍需保守开放但暂时无法穷举，再单独评估是否允许自由输入
4. 当前阶段不建议默认开放自由 `size`

### 11.5 保守开放策略

保守开放定义：

1. 只暴露已经稳定验证通过的参数
2. 只暴露已经稳定验证通过的参数值
3. 理论可能支持但未稳定验证的能力，不对外承诺

适用规则：

1. `size` 优先收敛为 `enum`
2. `n` 这类扩展参数，只有在验证稳定后才开放
3. `jimeng` 当前不开放图生图能力
4. `sora3` 与 `kling-o1-1080p` 当前不开放 `size`

### 11.6 当前模型的目标配置

#### `jimeng-4.0`

```json
{
  "common_parameters": {
    "model": {
      "type": "string",
      "required": true,
      "default": "jimeng-4.0"
    }
  },
  "endpoints": {
    "text_to_image": {
      "path": "/v1/images/generations",
      "method": "POST",
      "provider_style": "jimeng",
      "async": true,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "size": {
          "type": "string",
          "required": false,
          "enum": [
            "1024x1024"
          ],
          "default": "1024x1024",
          "description": "当前稳定开放尺寸"
        }
      }
    }
  }
}
```

#### `jimeng-4.1`

```json
{
  "common_parameters": {
    "model": {
      "type": "string",
      "required": true,
      "default": "jimeng-4.1"
    }
  },
  "endpoints": {
    "text_to_image": {
      "path": "/v1/images/generations",
      "method": "POST",
      "provider_style": "jimeng",
      "async": true,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "size": {
          "type": "string",
          "required": false,
          "enum": [
            "1024x1024"
          ],
          "default": "1024x1024",
          "description": "当前稳定开放尺寸"
        }
      }
    }
  }
}
```

#### `doubao-seedream-4-0-250828`

```json
{
  "common_parameters": {
    "model": {
      "type": "string",
      "required": true,
      "default": "doubao-seedream-4-0-250828"
    }
  },
  "endpoints": {
    "text_to_image": {
      "path": "/v1/images/generations",
      "method": "POST",
      "provider_style": "openai-image",
      "async": false,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "size": {
          "type": "string",
          "required": false,
          "enum": [
            "1024x1024"
          ],
          "default": "1024x1024",
          "description": "当前稳定开放尺寸"
        },
        "n": {
          "type": "integer",
          "required": false,
          "default": 1,
          "description": "当前稳定支持 1 和 2"
        }
      }
    },
    "image_to_image": {
      "path": "/v1/images/edits",
      "method": "POST",
      "provider_style": "openai-image",
      "async": false,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "image": {
          "type": "file",
          "required": true
        },
        "size": {
          "type": "string",
          "required": false,
          "enum": [
            "1024x1024"
          ],
          "default": "1024x1024",
          "description": "当前稳定开放尺寸"
        }
      }
    }
  }
}
```

#### `doubao-seedream-4-5-251128`

```json
{
  "common_parameters": {
    "model": {
      "type": "string",
      "required": true,
      "default": "doubao-seedream-4-5-251128"
    }
  },
  "endpoints": {
    "text_to_image": {
      "path": "/v1/images/generations",
      "method": "POST",
      "provider_style": "openai-image",
      "async": false,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "size": {
          "type": "string",
          "required": true,
          "enum": [
            "1920x1920"
          ],
          "default": "1920x1920",
          "description": "当前稳定开放尺寸"
        }
      }
    },
    "image_to_image": {
      "path": "/v1/images/edits",
      "method": "POST",
      "provider_style": "openai-image",
      "async": false,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "image": {
          "type": "file",
          "required": true
        },
        "size": {
          "type": "string",
          "required": true,
          "enum": [
            "1920x1920"
          ],
          "default": "1920x1920",
          "description": "当前稳定开放尺寸"
        }
      }
    }
  }
}
```

#### `sora3`

```json
{
  "common_parameters": {
    "model": {
      "type": "string",
      "required": true,
      "default": "sora3"
    }
  },
  "endpoints": {
    "text_to_video": {
      "path": "/v1/videos",
      "method": "POST",
      "provider_style": "openai-video",
      "async": true,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "duration": {
          "type": "integer",
          "required": false
        },
        "input_reference": {
          "type": "string",
          "required": false
        },
        "character_url": {
          "type": "string",
          "required": false
        },
        "character_timestamps": {
          "type": "string",
          "required": false
        }
      }
    },
    "image_to_video": {
      "path": "/v1/videos",
      "method": "POST",
      "provider_style": "openai-video",
      "async": true,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "image_url": {
          "type": "string",
          "required": true
        },
        "duration": {
          "type": "integer",
          "required": false
        }
      }
    }
  }
}
```

#### `kling-o1-1080p`

```json
{
  "common_parameters": {
    "model": {
      "type": "string",
      "required": true,
      "default": "kling-o1-1080p"
    }
  },
  "endpoints": {
    "text_to_video": {
      "path": "/v1/videos",
      "method": "POST",
      "provider_style": "kling",
      "async": true,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "duration": {
          "type": "integer",
          "required": false
        }
      }
    },
    "image_to_video": {
      "path": "/v1/videos",
      "method": "POST",
      "provider_style": "kling",
      "async": true,
      "parameters": {
        "prompt": {
          "type": "string",
          "required": true
        },
        "image_url": {
          "type": "string",
          "required": true
        },
        "duration": {
          "type": "integer",
          "required": false
        }
      }
    }
  }
}
```

### 11.7 对 new-api 与 api-sdk 的要求

`new-api`：

1. 返回端点级 schema
2. `supported_endpoint_types` 从 `endpoints` 自动派生
3. 不再要求业务方根据平铺参数猜测调用方式

`api-sdk`：

1. 直接消费服务端返回的端点级 schema
2. 根据 `path`、`method`、`provider_style` 和 `parameters` 决定调用方式
3. 不再以本地猜测表作为主逻辑

最终目标：

1. 模型支持什么能力，一眼可见
2. 每个能力需要什么参数，一眼可见
3. 已开放哪些 `size`、`duration` 等值，一眼可见
4. 业务方调用 `new-api` 时不需要靠猜
