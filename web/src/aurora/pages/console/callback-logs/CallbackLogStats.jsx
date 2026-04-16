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

function StatCard({ stat, t }) {
  return (
    <div className='rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm'>
      <div className='mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-on-surface-variant'>
        {t(stat.labelKey)}
      </div>
      <div className='flex items-end justify-between gap-3'>
        <div className='text-2xl font-bold text-on-surface'>{stat.value}</div>
        <div className='text-[11px] font-semibold text-on-surface-variant'>
          {stat.delta}
        </div>
      </div>
      <div className='mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container'>
        <div
          className={`h-full rounded-full ${stat.progressClassName}`}
          style={{ width: `${Math.max(0, Math.min(100, stat.progress))}%` }}
        />
      </div>
    </div>
  );
}

export default function CallbackLogStats({ stats, t }) {
  return (
    <section className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
      {stats.map((stat) => (
        <StatCard key={stat.key} stat={stat} t={t} />
      ))}
    </section>
  );
}
