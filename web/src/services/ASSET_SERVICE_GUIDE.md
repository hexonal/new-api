# 素材管理 API 调用层设计指南

## 概述

这个文档描述了前端素材管理模块的 API 调用架构，包括服务层设计、Hook 使用、错误处理和最佳实践。

## 架构

```
UI Components
    ↓
Custom Hooks (useAssetList, useAssetGroupList)
    ↓
Service Layer (assetService.js)
    ↓
API Interceptor (helpers/api.js)
    ↓
Backend REST APIs (all POST)
```

## API 基础设置

### 自动化 Headers

所有请求自动附加以下 headers（由 `helpers/api.js` 处理）：

```javascript
{
  'New-API-User': <当前用户ID>,
  'Cache-Control': 'no-store'
}
```

### 基础 URL

通过环境变量 `VITE_REACT_APP_SERVER_URL` 配置，默认为当前域名。

### 响应格式统一

所有 API 返回统一的 JSON 格式：

```javascript
{
  success: boolean,      // 请求是否成功
  data: any,            // 返回的数据（失败时可能为 null）
  message: string       // 状态信息或错误描述
}
```

## 服务层 API

### 分组管理

#### 创建分组

```javascript
import { createAssetGroup } from '@/services/assetService';

const result = await createAssetGroup('我的分组', '素材分组描述');
if (result.success) {
  console.log('创建成功:', result.data);
  // { id, name, description, created_at, updated_at }
} else {
  console.error('创建失败:', result.message);
}
```

#### 获取分组列表

```javascript
import { listAssetGroups } from '@/services/assetService';

const result = await listAssetGroups(
  { name_search: 'test' },  // 筛选条件（可选）
  1,                         // 页码
  10                        // 每页数量
);
if (result.success) {
  console.log(result.data); // { groups: [...], total, page, pageSize }
}
```

#### 获取分组详情

```javascript
import { getAssetGroup } from '@/services/assetService';

const result = await getAssetGroup(groupId);
if (result.success) {
  console.log(result.data);
  // { id, name, description, created_at, updated_at, asset_count }
}
```

#### 更新分组

```javascript
import { updateAssetGroup } from '@/services/assetService';

const result = await updateAssetGroup(groupId, {
  name: '新名称',
  description: '新描述'
});
```

#### 删除分组

```javascript
import { deleteAssetGroup } from '@/services/assetService';

const result = await deleteAssetGroup(groupId);
```

### 素材管理

#### 创建素材

```javascript
import { createAsset } from '@/services/assetService';

const result = await createAsset(
  groupId,  // 分组 ID
  'https://example.com/image.jpg',  // 素材 URL
  '图片名称',  // 名称
  {  // 元数据（可选）
    width: 1920,
    height: 1080,
    type: 'image',
    tags: ['tag1', 'tag2'],
    description: '素材描述'
  }
);
```

#### 批量创建素材

```javascript
import { batchCreateAssets } from '@/services/assetService';

const result = await batchCreateAssets(groupId, [
  { url: 'http://...', name: '素材1' },
  { url: 'http://...', name: '素材2', metadata: { tags: ['video'] } }
]);
if (result.success) {
  console.log(`创建 ${result.data.created} 个，失败 ${result.data.failed} 个`);
}
```

#### 上传文件

```javascript
import { uploadAsset } from '@/services/assetService';

const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

const result = await uploadAsset(file, groupId);
if (result.success) {
  console.log('上传成功，URL:', result.data.url);
  // { url, fileId, name, size, uploadedAt }
}
```

#### 获取素材列表

```javascript
import { listAssets } from '@/services/assetService';

const result = await listAssets(
  {
    groupId: '123',
    name_search: 'test',
    tags: ['tag1'],
    status: 'active'
  },
  1,              // 页码
  10,             // 每页数量
  'created_at',   // 排序字段
  'desc'          // 排序顺序
);
```

#### 获取单个素材详情

```javascript
import { getAsset } from '@/services/assetService';

const result = await getAsset(assetId);
if (result.success) {
  console.log(result.data);
  // { id, groupId, url, name, metadata, created_at, updated_at, access_count }
}
```

#### 更新素材

```javascript
import { updateAsset } from '@/services/assetService';

const result = await updateAsset(assetId, {
  name: '新名称',
  metadata: { tags: ['newtag'] }
});
```

#### 删除素材

```javascript
import { deleteAsset } from '@/services/assetService';

const result = await deleteAsset(assetId);
```

#### 批量删除素材

```javascript
import { batchDeleteAssets } from '@/services/assetService';

const result = await batchDeleteAssets([assetId1, assetId2]);
if (result.success) {
  console.log(`已删除 ${result.data.deleted} 个素材`);
}
```

### 配额与分享

#### 获取配额信息

```javascript
import { getAssetQuota } from '@/services/assetService';

const result = await getAssetQuota();
if (result.success) {
  const { totalQuota, usedQuota, remaining, maxAssets, quotaUnit } = result.data;
  console.log(`已使用: ${usedQuota} / ${totalQuota}`);
}
```

#### 获取分享链接

```javascript
import { getAssetShareLink } from '@/services/assetService';

const result = await getAssetShareLink(assetId, {
  expiresIn: 3600,      // 分享链接过期时间（秒）
  maxAccesses: 100      // 最多访问次数
});
if (result.success) {
  console.log('分享链接:', result.data.shareUrl);
}
```

#### 删除分享链接

```javascript
import { deleteAssetShareLink } from '@/services/assetService';

const result = await deleteAssetShareLink(assetId, shareToken);
```

## 自定义 Hook 使用

