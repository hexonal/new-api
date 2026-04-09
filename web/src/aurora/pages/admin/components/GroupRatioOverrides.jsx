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

export default function GroupRatioOverrides({
  values = {},
  title,
  description,
  className = '',
}) {
  const { t } = useTranslation();
  const entries = Object.entries(values || {});

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className='text-base'>{title || t('分组倍率覆盖')}</CardTitle>
        <CardDescription>{description || t('优先于默认倍率生效，未配置时回退系统默认。')}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length ? (
          <div className='space-y-2'>
            {entries.map(([model, ratio]) => (
              <div
                key={model}
                className='flex items-center justify-between rounded border border-border px-3 py-2 text-sm'
              >
                <span>{model}</span>
                <span className='font-medium'>{String(ratio)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>{t('暂无覆盖配置')}</p>
        )}
      </CardContent>
    </Card>
  );
}
