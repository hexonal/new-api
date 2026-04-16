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
import {
  CalendarDays,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
} from 'lucide-react';
import { Button } from '../../../primitives/button';
import { Input } from '../../../primitives/input';

function FilterLabel({ children }) {
  return (
    <label className='mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant'>
      {children}
    </label>
  );
}

function DateRangeField({ filters, updateField, t }) {
  return (
    <div className='min-w-[280px] flex-[1.15_1_0%]'>
      <FilterLabel>{t('时间范围')}</FilterLabel>
      <div className='flex h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3'>
        <CalendarDays className='h-4 w-4 shrink-0 text-on-surface-variant' />
        <input
          type='datetime-local'
          className='min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none'
          value={filters.from}
          onChange={(event) => updateField('from', event.target.value)}
        />
        <span className='text-xs text-on-surface-variant'>-</span>
        <input
          type='datetime-local'
          className='min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none'
          value={filters.to}
          onChange={(event) => updateField('to', event.target.value)}
        />
      </div>
    </div>
  );
}

export default function TaskLogsFilters({
  filters,
  setFilters,
  isAdminUser,
  loading,
  onSearch,
  onRefresh,
  onReset,
  onOpenColumns,
  t,
}) {
  const updateField = React.useCallback(
    (field, value) => {
      setFilters((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [setFilters],
  );

  return (
    <section className='rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm'>
      <div className='flex flex-wrap items-end gap-4'>
        <div className='min-w-[240px] flex-[1.05_1_0%]'>
          <FilterLabel>{t('Task ID')}</FilterLabel>
          <Input
            className='h-10 border-outline-variant bg-surface-container-low'
            value={filters.task_id}
            icon={<Search className='h-4 w-4' />}
            placeholder={t('Search Task ID...')}
            onChange={(event) => updateField('task_id', event.target.value)}
          />
        </div>

        <DateRangeField filters={filters} updateField={updateField} t={t} />

        {isAdminUser ? (
          <div className='w-full min-w-[170px] shrink-0 sm:w-[170px]'>
            <FilterLabel>{t('Channel ID')}</FilterLabel>
            <Input
              className='h-10 border-outline-variant bg-surface-container-low'
              value={filters.channel_id}
              placeholder={t('Channel ID')}
              onChange={(event) =>
                updateField('channel_id', event.target.value)
              }
            />
          </div>
        ) : null}

        <Button
          variant='outline'
          className='h-10 rounded-lg border-outline-variant bg-white px-4 text-on-surface hover:bg-surface-container-low'
          onClick={onRefresh}
          loading={loading}
        >
          <RefreshCw className='mr-2 h-4 w-4' />
          {t('刷新')}
        </Button>
        <Button
          className='h-10 rounded-lg bg-primary px-4 text-white hover:bg-primary-dim'
          onClick={onSearch}
          loading={loading}
        >
          <Search className='mr-2 h-4 w-4' />
          {t('查询')}
        </Button>
      </div>

      <div className='mt-4 flex flex-wrap items-center justify-end gap-2'>
        <Button
          variant='outline'
          className='h-9 rounded-lg border-outline-variant bg-white px-4 text-on-surface hover:bg-surface-container-low'
          onClick={onOpenColumns}
        >
          <Settings2 className='mr-2 h-4 w-4' />
          {t('列设置')}
        </Button>
        <Button
          variant='outline'
          className='h-9 rounded-lg border-outline-variant bg-white px-4 text-on-surface hover:bg-surface-container-low'
          onClick={onReset}
          disabled={loading}
        >
          <RotateCcw className='mr-2 h-4 w-4' />
          {t('重置')}
        </Button>
      </div>
    </section>
  );
}
