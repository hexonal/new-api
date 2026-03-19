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
import { Tag } from '@douyinfe/semi-ui';
import { Loader2 } from 'lucide-react';

const normalizeStatus = (status) => String(status || '').toLowerCase();

export const getAssetDisplayName = (asset, t) => {
  return asset?.name || asset?.Name || t('未命名素材');
};

export const getAssetReference = (asset) => {
  const upstreamId =
    asset?.UpstreamAssetId ||
    asset?.UpstreamAssetID ||
    asset?.AssetId ||
    asset?.AssetID ||
    asset?.upstreamAssetId ||
    asset?.upstream_asset_id ||
    asset?.Id ||
    asset?.asset_id ||
    asset?.assetId ||
    asset?.id;
  return upstreamId ? `asset://${upstreamId}` : '';
};

export const renderAssetStatusTag = (status, t) => {
  const normalized = normalizeStatus(status);
  if (normalized === 'active') {
    return (
      <Tag color='green' shape='circle' size='small'>
        {t('可用')}
      </Tag>
    );
  }

  if (normalized === 'processing') {
    return (
      <Tag
        color='blue'
        shape='circle'
        size='small'
        prefixIcon={<Loader2 size={12} className='animate-spin' />}
      >
        {t('处理中')}
      </Tag>
    );
  }

  if (normalized === 'failed') {
    return (
      <Tag color='red' shape='circle' size='small'>
        {t('失败')}
      </Tag>
    );
  }

  return (
    <Tag color='grey' shape='circle' size='small'>
      {t('未知')}
    </Tag>
  );
};
