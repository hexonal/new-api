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
import { Button, Switch, Typography, Select } from '@douyinfe/semi-ui';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const ChannelsActions = ({
  enableBatchDelete,
  batchDeleteChannels,
  setShowBatchSetTag,
  testAllChannels,
  fixChannelsAbilities,
  updateAllChannelsBalance,
  deleteAllDisabledChannels,
  applyAllUpstreamUpdates,
  detectAllUpstreamUpdates,
  detectAllUpstreamUpdatesLoading,
  applyAllUpstreamUpdatesLoading,
  compactMode,
  setCompactMode,
  idSort,
  setIdSort,
  setEnableBatchDelete,
  enableTagMode,
  setEnableTagMode,
  statusFilter,
  setStatusFilter,
  getFormValues,
  loadChannels,
  searchChannels,
  activeTypeKey,
  activePage,
  pageSize,
  setActivePage,
  t,
}) => {
  const confirmThen = (message, onConfirm) => {
    if (window.confirm(message)) {
      onConfirm();
    }
  };

  const batchActionItems = [
    {
      label: t('测试所有未手动禁用渠道'),
      type: 'tertiary',
      loading: detectAllUpstreamUpdatesLoading,
      disabled: detectAllUpstreamUpdatesLoading,
      onClick: () => {
        confirmThen(t('确定要测试所有未手动禁用渠道吗？'), () =>
          testAllChannels(),
        );
      },
    },
    {
      label: t('修复数据库一致性'),
      type: 'tertiary',
      onClick: () => {
        confirmThen(
          t('进行该操作时，可能导致渠道访问错误，请仅在数据库出现问题时使用'),
          () => fixChannelsAbilities(),
        );
      },
    },
    {
      label: t('更新所有已启用通道余额'),
      type: 'secondary',
      onClick: () => {
        confirmThen(t('确定要更新所有已启用通道余额吗？'), () =>
          updateAllChannelsBalance(),
        );
      },
    },
    {
      label: t('检测全部渠道上游更新'),
      type: 'tertiary',
      onClick: () => {
        confirmThen(
          t('确定要仅检测全部渠道上游模型更新吗？（不执行新增/删除）'),
          () => detectAllUpstreamUpdates(),
        );
      },
    },
    {
      label: t('处理全部渠道上游更新'),
      type: 'primary',
      loading: applyAllUpstreamUpdatesLoading,
      disabled: applyAllUpstreamUpdatesLoading,
      onClick: () => {
        confirmThen(t('确定要对全部渠道执行上游模型更新吗？'), () =>
          applyAllUpstreamUpdates(),
        );
      },
    },
    {
      label: t('删除禁用通道'),
      type: 'danger',
      onClick: () => {
        confirmThen(t('此修改将不可逆'), () => deleteAllDisabledChannels());
      },
    },
  ];

  return (
    <div className='flex flex-col gap-2'>
      {/* 第一行：批量操作按钮 + 设置开关 */}
      <div className='flex flex-col md:flex-row justify-between gap-2'>
        {/* 左侧：批量操作按钮 */}
        <div className='flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto order-2 md:order-1'>
          <Button
            size='small'
            disabled={!enableBatchDelete}
            type='danger'
            className='w-full md:w-auto'
            onClick={() => {
              confirmThen(t('此修改将不可逆'), () => batchDeleteChannels());
            }}
          >
            {t('删除所选通道')}
          </Button>

          <Button
            size='small'
            disabled={!enableBatchDelete}
            type='tertiary'
            onClick={() => setShowBatchSetTag(true)}
            className='w-full md:w-auto'
          >
            {t('批量设置标签')}
          </Button>

          {batchActionItems.map((action, actionIndex) => (
            <Button
              key={`batch-action-inline-${actionIndex}`}
              size='small'
              type={action.type}
              className='w-full md:w-auto'
              loading={action.loading}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}

          <CompactModeToggle
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        </div>

        {/* 右侧：设置开关区域 */}
        <div className='flex flex-col md:flex-row items-start md:items-center gap-2 w-full md:w-auto order-1 md:order-2'>
          <div className='flex items-center justify-between w-full md:w-auto'>
            <Typography.Text strong className='mr-2'>
              {t('使用ID排序')}
            </Typography.Text>
            <Switch
              size='small'
              checked={idSort}
              onChange={(v) => {
                localStorage.setItem('id-sort', v + '');
                setIdSort(v);
                const { searchKeyword, searchGroup, searchModel } =
                  getFormValues();
                if (
                  searchKeyword === '' &&
                  searchGroup === '' &&
                  searchModel === ''
                ) {
                  loadChannels(activePage, pageSize, v, enableTagMode);
                } else {
                  searchChannels(
                    enableTagMode,
                    activeTypeKey,
                    statusFilter,
                    activePage,
                    pageSize,
                    v,
                  );
                }
              }}
            />
          </div>

          <div className='flex items-center justify-between w-full md:w-auto'>
            <Typography.Text strong className='mr-2'>
              {t('开启批量操作')}
            </Typography.Text>
            <Switch
              size='small'
              checked={enableBatchDelete}
              onChange={(v) => {
                localStorage.setItem('enable-batch-delete', v + '');
                setEnableBatchDelete(v);
              }}
            />
          </div>

          <div className='flex items-center justify-between w-full md:w-auto'>
            <Typography.Text strong className='mr-2'>
              {t('标签聚合模式')}
            </Typography.Text>
            <Switch
              size='small'
              checked={enableTagMode}
              onChange={(v) => {
                localStorage.setItem('enable-tag-mode', v + '');
                setEnableTagMode(v);
                setActivePage(1);
                loadChannels(1, pageSize, idSort, v);
              }}
            />
          </div>

          <div className='flex items-center justify-between w-full md:w-auto'>
            <Typography.Text strong className='mr-2'>
              {t('状态筛选')}
            </Typography.Text>
            <Select
              size='small'
              value={statusFilter}
              onChange={(v) => {
                localStorage.setItem('channel-status-filter', v);
                setStatusFilter(v);
                setActivePage(1);
                loadChannels(
                  1,
                  pageSize,
                  idSort,
                  enableTagMode,
                  activeTypeKey,
                  v,
                );
              }}
            >
              <Select.Option value='all'>{t('全部')}</Select.Option>
              <Select.Option value='enabled'>{t('已启用')}</Select.Option>
              <Select.Option value='disabled'>{t('已禁用')}</Select.Option>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelsActions;
