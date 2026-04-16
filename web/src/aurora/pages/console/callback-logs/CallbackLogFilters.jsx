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
import { Search, RotateCcw } from 'lucide-react';
import { Button } from '../../../primitives/button';
import { Input } from '../../../primitives/input';

const STATUS_OPTIONS = [
  { value: '', labelKey: '全部状态' },
  { value: 'pending', labelKey: '待处理' },
  { value: 'processing', labelKey: '处理中' },
  { value: 'retry_wait', labelKey: '重试等待' },
  { value: 'succeeded', labelKey: '成功' },
  { value: 'dead', labelKey: '失败' },
  { value: 'cancelled', labelKey: '已取消' },
];

const SOURCE_OPTIONS = [
  { value: '', labelKey: '全部来源' },
  { value: 'consume', labelKey: '消费回调' },
  { value: 'operator', labelKey: '运营回调' },
  { value: 'feishu', labelKey: '飞书通知' },
  { value: 'user_points_guard', labelKey: '积分预扣校验' },
];

function FilterLabel({ children }) {
  return (
    <label className='mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant'>
      {children}
    </label>
  );
}

export default function CallbackLogFilters({
  filters,
  setFilters,
  onSearch,
  onReset,
  loading,
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
        <div className='min-w-[260px] flex-[1.4_1_0%]'>
          <FilterLabel>{t('Request ID')}</FilterLabel>
          <Input
            className='h-10 border-outline-variant bg-surface-container-low'
            value={filters.request_id}
            icon={<Search className='h-4 w-4' />}
            placeholder={t('Request ID...')}
            onChange={(event) => updateField('request_id', event.target.value)}
          />
        </div>

        <div className='w-full min-w-[180px] shrink-0 sm:w-[180px]'>
          <FilterLabel>{t('状态')}</FilterLabel>
          <select
            className='h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            value={filters.status}
            onChange={(event) => updateField('status', event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div className='w-full min-w-[180px] shrink-0 sm:w-[180px]'>
          <FilterLabel>{t('来源')}</FilterLabel>
          <select
            className='h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            value={filters.source}
            onChange={(event) => updateField('source', event.target.value)}
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div className='min-w-[220px] flex-[1_1_220px]'>
          <FilterLabel>{t('用户 ID / 名称')}</FilterLabel>
          <Input
            className='h-10 border-outline-variant bg-surface-container-low'
            value={filters.username}
            placeholder={t('Search user...')}
            onChange={(event) => updateField('username', event.target.value)}
          />
        </div>

        <Button
          variant='outline'
          className='h-10 rounded-lg border-outline-variant bg-white px-4 text-on-surface hover:bg-surface-container-low'
          onClick={onReset}
          disabled={loading}
        >
          <RotateCcw className='mr-2 h-4 w-4' />
          {t('重置')}
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
    </section>
  );
}
