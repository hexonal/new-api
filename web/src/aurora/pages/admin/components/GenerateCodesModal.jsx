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

export default function GenerateCodesModal({
  visible = false,
  codeList = [],
  onGenerate,
  onClose,
}) {
  const { t } = useTranslation();
  if (!visible) {
    return <Button onClick={onGenerate}>{t('生成兑换码')}</Button>;
  }

  return (
    <section className='rounded-lg border border-border bg-card/70 p-4 space-y-3'>
      <div className='font-medium'>{t('兑换码列表')}</div>
      <ul className='space-y-1 text-sm'>
        {codeList.length ? (
          codeList.map((code) => <li key={code}>{code}</li>)
        ) : (
          <li className='text-muted-foreground'>{t('暂无')}</li>
        )}
      </ul>
      <div className='flex gap-2 justify-end'>
        <Button variant='outline' onClick={onClose}>{t('关闭')}</Button>
      </div>
    </section>
  );
}
