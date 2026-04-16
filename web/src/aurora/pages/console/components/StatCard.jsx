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
import { Badge } from '../../../primitives/badge';

const StatCard = ({
  title = '',
  value = 0,
  icon = null,
  description = '',
  trend = null,
  badgeText = '',
}) => (
  <div className='rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'>
    <div className='mb-4 flex items-start justify-between'>
      {icon ? (
        <div className='rounded-lg bg-indigo-50 p-2 text-indigo-600'>{icon}</div>
      ) : (
        <div />
      )}
      {badgeText ? (
        <Badge className='rounded-full border-0 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600'>
          {badgeText}
        </Badge>
      ) : null}
    </div>
    <div className='flex items-start justify-between'>
      <div>
        <p className='text-xs font-medium uppercase tracking-[0.16em] text-slate-500'>
          {title}
        </p>
        <p className='mt-1 text-2xl font-bold text-slate-900'>
          {typeof value === 'number' && isNaN(value) ? '—' : value}
        </p>
        {description ? (
          <p className='mt-1 text-xs text-slate-500'>{description}</p>
        ) : null}
        {trend != null ? (
          <p
            className={`mt-1 text-xs ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}
          >
            {trend >= 0 ? `+${trend}` : trend}
          </p>
        ) : null}
      </div>
    </div>
  </div>
);

export default StatCard;
