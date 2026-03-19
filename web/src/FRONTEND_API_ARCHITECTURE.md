# 前端 API 调用层架构设计

## 概述

这个文档说明了 new-api 前端素材管理模块的 API 调用层设计，包括现有代码分析、设计决策和最佳实践。

## 现有代码分析

### 1. API 实例配置（`helpers/api.js`）

**核心特点：**
- 使用 Axios 作为 HTTP 客户端
- 自动追加 `New-API-User` header（当前用户 ID）
- 自动 Cache-Control: no-store
- 全局错误处理（通过 `showError` Toast）
- 防重复 GET 请求去重（内存 Map 缓存）

**初始化代码：**
```javascript
export let API = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL || '',
  headers: {
    'New-API-User': getUserIdFromLocalStorage(),
    'Cache-Control': 'no-store',
  },
});
```

### 2. 响应格式统一

所有 API 返回统一格式：
```javascript
{
  success: boolean,     // true 表示操作成功
  data: any,           // 返回数据，失败时可能为 null
  message: string      // 状态信息或错误描述
}
```

### 3. 错误处理（`helpers/utils.jsx`）

`showError()` 函数统一处理所有 API 错误：
- 自动捕获 Axios 错误
- 按状态码分类处理（401 重定向登录、429 限流、500 服务器错误等）
- Toast 通知用户
- 自动由 API 拦截器调用（无需手动处理）

### 4. 列表数据加载模式

现有代码中的列表加载遵循统一模式：
```javascript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);

useEffect(() => {
  const load = async () => {
    setLoading(true);
    const res = await API.get(`/api/endpoint?page=${page}`);
    if (res.data.success) {
      setData(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
  };
  load();
}, [page]);
```

## 设计架构

### 分层结构

```
┌─────────────────────────────────────┐
│    React Components (JSX)           │ UI 层
│  - AssetList, AssetDetail, etc.     │
└──────────────┬──────────────────────┘
               │ 使用
┌──────────────▼──────────────────────┐
│    Custom Hooks (useAssetList)      │ 数据加载层
│  - 状态管理                          │
│  - 生命周期管理                      │
│  - 错误处理逻辑                      │
└──────────────┬──────────────────────┘
               │ 调用
┌──────────────▼──────────────────────┐
│    Service Layer (assetService.js)  │ 服务层
│  - API 调用封装                      │
│  - 请求/响应适配                     │
│  - 参数验证                          │
└──────────────┬──────────────────────┘
               │ 使用
┌──────────────▼──────────────────────┐
│    API Interceptor (API.js)         │ 通信层
│  - Axios 配置                        │
│  - Headers 注入                      │
│  - 全局错误处理                      │
│  - 请求去重                          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Backend REST APIs (all POST)     │ 后端
└─────────────────────────────────────┘
```

### 关键设计决策

#### 1. **为什么需要服务层？**

- **单一职责**：服务层专注于 API 调用，与 UI 无关
- **可测试性**：服务层可独立单元测试
- **可复用性**：同一个服务函数可被多个组件调用
- **集中管理**：API 变化时只需修改服务层
- **参数验证**：在服务层做基础验证和转换

**示例：**
```javascript
// ✅ 好的做法
import { createAsset } from '@/services/assetService';
const result = await createAsset(groupId, url, name);

// ❌ 不好的做法
const result = await API.post('/api/assets/create', { groupId, url, name });
```

#### 2. **为什么需要自定义 Hook？**

- **逻辑复用**：列表加载、分页、搜索逻辑在多个列表组件间复用
- **清晰职责**：组件只负责 UI，Hook 负责数据管理
- **关注点分离**：便于维护和调试
- **测试友好**：Hook 可独立测试

**示例：**
```javascript
// ✅ 使用 Hook 自动处理分页、加载状态
const { assets, loading, pagination, goToPage } = useAssetList();

// ❌ 手动管理所有状态
const [assets, setAssets] = useState([]);
const [page, setPage] = useState(1);
const [loading, setLoading] = useState(false);
// ... 许多样板代码
```

#### 3. **为什么 API 都是 POST？**

后端统一设计为 POST 的好处：
- 避免 URL 参数长度限制
- 支持复杂的嵌套请求体
- 易于后续添加签名、加密等安全机制
- 便于记录和审计完整的请求体

#### 4. **全局错误处理的优势**

- 用户立即看到错误提示（Toast）
- 避免忘记在每个地方处理错误
- 统一的错误 UX（例如 401 自动重定向）
- 可在 Hook 中做额外的自定义处理

## 文件结构说明

```
web/src/
├── helpers/
│   ├── api.js                    # ⚙️ Axios 实例、全局拦截器
│   └── utils.jsx                 # ⚙️ showError, showSuccess 等工具
│
├── services/
│   ├── assetService.js           # 📦 素材管理 API 服务层（核心）
│   └── ASSET_SERVICE_GUIDE.md    # 📖 API 使用指南
│
├── hooks/
│   └── assets/
│       └── useAssetList.js       # 🎣 列表数据加载 Hook（核心）
│
├── components/
│   └── assets/
│       ├── AssetListExample.jsx  # 📝 完整使用示例
│       ├── AssetGroupList.jsx    # 🏗️ 分组列表
│       ├── AssetDetail.jsx       # 📄 素材详情
│       ├── AssetUpload.jsx       # ⬆️ 文件上传
│       └── ...
│
└── FRONTEND_API_ARCHITECTURE.md  # 本文件
```

## API 调用流程图

