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

import React from 'react';
import { Button, Dropdown, Empty, Input, Modal, Spin, Typography } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
import { showError } from '../../../helpers';
import {
  getAssetDisplayName,
  renderAssetStatusTag,
} from './AssetsColumnDefs';

const { Text } = Typography;

const AssetCard = ({
  asset,
  onViewDetail,
  onCopyReference,
  onRename,
  onDelete,
  t,
}) => {
  const assetId = asset.id || asset.Id;
  const assetUrl = asset.url || asset.URL;

  const handleRename = () => {
    let newName = asset.name || asset.Name || '';
    Modal.confirm({
      title: t('重命名素材'),
      content: (
        <Input
          defaultValue={newName}
          placeholder={t('请输入素材名称')}
          onChange={(value) => {
            newName = value;
          }}
        />
      ),
      onOk: async () => {
        const nextName = newName?.trim();
        if (!nextName) {
          showError(t('素材名称不能为空'));
          return Promise.reject(new Error('empty-name'));
        }
        await onRename(assetId, nextName);
      },
    });
  };

  const handleDelete = () => {
    Modal.confirm({
      title: t('确认删除'),
      content: t('确定要删除此素材吗？'),
      onOk: async () => {
        await onDelete(assetId);
      },
    });
  };

  return (
    <div className='rounded-xl border border-[var(--semi-color-border)] overflow-hidden bg-[var(--semi-color-bg-1)]'>
      <div className='aspect-square bg-[var(--semi-color-fill-0)] overflow-hidden'>
        {assetUrl ? (
          <img
            src={assetUrl}
            alt={asset.name || asset.Name || t('素材预览')}
            className='w-full h-full object-cover'
            loading='lazy'
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className='h-full w-full flex items-center justify-center text-[var(--semi-color-text-2)] text-sm'>
            {t('无预览')}
          </div>
        )}
      </div>

      <div className='p-3'>
        <div className='flex items-start justify-between gap-2'>
          <Text strong ellipsis={{ showTooltip: true }} className='max-w-[70%]'>
            {getAssetDisplayName(asset, t)}
          </Text>
          <Dropdown
            trigger='click'
            position='bottomRight'
            menu={[
              {
                node: 'item',
                name: t('查看详情'),
                onClick: () => onViewDetail(asset),
              },
              {
                node: 'item',
                name: t('复制引用'),
                onClick: () => onCopyReference(asset),
              },
              {
                node: 'item',
                name: t('重命名'),
                onClick: handleRename,
              },
              {
                node: 'item',
                name: t('删除'),
                type: 'danger',
                onClick: handleDelete,
              },
            ]}
          >
            <Button icon={<IconMore />} size='small' type='tertiary' />
          </Dropdown>
        </div>
        <div className='mt-2'>{renderAssetStatusTag(asset.status || asset.Status, t)}</div>
      </div>
    </div>
  );
};

const AssetsTable = ({
  assets,
  loading,
  onViewDetail,
  onCopyReference,
  onRename,
  onDelete,
  t,
}) => {
  if (loading && assets.length === 0) {
    return (
      <div className='py-16 flex items-center justify-center'>
        <Spin size='large' />
      </div>
    );
  }

  if (!loading && assets.length === 0) {
    return (
      <Empty
        description={t('暂无素材')}
        style={{ paddingTop: 48, paddingBottom: 48 }}
      />
    );
  }

  return (
    <div className='grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3'>
      {assets.map((asset) => (
        <AssetCard
          key={asset.id || asset.Id}
          asset={asset}
          onViewDetail={onViewDetail}
          onCopyReference={onCopyReference}
          onRename={onRename}
          onDelete={onDelete}
          t={t}
        />
      ))}
    </div>
  );
};

export default AssetsTable;
