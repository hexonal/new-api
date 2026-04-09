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
import { Switch } from '../../../primitives/switch';

export default function ModelAdvanced({
  settings = {},
  onChange,
  title = '高级设置',
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3 text-sm'>
        <label className='flex items-center justify-between'>
          <span>流式响应</span>
          <Switch
            checked={Boolean(settings.streaming)}
            onCheckedChange={(value) => onChange?.('streaming', value)}
          />
        </label>
        <label className='flex items-center justify-between'>
          <span>开启思考链</span>
          <Switch
            checked={Boolean(settings.thinking)}
            onCheckedChange={(value) => onChange?.('thinking', value)}
          />
        </label>
      </CardContent>
    </Card>
  );
}
