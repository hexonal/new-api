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

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../primitives/card';
import { Input } from '../../../primitives/input';

export default function ModelBasicInfo({
  values = {},
  onChange,
  editable = true,
}) {
  const { t } = useTranslation();
  const fields = [
    { key: 'name', label: t('模型名称'), placeholder: t('例如：gpt-4.1') },
    { key: 'provider', label: t('Provider'), placeholder: t('OpenAI / Google / Azure') },
    { key: 'max_tokens', label: t('最大 token'), placeholder: t('输入数字') },
    { key: 'support', label: t('支持能力'), placeholder: t('chat / image / video') },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('模型基础信息')}</CardTitle>
        <CardDescription>{t('先保留字段入口，便于后续接入提交校验逻辑。')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {fields.map((item) => (
          <label className='block' key={item.key}>
            <div className='text-xs text-muted-foreground mb-1'>{item.label}</div>
            <Input
              value={values[item.key] || ''}
              placeholder={item.placeholder}
              disabled={!editable}
              onChange={(e) => onChange?.(item.key, e.target.value)}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
