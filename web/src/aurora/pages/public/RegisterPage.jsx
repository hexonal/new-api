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
import { useTranslation } from 'react-i18next';
import RegisterForm from '../../../components/auth/RegisterForm';

const RegisterPage = () => {
  const { t } = useTranslation();

  return (
    <div className='aurora-auth-page'>
      <section className='aurora-auth-shell'>
        <div className='aurora-auth-card'>
          <div className='aurora-auth-header'>
            <h1>{t('创建账户')}</h1>
            <p>{t('注册后即可查看模型定价和快速开始')}</p>
          </div>
          <RegisterForm />
          <p className='aurora-auth-bottom-note'>
            {t('已有账户？')}
            <Link to='/login'>{t('立即登录')}</Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default RegisterPage;

