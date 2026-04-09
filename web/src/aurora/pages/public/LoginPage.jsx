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
import { Github, Lock, Mail, MessageCircle, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { StatusContext } from '../../../context/Status';
import { UserContext } from '../../../context/User';
import {
  API,
  AuthRedirect,
  onDiscordOAuthClicked,
  onGitHubOAuthClicked,
  setUserData,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { Button } from '../../primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../primitives/card';
import { Input } from '../../primitives/input';

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, userDispatch] = React.useContext(UserContext);
  const [statusState] = React.useContext(StatusContext);
  const [form, setForm] = React.useState({
    email: '',
    password: '',
    wechatVerificationCode: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [wechatLoading, setWechatLoading] = React.useState(false);
  const [showWechatInput, setShowWechatInput] = React.useState(false);

  const status = React.useMemo(() => {
    if (statusState?.status) {
      return statusState.status;
    }
    const raw = localStorage.getItem('status');
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) || {};
    } catch (error) {
      return {};
    }
  }, [statusState?.status]);

  const handleInputChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const completeLogin = (data) => {
    userDispatch({ type: 'login', payload: data });
    localStorage.setItem('user', JSON.stringify(data));
    setUserData(data);
    updateAPI();
    navigate('/console');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!form.email || !form.password) {
      showInfo(t('请输入邮箱和密码'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/user/login', {
        username: form.email.trim(),
        password: form.password,
      });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      completeLogin(data);
      showSuccess(t('登录成功！'));
    } catch (error) {
      showError(t('登录失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    try {
      if (provider === 'github') {
        await onGitHubOAuthClicked(status.github_client_id, { shouldLogout: true });
      } else if (provider === 'discord') {
        await onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true });
      } else if (provider === 'wechat') {
        setShowWechatInput(true);
      } else if (provider === 'telegram') {
        if (!status.telegram_bot_name) {
          showInfo(t('当前未配置 Telegram 机器人'));
          return;
        }
        window.open(`https://t.me/${status.telegram_bot_name}`, '_blank', 'noopener,noreferrer');
        showInfo(t('请在 Telegram 中完成授权后返回登录页面'));
      }
    } catch (error) {
      showError(t('OAuth 登录发起失败，请重试'));
    }
  };

  const handleWeChatLogin = async () => {
    if (!form.wechatVerificationCode) {
      showInfo(t('请输入微信验证码'));
      return;
    }
    setWechatLoading(true);
    try {
      const res = await API.get(`/api/oauth/wechat?code=${form.wechatVerificationCode}`);
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      completeLogin(data);
      showSuccess(t('登录成功！'));
    } catch (error) {
      showError(t('微信登录失败，请重试'));
    } finally {
      setWechatLoading(false);
    }
  };

  const oauthButtons = [
    {
      key: 'github',
      icon: <Github size={16} />,
      label: 'GitHub',
      enabled: Boolean(status.github_oauth),
    },
    {
      key: 'discord',
      icon: <MessageCircle size={16} />,
      label: 'Discord',
      enabled: Boolean(status.discord_oauth),
    },
    {
      key: 'wechat',
      icon: <MessageCircle size={16} />,
      label: t('WeChat'),
      enabled: Boolean(status.wechat_login),
    },
    {
      key: 'telegram',
      icon: <Send size={16} />,
      label: 'Telegram',
      enabled: Boolean(status.telegram_oauth),
    },
  ];

  return (
    <AuthRedirect>
      <div className='aurora-auth-page'>
        <section className='w-full'>
          <Card className='mx-auto w-full max-w-[420px] border-border bg-white shadow-sm'>
            <CardHeader className='space-y-2 pb-4'>
              <CardTitle className='text-2xl'>{t('登录你的账户')}</CardTitle>
              <CardDescription>{t('使用邮箱密码或第三方渠道快速进入')}</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <form className='space-y-3' onSubmit={handleLogin}>
                <Input
                  type='text'
                  value={form.email}
                  onChange={handleInputChange('email')}
                  placeholder={t('用户名 / 邮箱')}
                  icon={<Mail size={16} />}
                  autoComplete='username'
                />
                <Input
                  type='password'
                  value={form.password}
                  onChange={handleInputChange('password')}
                  placeholder={t('密码')}
                  icon={<Lock size={16} />}
                  autoComplete='current-password'
                />
                <div className='flex justify-end'>
                  <Link
                    to='/reset'
                    className='text-sm text-primary transition-opacity hover:opacity-80'
                  >
                    {t('忘记密码？')}
                  </Link>
                </div>
                <Button type='submit' className='w-full' loading={loading}>
                  {t('登录')}
                </Button>
              </form>

              <div className='space-y-2'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  {t('OAuth 登录')}
                </p>
                <div className='grid grid-cols-2 gap-2'>
                  {oauthButtons.map((item) => (
                    <Button
                      key={item.key}
                      type='button'
                      variant='outline'
                      className='w-full justify-start gap-2'
                      disabled={!item.enabled}
                      onClick={() => handleOAuth(item.key)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {showWechatInput && (
                <div className='space-y-2 rounded-lg border border-border bg-muted/20 p-3'>
                  <Input
                    type='text'
                    value={form.wechatVerificationCode}
                    onChange={handleInputChange('wechatVerificationCode')}
                    placeholder={t('输入微信验证码')}
                  />
                  <Button
                    type='button'
                    className='w-full'
                    variant='secondary'
                    loading={wechatLoading}
                    onClick={handleWeChatLogin}
                  >
                    {t('提交微信验证码')}
                  </Button>
                </div>
              )}

              <p className='aurora-auth-bottom-note'>
                {t('没有账户？')}
                <Link to='/register'>{t('立即注册')}</Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </AuthRedirect>
  );
};

export default LoginPage;
