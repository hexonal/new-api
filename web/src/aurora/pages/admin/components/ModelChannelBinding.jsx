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

export default function ModelChannelBinding({
  channels = ['openai-main', 'google-main', 'anthropic-main'],
  selected = [],
  onChange,
}) {
  const set = new Set(selected);
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>模型绑定通道</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        {channels.map((item) => (
          <label className='flex items-center gap-2 text-sm border border-border rounded px-3 py-2' key={item}>
            <input
              type='checkbox'
              checked={set.has(item)}
              onChange={() => onChange?.(item, !set.has(item))}
            />
            <span>{item}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
