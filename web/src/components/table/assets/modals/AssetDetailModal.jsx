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
import { Button, SideSheet, Spin, Typography } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { timestamp2string } from '../../../../helpers';
import {
  getAssetDisplayName,
  getAssetReference,
  renderAssetStatusTag,
} from '../AssetsColumnDefs';

const { Text } = Typography;

const renderField = (label, value) => {
  return (
    <div className='flex flex-col gap-1 p-3 rounded-lg bg-[var(--semi-color-fill-0)]'>
      <Text type='tertiary' size='small'>
        {label}
      </Text>
      <Text>{value || '-'}</Text>
    </div>
  );
};

const AssetDetailModal = ({
  visible,
  loading,
  asset,
  onClose,
  onCopyReference,
  t,
}) => {
  const reference = getAssetReference(asset);
  const errorCode =
    asset?.error?.code ||
    asset?.error_code ||
    asset?.Error?.Code ||
    asset?.errorCode;
  const errorMessage =
    asset?.error?.message ||
    asset?.error_message ||
    asset?.Error?.Message ||
    asset?.errorMessage;

  return (
    <SideSheet
      title={t('素材详情')}
      placement='right'
      visible={visible}
      width={560}
      onCancel={onClose}
    >
      {loading ? (
        <div className='py-16 flex items-center justify-center'>
          <Spin size='large' />
        </div>
      ) : (
        <div className='flex flex-col gap-3'>
          <div className='rounded-xl overflow-hidden border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)]'>
            {asset?.url || asset?.URL ? (
              <img
                src={asset?.url || asset?.URL}
                alt={asset?.name || asset?.Name || t('素材预览')}
                className='w-full max-h-[360px] object-contain'
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className='h-56 flex items-center justify-center text-[var(--semi-color-text-2)]'>
                {t('无预览')}
              </div>
            )}
          </div>

          {String(asset?.status || '').toLowerCase() === 'failed' &&
            (errorCode || errorMessage) && (
              <div className='rounded-lg border border-[var(--semi-color-danger)] bg-[var(--semi-color-danger-light-default)] p-3'>
                <Text type='danger' strong>
                  {t('处理失败')}
                </Text>
                <div className='mt-1'>
                  <Text type='danger'>
                    {`${t('错误码')}: ${errorCode || '-'}`}
                  </Text>
                </div>
                <div>
                  <Text type='danger'>
                    {`${t('错误信息')}: ${errorMessage || '-'}`}
                  </Text>
                </div>
              </div>
            )}

          <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
            {renderField(t('素材名称'), getAssetDisplayName(asset, t))}
            {renderField(t('状态'), renderAssetStatusTag(asset?.status, t))}
            {renderField(t('分组'), asset?.group_name || asset?.group?.name || '-')}
            {renderField(
              t('创建时间'),
              asset?.created_at || asset?.createTime
                ? timestamp2string(asset?.created_at || asset?.createTime)
                : '-',
            )}
          </div>

          <div className='rounded-lg border border-[var(--semi-color-border)] p-3'>
            <div className='flex items-center justify-between gap-2'>
              <Text type='tertiary' size='small'>
                {t('素材引用')}
              </Text>
              <Button
                size='small'
                type='tertiary'
                icon={<IconCopy />}
                onClick={() => onCopyReference(asset)}
              >
                {t('复制')}
              </Button>
            </div>
            <Text
              className='mt-2 block break-all rounded-md bg-[var(--semi-color-fill-0)] px-2 py-1'
            >
              {reference || '-'}
            </Text>
          </div>
        </div>
      )}
    </SideSheet>
  );
};

export default AssetDetailModal;
