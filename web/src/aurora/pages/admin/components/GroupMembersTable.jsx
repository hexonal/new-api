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
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '../../../primitives/card';

export default function GroupMembersTable({ users = [] }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('分组成员')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          {users.length ? (
            users.map((user) => (
              <div key={user.id || user.username} className='flex justify-between rounded border border-border px-3 py-2 text-sm'>
                <span>{user.username || user.name}</span>
                <span className='text-muted-foreground'>{user.role || t('成员')}</span>
              </div>
            ))
          ) : (
            <p className='text-sm text-muted-foreground'>{t('暂无成员')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
