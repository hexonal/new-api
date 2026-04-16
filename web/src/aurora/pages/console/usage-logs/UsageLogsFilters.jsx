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
import { CalendarDays, Search, SlidersHorizontal } from 'lucide-react';
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
      <div className='flex flex-col gap-3 xl:flex-row xl:items-center'>
        <label className='relative min-w-0 flex-1 xl:max-w-[340px]'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant' />
          <input
            className='w-full rounded-lg border border-outline-variant bg-white py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            placeholder={t('Search by Request ID...')}
            value={filters.request_id}
            onChange={(event) => updateFilter('request_id', event.target.value)}
          />
        </label>

        <div className='grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:flex xl:flex-nowrap xl:items-center'>
          <div className='flex min-w-0 items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'>
            <CalendarDays className='h-4 w-4 shrink-0 text-on-surface-variant' />
            <input
              type='datetime-local'
              className='min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none'
              value={filters.from}
              onChange={(event) => updateFilter('from', event.target.value)}
            />
            <span className='text-xs text-on-surface-variant'>-</span>
            <input
              type='datetime-local'
              className='min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none'
              value={filters.to}
              onChange={(event) => updateFilter('to', event.target.value)}
            />
          </div>

          <input
            className='min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 xl:min-w-[144px]'
            placeholder={t('All Models')}
            value={filters.model_name}
            onChange={(event) => updateFilter('model_name', event.target.value)}
          />

          {(data.isAdminUser || filters.username) && (
            <input
              className='min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 xl:min-w-[128px]'
              placeholder={t('All Users')}
              value={filters.username}
              onChange={(event) => updateFilter('username', event.target.value)}
            />
          )}

          {(data.isAdminUser || filters.channel) && (
            <input
              className='min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 xl:min-w-[128px]'
              placeholder={t('All Channels')}
              value={filters.channel}
              onChange={(event) => updateFilter('channel', event.target.value)}
            />
          )}

          <label className='min-w-0 xl:min-w-[120px]'>
            <select
              className='w-full rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
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

          <button
            type='button'
            className='flex min-w-[122px] items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60 xl:ml-auto'
            onClick={handleExport}
            disabled={data.loading || (data.logs || []).length === 0}
          >
            <IconDownload size='small' />
            Export
          </button>
        </div>
      </div>

      <div className='mt-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
        <div className='grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
          <input
            className='min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            placeholder='Token Name'
            value={filters.token_name}
            onChange={(event) => updateFilter('token_name', event.target.value)}
          />

          {data.isAdminUser || data.showGroupForNonAdmin ? (
            <input
              className='min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
              placeholder='Group'
              value={filters.group}
              onChange={(event) => updateFilter('group', event.target.value)}
            />
          ) : null}

          {(data.isAdminUser || data.showPricingGroupForNonAdmin) && (
            <input
              className='min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
              placeholder='Pricing Group'
              value={filters.pricing_group}
              onChange={(event) =>
                updateFilter('pricing_group', event.target.value)
              }
            />
          )}
        </div>

        <div className='flex flex-wrap items-center justify-end gap-2 lg:pl-6'>
          <span className='inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant'>
            <SlidersHorizontal className='h-3.5 w-3.5' />
            Advanced Filters
          </span>
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
        </div>
      </div>
    </section>
  );
}
