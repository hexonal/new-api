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

export default function ChannelBasicInfo({
  values = {},
  onChange,
  editable = true,
}) {
  const { t } = useTranslation();
  const fields = [
    { key: 'name', label: t('名称'), placeholder: t('例如：openai-main') },
    { key: 'type', label: t('类型'), placeholder: t('例如：OpenAI') },
    { key: 'base_url', label: t('Base URL'), placeholder: 'https://api.openai.com/v1' },
    { key: 'api_key', label: t('API Key'), placeholder: t('输入密钥') },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('通道基础信息')}</CardTitle>
        <CardDescription>{t('表单会按字段变更回调，当前先做配置入口承接。')}</CardDescription>
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
