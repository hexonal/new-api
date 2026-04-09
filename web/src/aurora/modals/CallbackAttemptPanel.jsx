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
import ModalShell from './ModalShell';

export default function CallbackAttemptPanel({ open = false, onClose = () => {}, onConfirm }) {
  return (
    <ModalShell
      open={open}
      title={t('Callback Attempts')}
      description={t('Aurora placeholder modal shell. Replace with actual form and action handlers.')}
      confirmLabel={t('确定')}
      cancelLabel={t('取消')}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <p className='text-sm text-gray-600'>
        {t('模块文件：')}<strong>{t('CallbackAttemptPanel')}</strong>
      </p>
    </ModalShell>
  );
}
