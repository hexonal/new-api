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
import { createPortal } from 'react-dom';
import TwoFAVerification from '../../../components/auth/TwoFAVerification';
import { useTranslation } from 'react-i18next';

const TwoFactorOverlay = ({ onSuccess, onBack, open = false }) => {
  const { t } = useTranslation();

  if (!open) {
    return null;
  }

  return createPortal(
    <div className='aurora-2fa-overlay'>
      <div className='aurora-2fa-overlay-card'>
        <h3>{t('两步验证')}</h3>
        <p>{t('请输入 6 位验证码或 8 位备用码完成登录')}</p>
        <TwoFAVerification onSuccess={onSuccess} onBack={onBack} isModal />
      </div>
    </div>,
    document.body,
  );
};

export default TwoFactorOverlay;
