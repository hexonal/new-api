/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Pagination,
  Spin,
  Modal,
  Space,
  Empty,
  Select,
  Row,
  Col,
  Form,
} from '@douyinfe/semi-ui';
import { Delete, Edit, Eye, Copy } from 'lucide-react';
import { useAssetList } from '@/hooks/assets/useAssetList';
import {
  createAsset,
  deleteAsset,
  updateAsset,
  getAssetShareLink,
} from '@/services/assetService';
import { showError, showSuccess, copy } from '@/helpers';

/**
 * 素材列表示例组件
 * 演示如何使用 API 服务层和自定义 Hook
 */
function AssetListExample() {
  // 1. 使用 useAssetList Hook 处理数据加载和状态管理
  const {
    assets,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    goToPage,
    refetch,
  } = useAssetList({
    initialFilters: { groupId: 'default' },
    pageSize: 10,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  // 2. 组件内部状态（仅保存 UI 相关状态）
  const [searchText, setSearchText] = useState('');
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  // 3. 搜索处理
  const handleSearch = useCallback(
    (value) => {
      setSearchText(value);
      updateFilters({
        ...filters,
        name_search: value,
      });
    },
    [filters, updateFilters],
  );

  // 4. 编辑素材
  const handleEdit = useCallback((asset) => {
    setEditingAsset(asset);
    setEditName(asset.name);
    setEditModalVisible(true);
  }, []);

  // 5. 保存编辑
  const handleSaveEdit = useCallback(async () => {
    if (!editName.trim()) {
      showError('请输入素材名称');
      return;
    }

    setEditSaving(true);
    try {
      const result = await updateAsset(editingAsset.id, {
        name: editName,
      });

      if (result.success) {
        showSuccess('素材已更新');
        setEditModalVisible(false);
        await refetch(); // 刷新列表
      }
    } finally {
      setEditSaving(false);
    }
  }, [editingAsset, editName, refetch]);

  // 6. 删除素材
  const handleDelete = useCallback(
    (assetId) => {
      Modal.confirm({
        title: '确认删除',
        content: '删除后无法恢复，确定要删除此素材吗？',
        onOk: async () => {
          const result = await deleteAsset(assetId);
          if (result.success) {
            showSuccess('素材已删除');
            await refetch();
          }
        },
      });
    },
    [refetch],
  );

  // 7. 获取分享链接
  const handleShare = useCallback(async (asset) => {
    try {
      const result = await getAssetShareLink(asset.id, {
        expiresIn: 3600,
        maxAccesses: 100,
      });

      if (result.success) {
        setShareUrl(result.data.shareUrl);
        setShareModalVisible(true);
      }
    } catch (err) {
      showError('获取分享链接失败');
    }
  }, []);

  // 8. 复制分享链接
  const handleCopyShare = useCallback(async () => {
    const success = await copy(shareUrl);
    if (success) {
      showSuccess('链接已复制');
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }, [shareUrl]);

  // 9. 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: '30%',
    },
    {
      title: '预览',
      dataIndex: 'url',
      key: 'url',
      width: '20%',
      render: (text) => (
        <a href={text} target="_blank" rel="noopener noreferrer">
          <Eye size={16} />
        </a>
      ),
    },
    {
      title: '大小',
      dataIndex: 'metadata.size',
      key: 'size',
      width: '10%',
      render: (text) => (text ? `${(text / 1024 / 1024).toFixed(2)} MB` : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '15%',
      render: (text) => new Date(text).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: '20%',
      render: (_, record) => (
        <Space>
          <Button
            type="tertiary"
            size="small"
            icon={<Edit size={14} />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="tertiary"
            size="small"
            icon={<Copy size={14} />}
            onClick={() => handleShare(record)}
          >
            分享
          </Button>
          <Button
            type="danger"
            theme="light"
            size="small"
            icon={<Delete size={14} />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 10. 渲染
  return (
    <Card title="素材管理" style={{ margin: '20px' }}>
      {/* 搜索栏 */}
      <Row gutter={16} style={{ marginBottom: '20px' }}>
        <Col span={12}>
          <Input.Search
            placeholder="搜索素材名称"
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            enterButton
            style={{ width: '100%' }}
          />
        </Col>
      </Row>

      {/* 加载状态 */}
      {loading && <Spin />}

      {/* 错误状态 */}
      {error && !loading && (
        <Empty
          image="error"
          title="加载失败"
          description={error}
          style={{ paddingTop: '50px', paddingBottom: '50px' }}
        />
      )}

      {/* 数据表格 */}
      {!loading && !error && assets.length > 0 && (
        <div>
          <Table
            dataSource={assets}
            columns={columns}
            pagination={false}
            rowKey="id"
            rowSelection={{
              selectedRowKeys: selectedAssets,
              onChange: setSelectedAssets,
            }}
          />

          {/* 分页 */}
          <div style={{ marginTop: '20px', textAlign: 'right' }}>
            <Pagination
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onChange={goToPage}
            />
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!loading && !error && assets.length === 0 && (
        <Empty
          image="empty"
          title="没有素材"
          description="还没有创建任何素材"
          style={{ paddingTop: '50px', paddingBottom: '50px' }}
        />
      )}

      {/* 编辑对话框 */}
      <Modal
        title="编辑素材"
        visible={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={editSaving}
      >
        <Form layout="vertical">
          <Form.Input
            field="name"
            label="素材名称"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </Form>
      </Modal>

      {/* 分享链接对话框 */}
      <Modal
        title="分享素材"
        visible={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        footer={[
          <Button key="copy" type="primary" onClick={handleCopyShare}>
            {shareCopied ? '已复制' : '复制链接'}
          </Button>,
        ]}
      >
        <Input value={shareUrl} readOnly suffix={<Copy size={14} />} />
      </Modal>
    </Card>
  );
}

export default AssetListExample;
