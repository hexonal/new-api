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

export default function ChannelModelConfig({
  model = '',
  models = ['gpt-4.1', 'claude-3-5-sonnet', 'gemini-2.0'],
  onChange,
  disabled = false,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>模型配置</CardTitle>
        <CardDescription>默认模型和可选模型入口</CardDescription>
      </CardHeader>
      <CardContent className='space-y-2 text-sm'>
        <label className='block'>
          <div className='mb-1 text-muted-foreground'>默认模型</div>
          <select
            className='h-9 rounded border border-input bg-background px-3 w-full'
            value={model}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.value)}
          >
            <option value=''>请选择</option>
            {models.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className='text-muted-foreground'>模型数量：{models.length}</div>
      </CardContent>
    </Card>
  );
}
