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
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PasswordResetForm from '../../../components/auth/PasswordResetForm';
import PasswordResetConfirm from '../../../components/auth/PasswordResetConfirm';

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const hasToken = Boolean(searchParams.get('token') && searchParams.get('email'));

  return (
    <div className='aurora-auth-page'>
      <section className='aurora-auth-shell'>
        <div className='aurora-auth-card aurora-reset-card'>
          <div className='aurora-auth-header'>
            <h1>{hasToken ? t('重置密码') : t('请求重置密码')}</h1>
            <p>
              {hasToken
                ? t('请设置新密码，系统已验证重置邮箱身份')
                : t('填写邮箱获取重置链接')}
            </p>
          </div>

          {hasToken ? <PasswordResetConfirm /> : <PasswordResetForm />}
        </div>
      </section>
    </div>
  );
};

export default ResetPasswordPage;

