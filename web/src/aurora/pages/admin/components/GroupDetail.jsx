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

export default function GroupDetail({ data = {}, title = '分组详情' }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{data.name || data.username || '未命名'}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-1 text-sm'>
        <p>ID：{data.id || '-'}</p>
        <p>名称：{data.name || '-'}</p>
        <p>类型：{data.type || '-'}</p>
        <p>状态：{data.status || '-'}</p>
      </CardContent>
    </Card>
  );
}
