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
import { Link } from 'react-router-dom';
import { AuthRedirect } from '../../../helpers';
import LoginForm from '../../../components/auth/LoginForm';
import { useTranslation } from 'react-i18next';

const LoginPage = () => {
  const { t } = useTranslation();

  return (
    <AuthRedirect>
      <div className='aurora-auth-page'>
        <section className='aurora-auth-shell'>
          <div className='aurora-auth-card'>
            <div className='aurora-auth-header'>
              <h1>{t('登录你的账户')}</h1>
              <p>{t('使用邮箱/用户名或第三方渠道快速进入')}</p>
            </div>
            <LoginForm />
            <p className='aurora-auth-bottom-note'>
              {t('没有账户？')}
              <Link to='/register'>{t('立即注册')}</Link>
            </p>
          </div>
        </section>
      </div>
    </AuthRedirect>
  );
};

export default LoginPage;

