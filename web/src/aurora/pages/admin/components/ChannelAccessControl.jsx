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

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../primitives/card';

export default function ChannelAccessControl({
  items = ['gpt-4.1', 'claude-3-5-sonnet', 'gemini-2.0'],
  allowed = [],
  onChange,
  title = '访问控制',
  description = '控制该通道可见/可调用的对象',
}) {
  const selected = new Set(allowed || []);
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
        {items.map((name) => {
          const checked = selected.has(name);
          return (
            <label key={name} className='flex items-center gap-2 text-sm border rounded border-border px-3 py-2'>
              <input
                type='checkbox'
                checked={checked}
                onChange={() => onChange?.(name, !checked)}
              />
              <span>{name}</span>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}
