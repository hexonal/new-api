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
import { AtSign, KeyRound, Lock, UserRound } from 'lucide-react';
import { API, showError, showInfo, showSuccess } from '../../../helpers';
import { Button } from '../../primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../primitives/card';
import { Checkbox } from '../../primitives/checkbox';
import { Input } from '../../primitives/input';
import PasswordStrengthBar from './components/PasswordStrengthBar';

const RegisterPage = () => {
  const { t } = useTranslation();
  const [form, setForm] = React.useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    verificationCode: '',
  });
  const [agreed, setAgreed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [codeLoading, setCodeLoading] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);

  React.useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInputChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSendVerificationCode = async () => {
    if (!form.email) {
      showInfo(t('请先填写邮箱'));
      return;
    }
    setCodeLoading(true);
    try {
      const res = await API.get(
        `/api/verification?email=${encodeURIComponent(form.email.trim())}`,
      );
      const { success, message } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess(t('验证码发送成功，请检查你的邮箱'));
      setCountdown(30);
    } catch (error) {
      showError(t('发送验证码失败，请重试'));
    } finally {
      setCodeLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (!form.username || !form.email || !form.password || !form.confirmPassword) {
      showInfo(t('请完整填写注册信息'));
      return;
    }
    if (form.password.length < 8) {
      showInfo(t('密码长度不得小于 8 位'));
      return;
    }
    if (form.password !== form.confirmPassword) {
      showInfo(t('两次输入的密码不一致'));
      return;
    }
    if (!form.verificationCode) {
      showInfo(t('请输入验证码'));
      return;
    }
    if (!agreed) {
      showInfo(t('请先同意用户协议和隐私政策'));
      return;
    }

    let affCode = new URLSearchParams(window.location.search).get('aff');
    if (!affCode) {
      affCode = localStorage.getItem('aff');
    } else {
      localStorage.setItem('aff', affCode);
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/register', {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        password2: form.confirmPassword,
        verification_code: form.verificationCode.trim(),
        aff_code: affCode || '',
      });
      const { success, message } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess(t('注册成功，请登录'));
      window.location.href = '/login';
    } catch (error) {
      showError(t('注册失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='aurora-auth-page'>
      <section className='w-full'>
        <Card className='mx-auto w-full max-w-[420px] border-border bg-white shadow-sm'>
          <CardHeader className='space-y-2 pb-4'>
            <CardTitle className='text-2xl'>{t('创建账户')}</CardTitle>
            <CardDescription>{t('填写信息后即可开始使用 Aurora')}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <form className='space-y-3' onSubmit={handleRegister}>
              <Input
                type='text'
                value={form.username}
                onChange={handleInputChange('username')}
                placeholder={t('用户名')}
                icon={<UserRound size={16} />}
              />
              <Input
                type='email'
                value={form.email}
                onChange={handleInputChange('email')}
                placeholder={t('邮箱')}
                icon={<AtSign size={16} />}
              />
              <Input
                type='password'
                value={form.password}
                onChange={handleInputChange('password')}
                placeholder={t('密码')}
                icon={<Lock size={16} />}
              />
              <PasswordStrengthBar value={form.password} />
              <Input
                type='password'
                value={form.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                placeholder={t('确认密码')}
                icon={<Lock size={16} />}
              />
              <div className='grid grid-cols-[1fr,120px] gap-2'>
                <Input
                  type='text'
                  value={form.verificationCode}
                  onChange={handleInputChange('verificationCode')}
                  placeholder={t('验证码')}
                  icon={<KeyRound size={16} />}
                />
                <Button
                  type='button'
                  variant='outline'
                  disabled={countdown > 0}
                  loading={codeLoading}
                  onClick={handleSendVerificationCode}
                >
                  {countdown > 0 ? `${countdown}s` : t('获取验证码')}
                </Button>
              </div>

              <label className='flex items-start gap-2 text-sm text-muted-foreground'>
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(Boolean(checked))}
                  className='mt-0.5'
                />
                <span>
                  {t('我已阅读并同意')}
                  <a
                    href='/user-agreement'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='mx-1 text-primary hover:opacity-80'
                  >
                    {t('用户协议')}
                  </a>
                  {t('和')}
                  <a
                    href='/privacy-policy'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='mx-1 text-primary hover:opacity-80'
                  >
                    {t('隐私政策')}
                  </a>
                </span>
              </label>

              <Button type='submit' className='w-full' loading={loading}>
                {t('立即注册')}
              </Button>
            </form>

            <p className='aurora-auth-bottom-note'>
              {t('已有账户？')}
              <Link to='/login'>{t('立即登录')}</Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default RegisterPage;
