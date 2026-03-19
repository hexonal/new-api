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
import { Button, Space, Typography } from '@douyinfe/semi-ui';

const { Text } = Typography;

const formatQuotaText = (quota, t) => {
  if (!quota) return t('配额信息加载中');
  const used = quota.used ?? quota.used_quota ?? quota.usedQuota;
  const total = quota.total ?? quota.total_quota ?? quota.totalQuota;
  const count = quota.asset_count ?? quota.assetCount ?? quota.used_assets;

  if (typeof used === 'number' && typeof total === 'number') {
    return `${t('配额')}：${used} / ${total}`;
  }
  if (typeof count === 'number') {
    return `${t('素材数量')}：${count}`;
  }
  return t('配额信息已更新');
};

const AssetsActions = ({
  quota,
  quotaLoading,
  onOpenCreateGroup,
  onOpenUpload,
  onRefresh,
  t,
}) => {
  return (
    <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-2 w-full'>
      <Space wrap>
        <Button size='small' type='primary' theme='solid' onClick={onOpenCreateGroup}>
          {t('创建分组')}
        </Button>
        <Button size='small' type='primary' theme='light' onClick={onOpenUpload}>
          {t('上传素材')}
        </Button>
        <Button size='small' type='tertiary' onClick={onRefresh}>
          {t('刷新')}
        </Button>
      </Space>
      <Text
        type='tertiary'
        className={quotaLoading ? 'opacity-70' : ''}
      >
        {quotaLoading ? t('配额加载中...') : formatQuotaText(quota, t)}
      </Text>
    </div>
  );
};

export default AssetsActions;
