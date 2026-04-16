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
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FolderKanban, Network, Server } from 'lucide-react';

function getChannelTypeLabel(type, t) {
  const text = String(type ?? '').trim();

  if (!text) {
    return t('未知类型');
  }
  if (/azure|claude|gemini|openai/i.test(text)) {
    return text;
  }
  return text;
}

function getChannelStatus(channel, t) {
  return channel?.status === 1 ? t('启用') : t('停用');
}

function getChannelIcon(channel) {
  return /relay|proxy|hub/i.test(String(channel?.type || channel?.name || ''))
    ? Network
    : Server;
}

function ChannelCard({ channel, t }) {
  const Icon = getChannelIcon(channel);

  return (
    <div className='flex items-center justify-between rounded-2xl border border-slate-100 p-4 transition-colors hover:border-indigo-200'>
      <div className='flex min-w-0 items-center gap-3'>
        <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700'>
          <Icon className='h-4 w-4' />
        </div>
        <div className='min-w-0'>
          <div className='truncate text-sm font-bold text-slate-900'>
            {channel.name || channel.id || '-'}
          </div>
          <div className='mt-1 flex flex-wrap items-center gap-1.5'>
            <span className='rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500'>
              {getChannelTypeLabel(channel.type, t)}
            </span>
            <span className='inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600'>
              <span
                className={`h-1.5 w-1.5 rounded-full ${channel?.status === 1 ? 'bg-emerald-500' : 'bg-slate-300'}`}
              />
              {getChannelStatus(channel, t)}
            </span>
          </div>
        </div>
      </div>
      <button
        type='button'
        className='text-slate-400 transition-colors hover:text-primary'
      >
        <ChevronRight className='h-4 w-4' />
      </button>
    </div>
  );
}

export default function GroupChannelsTable({ channels }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <FolderKanban className='h-4 w-4 text-slate-400' />
          <h3 className='text-sm font-bold uppercase tracking-[0.22em] text-slate-500'>
            {t('绑定通道')}
          </h3>
        </div>
        <button
          type='button'
          onClick={() => navigate('/console/channel')}
          className='text-sm font-bold text-indigo-600 transition-colors hover:text-indigo-800'
        >
          {t('查看全部通道')}
        </button>
      </div>

      {channels.length ? (
        <div className='grid gap-4 md:grid-cols-2'>
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id || channel.name}
              channel={channel}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className='rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500'>
          {t('当前分组还没有绑定通道')}
        </div>
      )}
    </div>
  );
}
