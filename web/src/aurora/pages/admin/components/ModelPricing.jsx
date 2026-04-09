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
import { Input } from '../../../primitives/input';

export default function ModelPricing({
  prices = { prompt: '', completion: '', multiplier: '' },
  onChange,
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('模型定价')}</CardTitle>
        <CardDescription>{t('以 USD/1M 为主，支持分字段配置')}</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-3'>
        <label className='block'>
          <div className='mb-1 text-xs text-muted-foreground'>{t('Prompt 费用')}</div>
          <Input
            value={prices.prompt}
            placeholder={t('prompt price')}
            onChange={(e) => onChange?.('prompt', e.target.value)}
          />
        </label>
        <label className='block'>
          <div className='mb-1 text-xs text-muted-foreground'>{t('Completion 费用')}</div>
          <Input
            value={prices.completion}
            placeholder={t('completion price')}
            onChange={(e) => onChange?.('completion', e.target.value)}
          />
        </label>
        <label className='block'>
          <div className='mb-1 text-xs text-muted-foreground'>{t('倍率')}</div>
          <Input
            value={prices.multiplier}
            placeholder={t('ratio')}
            onChange={(e) => onChange?.('multiplier', e.target.value)}
          />
        </label>
      </CardContent>
    </Card>
  );
}
