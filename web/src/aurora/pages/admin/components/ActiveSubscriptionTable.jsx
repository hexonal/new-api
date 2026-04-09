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

export default function ActiveSubscriptionTable({
  items = [],
  title = '当前订阅',
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <div className='space-y-2'>
            {items.map((item) => (
              <div
                key={item.id || item.name}
                className='rounded border border-border px-3 py-2 text-sm flex justify-between'
              >
                <span>{item.name || item.plan || '未命名订阅'}</span>
                <span className='text-muted-foreground'>{item.status || '未生效'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>暂无活跃订阅</p>
        )}
      </CardContent>
    </Card>
  );
}
