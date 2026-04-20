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

import React, { useMemo } from 'react';
import { Activity, Banknote, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '../../../primitives/card';
import { buildChannelSummaryCards } from './channel-view-model';

const CARD_META = {
  health: {
    title: 'Global Health',
    description: 'Enabled channels / total channels',
    icon: ShieldCheck,
    iconClassName: 'bg-emerald-50 text-emerald-600',
  },
  balance: {
    title: 'Total Balance',
    description: 'Aggregated valid balance values',
    icon: Banknote,
    iconClassName: 'bg-indigo-50 text-indigo-600',
  },
  latency: {
    title: 'Avg Latency',
    description: 'Average across finite tested channels',
    icon: Activity,
    iconClassName: 'bg-amber-50 text-amber-600',
  },
};

/**
 * 渲染渠道页顶部统计卡片。
 * @param {{channels: unknown[], t: (value: string) => string}} props - 组件属性
 * @returns {JSX.Element}
 */
export default function ChannelSummaryCards({ channels, t }) {
  const cards = useMemo(
    () => buildChannelSummaryCards({ channels, t }),
    [channels, t],
  );

  return (
    <div className='grid gap-4 xl:grid-cols-3'>
      {cards.map((card) => {
        const meta = CARD_META[card.id];
        const Icon = meta.icon;

        return (
          <Card
            key={card.id}
            className='rounded-[24px] border-slate-200/90 bg-white shadow-[0_22px_60px_-38px_rgba(15,23,42,0.35)]'
          >
            <CardContent className='p-5 md:p-6'>
              <div className='flex items-start justify-between gap-4'>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-[18px] ${meta.iconClassName}`}
                >
                  <Icon className='h-5 w-5' />
                </div>
                <div className='rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500'>
                  {t('概览')}
                </div>
              </div>
              <div className='mt-5 space-y-2'>
                <p className='text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400'>
                  {meta.title}
                </p>
                <p className='text-3xl font-black tracking-[-0.05em] text-slate-900 md:text-[2rem]'>
                  {card.value}
                </p>
                <p className='max-w-[28rem] text-sm leading-6 text-slate-500'>
                  {t(meta.description)}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
