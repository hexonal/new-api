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

import { Progress } from '../../../primitives/progress';

export default function QuotaProgressBar({
  used = 0,
  total = 0,
  unit = '额度',
  title = '配额',
  className = '',
}) {
  const safeTotal = Number(total || 0);
  const safeUsed = Number(used || 0);
  const percent = safeTotal > 0 ? Math.min(100, Math.max(0, (safeUsed / safeTotal) * 100)) : 0;

  return (
    <section className={`rounded-lg border border-border bg-card/70 p-4 ${className}`}>
      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>{title}</span>
        <span className='text-xs text-muted-foreground'>
          {safeUsed.toLocaleString()} / {safeTotal.toLocaleString()} {unit}
        </span>
      </div>
      <Progress value={percent} className='mt-3' />
      <div className='mt-2 text-xs text-muted-foreground text-right'>
        使用率 {percent.toFixed(1)}%
      </div>
    </section>
  );
}
