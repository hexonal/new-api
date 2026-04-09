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

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../primitives/card';

export default function GroupDetail({ data = {}, title }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title || t('分组详情')}</CardTitle>
        <CardDescription>{data.name || data.username || t('未命名')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-1 text-sm'>
        <p>{t('ID：')}{data.id || '-'}</p>
        <p>{t('名称：')}{data.name || '-'}</p>
        <p>{t('类型：')}{data.type || '-'}</p>
        <p>{t('状态：')}{data.status || '-'}</p>
      </CardContent>
    </Card>
  );
}
