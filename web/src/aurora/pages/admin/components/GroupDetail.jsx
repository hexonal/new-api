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
import { Badge } from '../../../primitives/badge';
import { FolderTree, PencilLine } from 'lucide-react';

export default function GroupDetail({
  groupName,
  description,
  memberCount,
  channelCount,
  isSystemGroup,
  hasUnsavedChanges,
}) {
  const { t } = useTranslation();

  return (
    <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
      <div className='flex items-start gap-4'>
        <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600'>
          <FolderTree className='h-6 w-6' />
        </div>
        <div className='space-y-2'>
          <div className='flex items-center gap-2'>
            <h1 className='text-2xl font-black tracking-tight text-slate-900'>
              {groupName}
            </h1>
            <button
              type='button'
              className='text-slate-400 transition-colors hover:text-indigo-600'
            >
              <PencilLine className='h-4 w-4' />
            </button>
          </div>
          <p className='max-w-2xl text-sm font-medium text-slate-500'>
            {description}
          </p>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge
              variant='outline'
              className='rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-600'
            >
              {t('{{count}} 名成员', { count: memberCount })}
            </Badge>
            <Badge
              variant='outline'
              className='rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-600'
            >
              {t('{{count}} 个通道', { count: channelCount })}
            </Badge>
            {hasUnsavedChanges ? (
              <Badge className='rounded-full bg-amber-100 px-3 py-1 text-amber-800'>
                {t('有未保存变更')}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className='flex gap-2'>
        {isSystemGroup ? (
          <span className='rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700'>
            {t('SYSTEM')}
          </span>
        ) : (
          <span className='rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600'>
            {t('CUSTOM')}
          </span>
        )}
      </div>
    </div>
  );
}
