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

export default function ChannelPromptOverride({
  systemPrompt = '',
  userPrompt = '',
  onChange,
  disabled = false,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>提示词覆写</CardTitle>
        <CardDescription>系统提示词与用户提示词前缀配置</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <label className='block'>
          <div className='mb-1 text-xs text-muted-foreground'>系统提示词</div>
          <textarea
            className='w-full min-h-24 rounded border border-input bg-background px-3 py-2 text-sm'
            value={systemPrompt}
            disabled={disabled}
            onChange={(e) => onChange?.('system_prompt', e.target.value)}
          />
        </label>
        <label className='block'>
          <div className='mb-1 text-xs text-muted-foreground'>用户提示词前缀</div>
          <textarea
            className='w-full min-h-20 rounded border border-input bg-background px-3 py-2 text-sm'
            value={userPrompt}
            disabled={disabled}
            onChange={(e) => onChange?.('user_prompt', e.target.value)}
          />
        </label>
      </CardContent>
    </Card>
  );
}
