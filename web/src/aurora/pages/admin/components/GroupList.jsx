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
import { useTranslation } from 'react-i18next';
import { Edit3, Filter, Plus } from 'lucide-react';
import { cn } from '../../../lib/cn';

function GroupRow({ name, active, memberCount, channelCount, onSelect }) {
  return (
    <button
      type='button'
      onClick={() => onSelect(name)}
      className={cn(
        'group flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all',
        active
          ? 'border-indigo-100 bg-indigo-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
          : 'border-transparent bg-transparent hover:bg-slate-50',
      )}
    >
      <div className='min-w-0'>
        <div
          className={cn(
            'truncate text-sm font-bold',
            active ? 'text-indigo-900' : 'text-slate-900',
          )}
        >
          {name}
        </div>
        <div
          className={cn(
            'mt-1 text-xs font-medium',
            active ? 'text-indigo-600' : 'text-slate-500',
          )}
        >
          {memberCount} 名成员
          <span className='mx-1.5 text-slate-300'>·</span>
          {channelCount} 个通道
        </div>
      </div>
      <span
        className={cn(
          'opacity-0 transition-all group-hover:opacity-100',
          active ? 'text-indigo-500' : 'text-slate-400',
        )}
      >
        <Edit3 className='h-4 w-4' />
      </span>
    </button>
  );
}

export default function GroupList({
  groups,
  selectedGroup,
  onSelect,
  memberCounts,
  channelCounts,
  onCreateGroup,
}) {
  const { t } = useTranslation();

  return (
    <aside className='flex min-h-[760px] w-full flex-col border-b border-[#e5e7eb] bg-white xl:min-w-[340px] xl:max-w-[380px] xl:border-b-0 xl:border-r'>
      <div className='flex items-center justify-between px-6 pb-4 pt-6'>
        <div className='flex items-center gap-2'>
          <h2 className='text-xl font-bold text-slate-900'>{t('分组')}</h2>
          <span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600'>
            {groups.length}
          </span>
        </div>
        <button
          type='button'
          className='p-2 text-slate-400 transition-colors hover:text-primary'
        >
          <Filter className='h-4 w-4' />
        </button>
      </div>

      <div className='flex-1 space-y-1 overflow-y-auto px-3 pb-3'>
        {groups.map((group) => (
          <GroupRow
            key={group}
            name={group}
            active={selectedGroup === group}
            memberCount={memberCounts[group] || 0}
            channelCount={channelCounts[group] || 0}
            onSelect={onSelect}
          />
        ))}

        {groups.length === 0 ? (
          <div className='rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500'>
            {t('当前筛选条件下没有分组')}
          </div>
        ) : null}
      </div>

      <div className='border-t border-slate-100 p-4'>
        <button
          type='button'
          onClick={onCreateGroup}
          className='flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700'
        >
          <Plus className='h-4 w-4' />
          {t('新增分组')}
        </button>
      </div>
    </aside>
  );
}
