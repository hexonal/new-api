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
import { IconDownload } from '@douyinfe/semi-icons';
import { STATUS_FILTER_OPTIONS } from './page-utils';

export default function UsageLogsFilters({
  t,
  data,
  filters,
  updateFilter,
  handleLogTypeChange,
  handleSearch,
  handleReset,
  handleExport,
}) {
  return (
    <section className='rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm'>
      <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
        <label className='flex min-w-0 flex-col gap-1 xl:col-span-2'>
          <span className='text-xs font-medium text-on-surface-variant'>
            {t('开始时间')}
          </span>
          <input
            type='datetime-local'
            className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            value={filters.from}
            onChange={(event) => updateFilter('from', event.target.value)}
          />
        </label>

        <label className='flex min-w-0 flex-col gap-1'>
          <span className='text-xs font-medium text-on-surface-variant'>
            {t('结束时间')}
          </span>
          <input
            type='datetime-local'
            className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            value={filters.to}
            onChange={(event) => updateFilter('to', event.target.value)}
          />
        </label>

        <label className='flex min-w-0 flex-col gap-1'>
          <span className='text-xs font-medium text-on-surface-variant'>
            {t('令牌名称')}
          </span>
          <input
            className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            placeholder={t('令牌名称')}
            value={filters.token_name}
            onChange={(event) => updateFilter('token_name', event.target.value)}
          />
        </label>

        <label className='flex min-w-0 flex-col gap-1'>
          <span className='text-xs font-medium text-on-surface-variant'>
            {t('模型名称')}
          </span>
          <input
            className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            placeholder={t('模型名称')}
            value={filters.model_name}
            onChange={(event) => updateFilter('model_name', event.target.value)}
          />
        </label>

        {(data.isAdminUser || data.showGroupForNonAdmin) && (
          <label className='flex min-w-0 flex-col gap-1'>
            <span className='text-xs font-medium text-on-surface-variant'>
              {t('分组')}
            </span>
            <input
              className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
              placeholder={t('分组')}
              value={filters.group}
              onChange={(event) => updateFilter('group', event.target.value)}
            />
          </label>
        )}

        {(data.isAdminUser || data.showPricingGroupForNonAdmin) && (
          <label className='flex min-w-0 flex-col gap-1'>
            <span className='text-xs font-medium text-on-surface-variant'>
              {t('定价分组')}
            </span>
            <input
              className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
              placeholder={t('定价分组')}
              value={filters.pricing_group}
              onChange={(event) =>
                updateFilter('pricing_group', event.target.value)
              }
            />
          </label>
        )}

        <label className='flex min-w-0 flex-col gap-1'>
          <span className='text-xs font-medium text-on-surface-variant'>
            {t('Request ID')}
          </span>
          <input
            className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            placeholder={t('Request ID')}
            value={filters.request_id}
            onChange={(event) => updateFilter('request_id', event.target.value)}
          />
        </label>

        {data.isAdminUser && (
          <label className='flex min-w-0 flex-col gap-1'>
            <span className='text-xs font-medium text-on-surface-variant'>
              {t('渠道 ID')}
            </span>
            <input
              className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
              placeholder={t('渠道 ID')}
              value={filters.channel}
              onChange={(event) => updateFilter('channel', event.target.value)}
            />
          </label>
        )}

        {data.isAdminUser && (
          <label className='flex min-w-0 flex-col gap-1'>
            <span className='text-xs font-medium text-on-surface-variant'>
              {t('用户名称')}
            </span>
            <input
              className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
              placeholder={t('用户名称')}
              value={filters.username}
              onChange={(event) => updateFilter('username', event.target.value)}
            />
          </label>
        )}
      </div>

      <div className='mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <label className='flex min-w-[160px] flex-col gap-1'>
          <span className='text-xs font-medium text-on-surface-variant'>
            {t('日志类型')}
          </span>
          <select
            className='rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            value={filters.logType}
            onChange={(event) => handleLogTypeChange(event.target.value)}
          >
            {STATUS_FILTER_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {t(item.label)}
              </option>
            ))}
          </select>
        </label>

        <div className='flex flex-wrap items-center justify-end gap-2'>
          <button
            type='button'
            className='rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container'
            onClick={handleSearch}
            disabled={data.loading}
          >
            {t('查询')}
          </button>

          <button
            type='button'
            className='rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container'
            onClick={handleReset}
            disabled={data.loading}
          >
            {t('重置')}
          </button>

          <button
            type='button'
            className='rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container'
            onClick={() => data.setShowColumnSelector(true)}
          >
            {t('列设置')}
          </button>

          <button
            type='button'
            className='flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60'
            onClick={handleExport}
            disabled={data.loading || (data.logs || []).length === 0}
          >
            <IconDownload size='small' />
            Export
          </button>
        </div>
      </div>
    </section>
  );
}
