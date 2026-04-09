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

import { Button } from '../../../primitives/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../primitives/card';

export default function ModelDangerZone({ onDelete, onDisable, title }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title || t('危险操作')}</CardTitle>
        <CardDescription>{t('对外部可见开关和删除操作')}</CardDescription>
      </CardHeader>
      <CardContent className='flex gap-2 flex-wrap'>
        <Button variant='destructive' onClick={onDisable}>
          {t('禁用模型')}
        </Button>
        <Button variant='destructive' onClick={onDelete}>
          {t('删除模型')}
        </Button>
      </CardContent>
    </Card>
  );
}
