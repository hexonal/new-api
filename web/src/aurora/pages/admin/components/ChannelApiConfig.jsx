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

export default function ChannelApiConfig({
  values = {},
  onChange,
  title = 'API 配置',
  disabled = false,
}) {
  const fields = [
    { key: 'base_url', label: 'Base URL', placeholder: 'https://api.example.com' },
    { key: 'api_key', label: 'API Key', placeholder: '输入密钥' },
    { key: 'timeout', label: '超时时间(ms)', placeholder: '30000' },
    { key: 'retry', label: '重试次数', placeholder: '2' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {fields.map((field) => (
          <label className='block' key={field.key}>
            <div className='text-xs text-muted-foreground mb-1'>{field.label}</div>
            <Input
              value={String(values[field.key] ?? '')}
              placeholder={field.placeholder}
              disabled={disabled}
              onChange={(e) => onChange?.(field.key, e.target.value)}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
