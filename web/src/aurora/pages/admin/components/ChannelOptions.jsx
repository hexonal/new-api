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

import { Card, CardContent, CardHeader, CardTitle } from '../../../primitives/card';
import { Input } from '../../../primitives/input';

export default function ChannelOptions({
  options = {},
  onChange,
  title = '通道参数',
}) {
  const entries = Object.entries(options);
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {entries.length ? (
          entries.map(([key, value]) => (
            <label className='block' key={key}>
              <div className='text-xs text-muted-foreground mb-1'>{key}</div>
              <Input
                value={String(value ?? '')}
                onChange={(event) => onChange?.(key, event.target.value)}
              />
            </label>
          ))
        ) : (
          <p className='text-sm text-muted-foreground'>未配置参数</p>
        )}
      </CardContent>
    </Card>
  );
}