### useAssetList - 素材列表加载

```javascript
import { useAssetList } from '@/hooks/assets/useAssetList';

function AssetListComponent() {
  const {
    assets,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    goToPage,
    refetch
  } = useAssetList({
    initialFilters: { groupId: '123' },
    pageSize: 20,
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  const handleSearch = (searchText) => {
    updateFilters({ ...filters, name_search: searchText });
  };

  const handlePageChange = (page) => {
    goToPage(page);
  };

  if (loading) return <Spin />;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {/* 渲染 assets 列表 */}
      <Pagination
        currentPage={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        onChange={handlePageChange}
      />
    </div>
  );
}
```

### useAssetGroupList - 分组列表加载

```javascript
import { useAssetGroupList } from '@/hooks/assets/useAssetList';

function GroupListComponent() {
  const {
    groups,
    loading,
    pagination,
    updateFilters,
    goToPage,
    refetch
  } = useAssetGroupList({
    initialFilters: {},
    pageSize: 15
  });

  if (loading) return <Spin />;

  return (
    <div>
      {groups.map(group => (
        <div key={group.id}>{group.name}</div>
      ))}
      <Pagination
        currentPage={pagination.page}
        total={pagination.total}
        onChange={goToPage}
      />
    </div>
  );
}
```

## 错误处理模式

### 全局错误处理

所有 API 请求的错误会自动通过 `showError()` 显示 Toast 通知：

```javascript
import { showError } from '@/helpers';

// API 错误会自动弹出 Toast，无需手动处理
const result = await createAsset(...);
```

### 手动错误处理

如果需要自定义错误处理，可以检查响应的 `success` 字段：

```javascript
const result = await createAsset(...);
if (!result.success) {
  console.error('自定义错误处理:', result.message);
  // 自定义逻辑
} else {
  console.log('操作成功');
}
```

### Axios 错误捕获

某些情况下可能需要捕获网络错误：

```javascript
try {
  const result = await createAsset(...);
  if (result.success) {
    // 处理成功
  }
} catch (error) {
  // 网络错误或请求异常
  if (error.response?.status === 401) {
    // 未授权，重定向到登录页
  }
}
```

## 最佳实践

### 1. 使用服务层而非直接调用 API

❌ 不要这样做：
```javascript
const res = await API.post('/api/assets/list', { ... });
```

✅ 应该这样做：
```javascript
import { listAssets } from '@/services/assetService';
const result = await listAssets(...);
```

### 2. 用 Hook 处理列表数据加载

❌ 不要这样做：
```javascript
const [assets, setAssets] = useState([]);
useEffect(() => {
  const load = async () => {
    const res = await API.post('/api/assets/list', ...);
    setAssets(res.data.assets);
  };
  load();
}, []);
```

✅ 应该这样做：
```javascript
const { assets, loading } = useAssetList({
  initialFilters: { ... }
});
```

### 3. 始终检查 success 字段

```javascript
const result = await createAssetGroup('name');
if (result.success) {
  // 处理成功情况
} else {
  // 失败已由全局 showError 处理，可选地做额外逻辑
}
```

### 4. 分离关注点

- **组件**：只负责 UI 和用户交互
- **Hook**：负责数据加载、状态管理和生命周期
- **服务层**：负责 API 调用封装
- **Helper**：负责通用工具函数（如 showError）

### 5. 合理使用缓存

Hook 中已内置防重复请求逻辑（见 `helpers/api.js` 的 `disableDuplicate` 选项）：

```javascript
// 同时发送两个相同的 GET 请求，会自动去重
const p1 = listAssets({ ... }, 1, 10);
const p2 = listAssets({ ... }, 1, 10); // 会复用 p1 的 Promise
```

### 6. 处理加载状态

```javascript
const { assets, loading } = useAssetList();

return (
  <div>
    {loading && <Spin />}
    {!loading && assets.length === 0 && <Empty />}
    {!loading && assets.length > 0 && <AssetTable data={assets} />}
  </div>
);
```

## 文件结构

```
web/src/
├── services/
│   ├── assetService.js          # 素材管理服务层
│   └── ASSET_SERVICE_GUIDE.md   # 本文件
├── hooks/
│   └── assets/
│       └── useAssetList.js      # 列表加载 Hook
├── helpers/
│   └── api.js                   # API 实例和全局设置
└── components/
    └── assets/
        └── (素材管理相关组件)
```

## 常见问题

### Q: 为什么所有 API 都是 POST？

A: 后端统一设计为 POST，便于处理复杂的请求体和后续扩展。

### Q: 如何自定义错误提示？

A: 在调用时检查 `result.success`，或使用 try-catch 捕获异常：

```javascript
try {
  const result = await createAsset(...);
  if (!result.success) {
    // 自定义错误处理
    Toast.warning('请稍后重试');
  }
} catch (err) {
  // 网络错误处理
}
```

### Q: 如何实现乐观更新？

A: 先更新本地状态，再调用 API，失败时回滚：

```javascript
const originalAssets = assets;
setAssets(assets.map(a => a.id === id ? {...a, ...updates} : a));

const result = await updateAsset(id, updates);
if (!result.success) {
  setAssets(originalAssets); // 回滚
}
```

### Q: 如何处理大批量导入？

A: 使用 `batchCreateAssets` 并处理部分失败：

```javascript
const result = await batchCreateAssets(groupId, assets);
if (result.success) {
  Toast.success(`成功创建 ${result.data.created} 个，失败 ${result.data.failed} 个`);
  if (result.data.errors?.length > 0) {
    // 展示失败详情
    console.log('失败列表:', result.data.errors);
  }
}
```
