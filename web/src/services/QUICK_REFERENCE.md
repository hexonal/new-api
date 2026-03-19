# 素材管理 API 调用层 — 快速参考卡

## 📦 导入

```javascript
// 服务层（API 调用）
import {
  createAsset,
  listAssets,
  updateAsset,
  deleteAsset,
  getAssetQuota
} from '@/services/assetService';

// Hook（数据加载）
import { useAssetList } from '@/hooks/assets/useAssetList';

// 工具函数（通知）
import { showError, showSuccess } from '@/helpers';
```

## 🎣 使用 Hook（推荐）

```javascript
// 素材列表加载
const {
  assets, loading, error,
  pagination, filters,
  updateFilters, goToPage, refetch
} = useAssetList({
  initialFilters: { groupId: '123' },
  pageSize: 10,
  sortBy: 'created_at',
  sortOrder: 'desc'
});

// 搜索
updateFilters({ ...filters, name_search: searchText });

// 翻页
goToPage(2);

// 刷新
await refetch();
```

## 🔧 使用服务函数

```javascript
// 创建素材
const res = await createAsset(groupId, 'https://...', '名称', {
  tags: ['tag1'],
  description: '描述'
});

// 获取列表
const res = await listAssets(
  { groupId: '123', name_search: 'test' },
  1,              // 页码
  10,             // 每页数量
  'created_at',   // 排序字段
  'desc'          // 排序顺序
);

// 获取单个
const res = await getAsset(assetId);

// 更新
const res = await updateAsset(assetId, {
  name: '新名称',
  metadata: { tags: ['new'] }
});

// 删除
const res = await deleteAsset(assetId);

// 批量删除
const res = await batchDeleteAssets([id1, id2, id3]);

// 上传文件
const res = await uploadAsset(file, groupId);

// 获取配额
const res = await getAssetQuota();

// 分享链接
const res = await getAssetShareLink(assetId, {
  expiresIn: 3600,
  maxAccesses: 100
});
```

## 📋 响应格式

```javascript
{
  success: true,                    // 是否成功
  data: { ... },                    // 返回数据
  message: '操作成功'                // 状态信息
}

// 使用方式
if (result.success) {
  console.log('成功:', result.data);
} else {
  console.error('失败:', result.message);
}
```

## 🛡️ 错误处理

```javascript
// 自动处理（推荐）
const result = await createAsset(...);
// API 错误会自动弹 Toast，无需手动处理

// 手动处理
try {
  const result = await createAsset(...);
  if (result.success) {
    showSuccess('创建成功');
  } else {
    showError('创建失败：' + result.message);
  }
} catch (error) {
  // 网络错误等
  console.error('网络错误:', error);
}
```

## 💾 实现完整的列表页

```javascript
import React, { useState, useCallback } from 'react';
import { Button, Spin, Empty, Input, Table, Pagination } from '@douyinfe/semi-ui';
import { useAssetList } from '@/hooks/assets/useAssetList';
import { deleteAsset } from '@/services/assetService';
import { showSuccess } from '@/helpers';

function AssetList() {
  const [search, setSearch] = useState('');
  const { assets, loading, error, pagination, updateFilters, goToPage, refetch }
    = useAssetList({ pageSize: 10 });

  const handleDelete = useCallback(async (id) => {
    if (window.confirm('确定要删除吗？')) {
      const result = await deleteAsset(id);
      if (result.success) {
        showSuccess('已删除');
        await refetch();
      }
    }
  }, [refetch]);

  const handleSearch = useCallback((text) => {
    setSearch(text);
    updateFilters({ name_search: text });
  }, [updateFilters]);

  if (loading) return <Spin />;
  if (error) return <Empty image="error" />;
  if (assets.length === 0) return <Empty image="empty" />;

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Button
          danger theme="light"
          onClick={() => handleDelete(record.id)}
        >
          删除
        </Button>
      )
    }
  ];

  return (
    <div>
      <Input.Search
        placeholder="搜索..."
        onChange={(e) => handleSearch(e.target.value)}
        style={{ marginBottom: 20, width: 300 }}
      />
      <Table dataSource={assets} columns={columns} pagination={false} />
      <Pagination
        currentPage={pagination.page}
        total={pagination.total}
        onChange={goToPage}
        style={{ marginTop: 20, textAlign: 'right' }}
      />
    </div>
  );
}

export default AssetList;
```

## 📂 分组管理

```javascript
import {
  createAssetGroup,
  listAssetGroups,
  updateAssetGroup,
  deleteAssetGroup,
  useAssetGroupList
} from '@/services/assetService';

// 创建分组
const res = await createAssetGroup('分组名', '描述');

// 获取列表（使用 Hook）
const { groups, loading, pagination, goToPage } = useAssetGroupList({
  pageSize: 15
});

// 更新分组
const res = await updateAssetGroup(groupId, {
  name: '新名称',
  description: '新描述'
});

// 删除分组
const res = await deleteAssetGroup(groupId);
```

## ⚡ 高性能模式

```javascript
// ✅ 防去重（自动）— GET 请求自动去重
const p1 = listAssets(...);
const p2 = listAssets(...);
// p1 === p2

// ✅ 乐观更新 — 先改本地，再调后端
const oldAssets = assets;
setAssets(assets.map(a => a.id === id ? {...a, ...updates} : a));
const result = await updateAsset(id, updates);
if (!result.success) {
  setAssets(oldAssets); // 失败回滚
}

// ✅ 批量操作 — 减少 API 调用
const res = await batchDeleteAssets([id1, id2, id3]);

// ✅ 避免 race condition — 使用 Hook 的依赖管理
const { assets, updateFilters } = useAssetList();
// Hook 内部自动处理 useEffect 依赖，确保顺序正确
```

## 🐛 常见错误

```javascript
// ❌ 错误：直接调用 API
const res = await API.post('/api/assets/list', ...);

// ✅ 正确：使用服务层
const res = await listAssets(...);

// ❌ 错误：忽视响应
const res = await createAsset(...);

// ✅ 正确：检查 success
if (res.success) { ... }

// ❌ 错误：手动处理所有状态
const [assets, setAssets] = useState([]);
const [loading, setLoading] = useState(false);
useEffect(() => { /* 复杂的加载逻辑 */ }, []);

// ✅ 正确：使用 Hook
const { assets, loading } = useAssetList();
```

## 📖 详细文档位置

- **使用指南**：`/web/src/services/ASSET_SERVICE_GUIDE.md`
- **架构文档**：`/web/src/FRONTEND_API_ARCHITECTURE.md`
- **示例代码**：`/web/src/components/assets/AssetListExample.jsx`

## 🚀 下一步

1. **在组件中集成**：import 服务函数和 Hook
2. **参考示例**：查看 AssetListExample.jsx
3. **调整参数**：根据实际需求修改 Hook options
4. **后端实现**：实现对应的 `/api/assets/*` 端点
