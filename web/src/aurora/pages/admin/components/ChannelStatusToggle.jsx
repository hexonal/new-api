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

import { Switch } from '../../../primitives/switch';

export default function ChannelStatusToggle({
  checked = false,
  loading = false,
  disabled = false,
  onChange,
  label = '启用状态',
  description = '开启后该通道可被路由使用。',
}) {
  return (
    <div className='rounded-lg border border-border bg-card/70 p-3'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <h4 className='text-sm font-medium'>{label}</h4>
          <p className='text-xs text-muted-foreground mt-1'>{description}</p>
        </div>
        <Switch
          checked={Boolean(checked)}
          disabled={disabled || loading}
          onCheckedChange={onChange}
        />
      </div>
      {loading ? <p className='mt-2 text-xs text-muted-foreground'>更新中...</p> : null}
    </div>
  );
}
