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
import { AtSign, KeyRound, Lock } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API, showError, showInfo, showSuccess } from '../../../helpers';
import { Button } from '../../primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../primitives/card';
import { Input } from '../../primitives/input';

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const emailFromLink = searchParams.get('email') || '';
  const hasToken = Boolean(token && emailFromLink);
  const [requestEmail, setRequestEmail] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [generatedPassword, setGeneratedPassword] = React.useState('');

  const handleRequestReset = async (event) => {
    event.preventDefault();
    if (!requestEmail) {
      showInfo(t('请输入邮箱地址'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.get(
        `/api/reset_password?email=${encodeURIComponent(requestEmail.trim())}`,
      );
      const { success, message } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess(t('重置邮件已发送，请检查邮箱'));
      setRequestEmail('');
    } catch (error) {
      showError(t('发送失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (event) => {
    event.preventDefault();
    if (!newPassword || !confirmPassword) {
      showInfo(t('请输入新密码并确认'));
      return;
    }
    if (newPassword !== confirmPassword) {
      showInfo(t('两次输入的新密码不一致'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/user/reset', {
        email: emailFromLink,
        token,
        password: newPassword,
      });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      if (typeof data === 'string' && data.length > 0 && data !== newPassword) {
        setGeneratedPassword(data);
        showInfo(t('当前服务端返回了系统生成密码，请使用下方结果登录后再修改'));
      } else {
        setGeneratedPassword('');
      }
      showSuccess(t('密码重置成功'));
    } catch (error) {
      showError(t('重置失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='aurora-auth-page'>
      <section className='w-full'>
        <Card className='mx-auto w-full max-w-[420px] border-border bg-white shadow-sm'>
          <CardHeader className='space-y-2 pb-4'>
            <CardTitle className='text-2xl'>
              {hasToken ? t('设置新密码') : t('请求重置密码')}
            </CardTitle>
            <CardDescription>
              {hasToken
                ? t('请输入并确认新密码以完成重置')
                : t('输入邮箱，系统会发送重置链接')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {!hasToken && (
              <form className='space-y-3' onSubmit={handleRequestReset}>
                <Input
                  type='email'
                  value={requestEmail}
                  onChange={(event) => setRequestEmail(event.target.value)}
                  placeholder={t('邮箱地址')}
                  icon={<AtSign size={16} />}
                />
                <Button type='submit' className='w-full' loading={loading}>
                  {t('发送重置链接')}
                </Button>
              </form>
            )}

            {hasToken && (
              <form className='space-y-3' onSubmit={handleConfirmReset}>
                <Input type='email' value={emailFromLink} readOnly icon={<AtSign size={16} />} />
                <Input type='text' value={token} readOnly icon={<KeyRound size={16} />} />
                <Input
                  type='password'
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={t('新密码')}
                  icon={<Lock size={16} />}
                />
                <Input
                  type='password'
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t('确认新密码')}
                  icon={<Lock size={16} />}
                />
                <Button type='submit' className='w-full' loading={loading}>
                  {t('确认重置')}
                </Button>
                {generatedPassword && (
                  <div className='rounded-lg border border-border bg-muted/20 p-3 text-sm'>
                    <p className='mb-1 font-medium'>{t('系统生成的新密码')}</p>
                    <p className='break-all font-mono text-foreground'>{generatedPassword}</p>
                  </div>
                )}
              </form>
            )}

            <p className='aurora-auth-bottom-note'>
              <Link to='/login'>{t('返回登录')}</Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default ResetPasswordPage;
