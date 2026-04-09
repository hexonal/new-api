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

export default function GroupChannelsTable({ channels = [] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>分组通道</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        {channels.length ? (
          channels.map((item) => (
            <div key={item.id || item.name} className='rounded border border-border px-3 py-2 text-sm'>
              <span>{item.name || item.id}</span>
              <span className='text-muted-foreground ml-3'>{item.type || 'N/A'}</span>
            </div>
          ))
        ) : (
          <p className='text-sm text-muted-foreground'>未绑定通道</p>
        )}
      </CardContent>
    </Card>
  );
}
