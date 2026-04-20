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
    <Card className='rounded-[20px] border-slate-200/90 bg-white shadow-[0_12px_28px_-24px_rgba(15,23,42,0.24)]'>
      <CardContent className='p-3 md:p-4'>
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
          {cards.map((card) => {
            const meta = CARD_META[card.id];
            const Icon = meta.icon;

            return (
              <div
                key={card.id}
                className='rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3'
              >
                <div className='flex items-center gap-3'>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${meta.iconClassName}`}
                  >
                    <Icon className='h-4 w-4' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400'>
                      {meta.title}
                    </p>
                    <div className='mt-1 flex items-end gap-2'>
                      <p className='truncate text-2xl font-black leading-none tracking-[-0.05em] text-slate-900'>
                        {card.value}
                      </p>
                      <span className='mb-0.5 hidden rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 md:inline-flex'>
                        {t('实时')}
                      </span>
                    </div>
                    <p className='mt-1 truncate text-xs text-slate-500'>
                      {t(meta.description)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