```
用户交互（搜索、翻页）
         │
         ▼
   组件事件处理
  (handleSearch, goToPage)
         │
         ▼
   更新 Hook 状态
(updateFilters, goToPage)
         │
         ▼
   Hook 重新加载数据
(useEffect 或 callback)
         │
         ▼
   调用服务函数
(listAssets from assetService)
         │
         ▼
   Service 调用 API
(API.post from Axios)
         │
         ▼
┌────────────────────┐
│ 请求自动处理：      │
│ - 注入 headers      │
│ - 去重（GET only）  │
│ - 全局错误处理      │
└────────────────────┘
         │
         ▼
   后端 API 处理
/api/assets/list (POST)
         │
         ▼
   返回统一格式响应
{ success, data, message }
         │
         ▼
   Hook 更新本地状态
(setAssets, setTotal, etc.)
         │
         ▼
   组件自动重新渲染
(React 状态更新)
         │
         ▼
   用户看到结果
```

## 核心概念解释

### 1. 幂等性和防重复

Axios 拦截器自动去重 GET 请求：
```javascript
// 同时发送两个相同的 GET 请求
const p1 = API.get('/api/list?page=1');
const p2 = API.get('/api/list?page=1'); // 复用 p1
// p1 === p2 // true（同一个 Promise）
```

**对 POST 请求的影响：** POST 请求不去重，需要由应用层处理重复提交（如禁用提交按钮）。

### 2. 错误分类

Axios 拦截器中的 `showError()` 按状态码分类：

| 状态码 | 含义 | 处理 |
|-------|------|------|
| 401 | 未授权 | 清除登录状态，重定向到登录页 |
| 429 | 限流 | 提示"请求次数过多，请稍后再试" |
| 500 | 服务器错误 | 提示"服务器内部错误，请联系管理员" |
| 其他 | 一般错误 | 显示错误消息 |

### 3. Hook 中的依赖管理

```javascript
const { assets, loading } = useAssetList({
  initialFilters: { groupId: '123' },
  pageSize: 10,
  sortBy: 'created_at'
});

// ✅ 依赖项变化时自动重新加载
// 修改 filters、pageSize、sortBy 时都会触发 useEffect
```

### 4. 乐观更新（Optimistic Updates）

当网络延迟较大时，可以先更新 UI，再等待后端响应：

```javascript
// 1. 立即更新本地状态
setAssets(assets.map(a =>
  a.id === id ? { ...a, ...updates } : a
));

// 2. 调用后端 API
const result = await updateAsset(id, updates);

// 3. 如果失败，回滚本地状态
if (!result.success) {
  setAssets(originalAssets);
}
```

## 最佳实践总结

### ✅ 推荐做法

1. **使用服务层**：所有 API 调用都通过 `assetService.js`
2. **使用 Hook**：列表数据加载使用 `useAssetList` Hook
3. **检查 success**：始终检查响应的 `success` 字段
4. **分离关注**：组件负责 UI，Hook 负责数据，Service 负责 API
5. **处理加载状态**：显示 Spin、Empty、Error 等状态
6. **避免手动 Axios**：不要在组件中直接使用 `API.post`

### ❌ 避免做法

1. **直接调用 Axios**：`API.post('/api/assets/list', ...)`
2. **在组件中处理所有状态**：应使用 Hook
3. **忽视错误**：不检查 `success` 字段
4. **混合关注点**：在组件中混入业务逻辑
5. **丢弃加载状态**：不处理 loading/error
6. **重复代码**：相同的 useEffect 逻辑应提取为 Hook

## 扩展指南

### 添加新的服务函数

1. 在 `services/assetService.js` 中添加函数：
```javascript
export async function newFunction(param1, param2) {
  const res = await API.post('/api/endpoint', { param1, param2 });
  return res.data;
}
```

2. 在组件或 Hook 中使用：
```javascript
import { newFunction } from '@/services/assetService';
const result = await newFunction(value1, value2);
```

### 添加新的列表 Hook

1. 复制 `useAssetList` 作为模板
2. 修改变量名和服务函数调用
3. 导出并使用

### 处理特殊的 API 需求

如果某个 API 需要特殊处理（如跳过全局错误处理）：

```javascript
// 在服务层中传递 skipErrorHandler
const res = await API.post('/api/endpoint', data, {
  skipErrorHandler: true
});

// 在组件中手动处理错误
try {
  const result = await someFunction();
  if (!result.success) {
    // 自定义错误处理
  }
} catch (err) {
  // 网络错误处理
}
```

## 性能考虑

### 1. 防去重缓存限制

防重复缓存仅对 GET 请求有效，时间较短（Promise lifecycle）。
- 场景：用户快速点击搜索按钮两次 → 自动去重
- 不适用：POST 请求的防重复（应在组件层禁用按钮）

### 2. 分页加载

使用 Hook 的 `goToPage()` 而非硬刷新：
```javascript
// ✅ 高效：仅加载新页面
goToPage(2);

// ❌ 浪费：重新加载第 1 页
refetch();
```

### 3. 防脑裂（Race Condition）

Hook 内部已处理，但要避免：
```javascript
// ❌ 危险：可能导致旧数据覆盖新数据
updateFilters({ name: 'a' });
updateFilters({ name: 'b' });
```

Hook 内部使用 `useCallback` 和 `useEffect` 依赖管理，确保正确的顺序。

## 总结

素材管理的 API 调用层遵循现有 new-api 前端的最佳实践：

1. **分层架构**：清晰的职责分离（Component → Hook → Service → API）
2. **统一设计**：响应格式、错误处理、Header 注入都统一
3. **代码复用**：相同逻辑提取为 Hook 和 Service
4. **用户体验**：全局 Toast 错误通知、加载状态处理
5. **可维护性**：遵循现有约定，易于新人上手
6. **可扩展性**：新增 API 或功能时无需改动现有代码

该架构充分利用了 React Hooks、Axios 拦截器和 Semi Design 的优势，为素材管理模块提供了坚实的基础。
