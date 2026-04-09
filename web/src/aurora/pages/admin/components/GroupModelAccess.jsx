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

const DEFAULT_ITEMS = [
  'mj_imagine',
  'mj_variation',
  'gpt-4.1',
  'claude-3-5-sonnet',
  'gemini-2.0-flash',
];

export default function GroupModelAccess({
  groupName = '未命名分组',
  selected = [],
  options = DEFAULT_ITEMS,
  onChange,
  disabled = false,
}) {
  const { t } = useTranslation();
  const normalizeSelected = new Set((selected || []).filter(Boolean));

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('模型访问控制')}</CardTitle>
        <CardDescription>
          {t('为分组')} {groupName} {t('选择可调用的模型')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2'>
          {options.map((item) => {
            const checked = normalizeSelected.has(item);
            return (
              <label
                key={item}
                className='flex items-center gap-2 rounded border border-border bg-muted/20 px-3 py-2 text-sm'
              >
                <input
                  type='checkbox'
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange?.(item, !checked)}
                />
                <span>{item}</span>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
