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

export default function UsageLogsColumnSelector({
  open,
  t,
  allSelectableChecked,
  someSelectableChecked,
  visibleColumnCount,
  selectableColumns,
  visibleColumns,
  onSelectAll,
  onToggleColumn,
  onReset,
  onClose,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm'>
      <div className='w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]'>
        <div className='flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5'>
          <div>
            <div className='text-lg font-semibold text-slate-900'>{t('列设置')}</div>
            <div className='mt-1 text-sm text-slate-600'>
              {t('选择使用日志主表中需要展示的列')}
            </div>
          </div>
          <button
            type='button'
            className='rounded-xl border border-slate-300 bg-white p-2 text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900'
            onClick={onClose}
            aria-label={t('关闭')}
          >
            <span className='block text-base leading-none'>×</span>
          </button>
        </div>

        <div className='space-y-6 bg-white px-6 py-5'>
          <div className='flex items-center justify-between gap-4'>
            <label className='flex items-center gap-3 text-sm font-semibold text-slate-900'>
              <input
                type='checkbox'
                className='h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30'
                checked={allSelectableChecked}
                ref={(node) => {
                  if (node) {
                    node.indeterminate = someSelectableChecked;
                  }
                }}
                onChange={(event) => onSelectAll(event.target.checked)}
              />
              <span>{t('全选')}</span>
            </label>
            <div className='text-xs font-medium text-slate-500'>
              {t('已选择 {{count}} 列', { count: visibleColumnCount })}
            </div>
          </div>

          <div className='grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3'>
            {selectableColumns.map((column) => (
              <label
                key={`selector-${column.key}`}
                className='flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-white'
              >
                <input
                  type='checkbox'
                  className='h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30'
                  checked={Boolean(visibleColumns?.[column.key])}
                  onChange={(event) =>
                    onToggleColumn(column.key, event.target.checked)
                  }
                />
                <span className='text-sm font-semibold text-slate-900'>
                  {typeof column.title === 'string'
                    ? column.title
                    : t(String(column.key))}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className='flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-5'>
          <button
            type='button'
            className='rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50'
            onClick={onReset}
          >
            {t('重置')}
          </button>
          <button
            type='button'
            className='rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50'
            onClick={onClose}
          >
            {t('取消')}
          </button>
          <button
            type='button'
            className='rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(79,70,229,0.22)] transition-colors hover:bg-primary/90'
            onClick={onClose}
          >
            {t('确定')}
          </button>
        </div>
      </div>
    </div>
  );
}
