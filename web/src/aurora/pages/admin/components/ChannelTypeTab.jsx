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

import { Button } from '../../../primitives/button';

const DEFAULT_CHANNEL_TYPES = [
  { value: 'all', label: '全部' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
  { value: 'modes', label: '自定义模型' },
  { value: 'other', label: '其他' },
];

export default function ChannelTypeTab({
  value = 'all',
  options = DEFAULT_CHANNEL_TYPES,
  onChange,
  className = '',
  disabled = false,
}) {
  return (
    <div className={className}>
      <div className='flex flex-wrap gap-2'>
        {options.map((item) => {
          const isActive = item.value === value;
          return (
            <Button
              key={item.value}
              type='button'
              variant={isActive ? 'secondary' : 'outline'}
              size='sm'
              disabled={disabled}
              onClick={() => onChange?.(item.value)}
            >
              {item.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
