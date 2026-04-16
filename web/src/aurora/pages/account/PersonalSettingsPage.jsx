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

import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AtSign,
  Bell,
  Lock,
  CreditCard,
  Globe,
  IdCard,
  Loader2,
  Link2,
  MessageCircle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  Wallet,
} from 'lucide-react';
import { SiDiscord, SiGithub, SiLinux, SiTelegram, SiWechat } from 'react-icons/si';
import TelegramLoginButton from 'react-telegram-login';
import { UserContext } from '../../../context/User';
import {
  API,
  buildRegistrationResult,
  copy,
  getOAuthProviderIcon,
  isPasskeySupported,
  onCustomOAuthClicked,
  onDiscordOAuthClicked,
  onGitHubOAuthClicked,
  onLinuxDOOAuthClicked,
  onOIDCClicked,
  prepareCredentialCreationOptions,
  renderQuota,
  showError,
  showInfo,
  showSuccess,
} from '../../../helpers';
import { normalizeLanguageSelection } from '../../../i18n/preference';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../primitives/card';
import { Input } from '../../primitives/input';
import { Button } from '../../primitives/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../primitives/tabs';
import { Badge } from '../../primitives/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import {
  BillingTabContent,
  NotificationTabContent,
  PreferencesTabContent,
} from './components/PersonalSettingsTabs';

const defaultNotificationSettings = {
  notify_type: 'email',
  quota_warning_threshold: 10,
  notification_email: '',
  webhook_url: '',
  webhook_secret: '',
  bark_url: '',
  gotify_url: '',
  gotify_token: '',
  gotify_priority: 5,
  upstream_model_update_notify_enabled: false,
  accept_unset_model_ratio_model: false,
  record_ip_log: false,
};
const notifyTypes = new Set(['email', 'webhook', 'bark', 'gotify']);

const parseUserSetting = (settingRaw) => {
  if (!settingRaw) return {};
  if (typeof settingRaw === 'object') return settingRaw;
  if (typeof settingRaw !== 'string') return {};
  try {
    return JSON.parse(settingRaw);
  } catch (error) {
    return {};
  }
};
const normalizeNotifyType = (value) => {
  if (typeof value !== 'string') return 'email';
  const next = value.trim().toLowerCase();
  return notifyTypes.has(next) ? next : 'email';
};
const toPositiveNumber = (value, fallback) => {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
};
const toIntInRange = (value, fallback, min, max) => {
  const next = Number.parseInt(String(value), 10);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(next, min), max);
};

const TAB_NOTIFICATION = String.fromCharCode(
  110, 111, 116, 105, 102, 105, 99, 97, 116, 105, 111, 110,
);
const TAB_BILLING = String.fromCharCode(98, 105, 108, 108, 105, 110, 103);
const TAB_PREFERENCES = String.fromCharCode(
  112, 114, 101, 102, 101, 114, 101, 110, 99, 101, 115,
);
const builtInOAuthProviders = [
  {
    key: 'github',
    label: 'GitHub',
    field: 'github_id',
    icon: <SiGithub className='h-3.5 w-3.5 text-slate-500' />,
    enabledKey: 'github_oauth',
    isReady: (status) => Boolean(status?.github_client_id),
    onBind: (status) => onGitHubOAuthClicked(status.github_client_id),
  },
  {
    key: 'discord',
    label: 'Discord',
    field: 'discord_id',
    icon: <SiDiscord className='h-3.5 w-3.5 text-slate-500' />,
    enabledKey: 'discord_oauth',
    isReady: (status) => Boolean(status?.discord_client_id),
    onBind: (status) => onDiscordOAuthClicked(status.discord_client_id),
  },
  {
    key: 'oidc',
    label: 'OIDC',
    field: 'oidc_id',
    icon: <Shield className='h-3.5 w-3.5 text-slate-500' />,
    enabledKey: 'oidc_enabled',
    isReady: (status) =>
      Boolean(status?.oidc_client_id && status?.oidc_authorization_endpoint),
    onBind: (status) =>
      onOIDCClicked(
        status.oidc_authorization_endpoint,
        status.oidc_client_id,
        false,
      ),
  },
  {
    key: 'linuxdo',
    label: 'LinuxDO',
    field: 'linux_do_id',
    icon: <SiLinux className='h-3.5 w-3.5 text-slate-500' />,
    enabledKey: 'linuxdo_oauth',
    isReady: (status) => Boolean(status?.linuxdo_client_id),
    onBind: (status) => onLinuxDOOAuthClicked(status.linuxdo_client_id),
  },
];

export default function PersonalSettingsPage() {
  const { t, i18n } = useTranslation();
  const [, userDispatch] = useContext(UserContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingNotify, setSavingNotify] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [oauthActionLoading, setOauthActionLoading] = useState({});
  const [activeTab, setActiveTab] = useState(TAB_NOTIFICATION);
  const [showEmailBindDialog, setShowEmailBindDialog] = useState(false);
  const [showWeChatBindDialog, setShowWeChatBindDialog] = useState(false);
  const [showTelegramBindDialog, setShowTelegramBindDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [emailBindForm, setEmailBindForm] = useState({
    email: '',
    code: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    original_password: '',
    new_password: '',
    confirm_new_password: '',
  });
  const [selfDeleteConfirmInput, setSelfDeleteConfirmInput] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [languagePreference, setLanguagePreference] = useState(
    normalizeLanguageSelection(i18n.language),
  );
  const [wechatVerificationCode, setWeChatVerificationCode] = useState('');
  const [emailCodeLoading, setEmailCodeLoading] = useState(false);
  const [emailBindingLoading, setEmailBindingLoading] = useState(false);
  const [wechatBindingLoading, setWeChatBindingLoading] = useState(false);
  const [emailCodeCountdown, setEmailCodeCountdown] = useState(0);

  const [userInfo, setUserInfo] = useState(null);
  const [oauthBindings, setOauthBindings] = useState([]);
  const [statusInfo, setStatusInfo] = useState({});
  const [passkeyStatus, setPasskeyStatus] = useState({ enabled: false });
  const [passkeySupported, setPasskeySupported] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState(
    defaultNotificationSettings,
  );

  const loadPasskeyStatus = async () => {
    try {
      const res = await API.get('/api/user/passkey');
      const { success, data } = res.data || {};
      if (success) {
        setPasskeyStatus({
          enabled: Boolean(data?.enabled),
          last_used_at: data?.last_used_at || null,
          backup_eligible: Boolean(data?.backup_eligible),
          backup_state: Boolean(data?.backup_state),
        });
      } else {
        setPasskeyStatus({ enabled: false });
      }
    } catch {
      setPasskeyStatus({ enabled: false });
    }
  };

  const loadData = async ({ showSkeleton = true } = {}) => {
    if (showSkeleton) {
      setLoading(true);
    }
    try {
      const [userRes, oauthRes, statusRes] = await Promise.all([
        API.get('/api/user/self'),
        API.get('/api/user/oauth/bindings'),
        API.get('/api/status'),
      ]);

      if (!userRes.data?.success) {
        showError(userRes.data?.message || t('加载用户信息失败'));
        if (showSkeleton) {
          setLoading(false);
        }
        return;
      }

      const nextUser = userRes.data.data;
      setUserInfo(nextUser);
      setEmailBindForm((prev) => ({
        ...prev,
        email: prev.email || nextUser.email || '',
      }));

      const settings = parseUserSetting(nextUser.setting);
      const nextLanguage = normalizeLanguageSelection(
        settings.language || i18n.language,
      );
      setLanguagePreference(nextLanguage);

      setNotificationSettings({
        notify_type: normalizeNotifyType(settings.notify_type),
        quota_warning_threshold: toPositiveNumber(
          settings.quota_warning_threshold,
          10,
        ),
        notification_email: settings.notification_email || nextUser.email || '',
        webhook_url: settings.webhook_url || '',
        webhook_secret: settings.webhook_secret || '',
        bark_url: settings.bark_url || '',
        gotify_url: settings.gotify_url || '',
        gotify_token: settings.gotify_token || '',
        gotify_priority: toIntInRange(settings.gotify_priority, 5, 0, 10),
        upstream_model_update_notify_enabled: Boolean(
          settings.upstream_model_update_notify_enabled,
        ),
        accept_unset_model_ratio_model: Boolean(
          settings.accept_unset_model_ratio_model,
        ),
        record_ip_log: Boolean(settings.record_ip_log),
      });

      if (oauthRes.data?.success) {
        setOauthBindings(oauthRes.data.data || []);
      } else {
        setOauthBindings([]);
      }
      if (statusRes.data?.success) {
        setStatusInfo(statusRes.data.data || {});
      } else {
        setStatusInfo({});
      }
      await Promise.allSettled([loadPasskeyStatus()]);
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('加载失败'),
      );
    } finally {
      if (showSkeleton) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData({ showSkeleton: true });
    isPasskeySupported()
      .then((supported) => {
        setPasskeySupported(Boolean(supported));
      })
      .catch(() => {
        setPasskeySupported(false);
      });
  }, []);
  useEffect(() => {
    if (emailCodeCountdown <= 0) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setEmailCodeCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [emailCodeCountdown]);

  const handleLanguagePreferenceSave = async (nextLanguage) => {
    if (!nextLanguage) {
      showError(t('请选择语言'));
      return;
    }
    if (nextLanguage === languagePreference) {
      showSuccess(t('语言偏好未变化'));
      return;
    }

    const previousLanguage = languagePreference;
    setSavingPreference(true);
    setLanguagePreference(nextLanguage);
    localStorage.setItem('i18nextLng', nextLanguage);
    i18n.changeLanguage(nextLanguage);
    try {
      const res = await API.put('/api/user/self', {
        language: nextLanguage,
      });
      if (res.data?.success) {
        showSuccess(t('语言偏好已保存'));
        await loadData({ showSkeleton: false });
      } else {
        showError(res.data?.message || t('保存失败'));
        setLanguagePreference(previousLanguage);
        localStorage.setItem('i18nextLng', previousLanguage);
        i18n.changeLanguage(previousLanguage);
      }
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('保存失败'),
      );
      setLanguagePreference(previousLanguage);
      localStorage.setItem('i18nextLng', previousLanguage);
      i18n.changeLanguage(previousLanguage);
    } finally {
      setSavingPreference(false);
    }
  };

  const handleChangePassword = async () => {
    const originalPassword = passwordForm.original_password.trim();
    const nextPassword = passwordForm.new_password.trim();
    const confirmPassword = passwordForm.confirm_new_password.trim();

    if (!nextPassword) {
      showError(t('请输入新密码'));
      return;
    }
    if (originalPassword === nextPassword) {
      showError(t('新密码需要和原密码不一致'));
      return;
    }
    if (nextPassword !== confirmPassword) {
      showError(t('两次输入的密码不一致'));
      return;
    }

    setChangingPassword(true);
    try {
      const res = await API.put('/api/user/self', {
        original_password: originalPassword,
        password: nextPassword,
      });
      if (res.data?.success) {
        showSuccess(t('密码修改成功'));
        setShowChangePasswordDialog(false);
        setPasswordForm({
          original_password: '',
          new_password: '',
          confirm_new_password: '',
        });
      } else {
        showError(res.data?.message || t('密码修改失败'));
      }
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('密码修改失败'),
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if ((userInfo?.username || '').trim().toLowerCase() === 'root') {
      showError(t('Root 用户不可删除'));
      return;
    }
    const username = userInfo?.username || '';
    if (selfDeleteConfirmInput.trim() !== username) {
      showError(t('请输入你的账户名以确认删除'));
      return;
    }

    setDeletingAccount(true);
    try {
      const res = await API.delete('/api/user/self');
      if (!res.data?.success) {
        showError(res.data?.message || t('删除账户失败'));
        return;
      }
      showSuccess(t('账户已删除'));
      try {
        await API.get('/api/user/logout');
      } catch {
        // ignore logout failure after self-deletion
      }
      userDispatch({ type: 'logout' });
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('删除账户失败'),
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleNotificationSave = async () => {
    const notifyType = normalizeNotifyType(notificationSettings.notify_type);
    const threshold = Number(notificationSettings.quota_warning_threshold);
    const webhookUrl = (notificationSettings.webhook_url || '').trim();
    const barkUrl = (notificationSettings.bark_url || '').trim();
    const gotifyUrl = (notificationSettings.gotify_url || '').trim();
    const gotifyToken = (notificationSettings.gotify_token || '').trim();
    const gotifyPriorityParsed = Number.parseInt(
      String(notificationSettings.gotify_priority),
      10,
    );

    if (!Number.isFinite(threshold) || threshold <= 0) {
      showError(t('预警阈值必须大于 0'));
      return;
    }
    if (notifyType === 'webhook' && !/^https:\/\/.+/i.test(webhookUrl)) {
      showError(t('Webhook 地址必须以 https:// 开头'));
      return;
    }
    if (notifyType === 'bark' && !/^https?:\/\/.+/i.test(barkUrl)) {
      showError(t('Bark URL 必须以 http:// 或 https:// 开头'));
      return;
    }
    if (notifyType === 'gotify') {
      if (!/^https?:\/\/.+/i.test(gotifyUrl)) {
        showError(t('Gotify URL 必须以 http:// 或 https:// 开头'));
        return;
      }
      if (!gotifyToken) {
        showError(t('Gotify Token 不能为空'));
        return;
      }
      if (
        !Number.isFinite(gotifyPriorityParsed) ||
        gotifyPriorityParsed < 0 ||
        gotifyPriorityParsed > 10
      ) {
        showError(t('Gotify Priority 必须是 0-10 的整数'));
        return;
      }
    }

    const payload = {
      notify_type: notifyType,
      quota_warning_threshold: threshold,
      notification_email: notificationSettings.notification_email || '',
      webhook_url: webhookUrl,
      webhook_secret: notificationSettings.webhook_secret || '',
      bark_url: barkUrl,
      gotify_url: gotifyUrl,
      gotify_token: gotifyToken,
      gotify_priority: toIntInRange(
        gotifyPriorityParsed,
        5,
        0,
        10,
      ),
      upstream_model_update_notify_enabled: Boolean(
        notificationSettings.upstream_model_update_notify_enabled,
      ),
      accept_unset_model_ratio_model: Boolean(
        notificationSettings.accept_unset_model_ratio_model,
      ),
      record_ip_log: Boolean(notificationSettings.record_ip_log),
    };

    setSavingNotify(true);
    try {
      const res = await API.put('/api/user/setting', payload);
      if (res.data?.success) {
        showSuccess(t('通知设置已保存'));
        await loadData({ showSkeleton: false });
      } else {
        showError(res.data?.message || t('保存失败'));
      }
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('保存失败'),
      );
    } finally {
      setSavingNotify(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!passkeySupported || !window.PublicKeyCredential) {
      showInfo(t('当前设备不支持 Passkey'));
      return;
    }
    setPasskeyLoading(true);
    try {
      const beginRes = await API.post('/api/user/passkey/register/begin');
      const { success, message, data } = beginRes.data || {};
      if (!success) {
        showError(message || t('无法发起 Passkey 注册'));
        return;
      }

      const publicKey = prepareCredentialCreationOptions(
        data?.options || data?.publicKey || data,
      );
      const credential = await navigator.credentials.create({ publicKey });
      const payload = buildRegistrationResult(credential);
      if (!payload) {
        showError(t('Passkey 注册失败，请重试'));
        return;
      }

      const finishRes = await API.post(
        '/api/user/passkey/register/finish',
        payload,
      );
      if (finishRes.data?.success) {
        showSuccess(t('Passkey 注册成功'));
        await loadPasskeyStatus();
      } else {
        showError(finishRes.data?.message || t('Passkey 注册失败，请重试'));
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        showInfo(t('已取消 Passkey 注册'));
      } else {
        showError(t('Passkey 注册失败，请重试'));
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleRemovePasskey = async () => {
    setPasskeyLoading(true);
    try {
      const res = await API.delete('/api/user/passkey');
      if (res.data?.success) {
        showSuccess(t('Passkey 已解绑'));
        await loadPasskeyStatus();
      } else {
        showError(res.data?.message || t('操作失败，请重试'));
      }
    } catch (error) {
      showError(error?.response?.data?.message || t('操作失败，请重试'));
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleResetToken = async () => {
    setTokenLoading(true);
    try {
      const res = await API.get('/api/user/token');
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('重置失败'));
        return;
      }
      const copied = await copy(data || '');
      if (copied) {
        showSuccess(t('令牌已重置并已复制到剪贴板'));
      } else {
        showSuccess(t('令牌已重置，请手动复制'));
      }
    } catch (error) {
      showError(error?.response?.data?.message || t('重置失败'));
    } finally {
      setTokenLoading(false);
    }
  };
  const handleBindBuiltInOAuth = async (provider) => {
    if (!provider?.onBind) {
      return;
    }
    if (!provider.isReady(statusInfo)) {
      showError(t('OAuth 配置未完成'));
      return;
    }
    setOauthActionLoading((prev) => ({ ...prev, [provider.key]: true }));
    try {
      await provider.onBind(statusInfo);
    } catch (error) {
      showError(error?.message || t('OAuth 绑定失败'));
    } finally {
      setOauthActionLoading((prev) => ({ ...prev, [provider.key]: false }));
    }
  };
  const handleBindCustomOAuth = async (provider) => {
    if (!provider) {
      return;
    }
    const key = `custom-bind-${provider.id}`;
    setOauthActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await onCustomOAuthClicked(provider);
    } catch (error) {
      showError(error?.message || t('OAuth 绑定失败'));
    } finally {
      setOauthActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };
  const handleUnbindCustomOAuth = async (provider) => {
    if (!provider?.id) {
      return;
    }
    const key = `custom-unbind-${provider.id}`;
    setOauthActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await API.delete(`/api/user/oauth/bindings/${provider.id}`);
      if (res.data?.success) {
        showSuccess(t('解绑成功'));
        await loadData({ showSkeleton: false });
      } else {
        showError(res.data?.message || t('解绑失败'));
      }
    } catch (error) {
      showError(error?.response?.data?.message || error.message || t('解绑失败'));
    } finally {
      setOauthActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };
  const handleSendEmailVerificationCode = async () => {
    const email = emailBindForm.email.trim();
    if (!email) {
      showError(t('请输入邮箱'));
      return;
    }
    if (emailCodeCountdown > 0) {
      return;
    }
    setEmailCodeLoading(true);
    try {
      const res = await API.get(
        `/api/verification?email=${encodeURIComponent(email)}`,
      );
      if (res.data?.success) {
        showSuccess(t('验证码发送成功，请检查邮箱'));
        setEmailCodeCountdown(30);
      } else {
        showError(res.data?.message || t('验证码发送失败'));
      }
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('验证码发送失败'),
      );
    } finally {
      setEmailCodeLoading(false);
    }
  };
  const handleBindEmail = async () => {
    const email = emailBindForm.email.trim();
    const code = emailBindForm.code.trim();
    if (!email) {
      showError(t('请输入邮箱'));
      return;
    }
    if (!code) {
      showError(t('请输入邮箱验证码'));
      return;
    }
    setEmailBindingLoading(true);
    try {
      const res = await API.get(
        `/api/oauth/email/bind?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`,
      );
      if (res.data?.success) {
        showSuccess(t('邮箱账户绑定成功'));
        setShowEmailBindDialog(false);
        setEmailBindForm((prev) => ({ ...prev, code: '' }));
        await loadData({ showSkeleton: false });
      } else {
        showError(res.data?.message || t('邮箱绑定失败'));
      }
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('邮箱绑定失败'),
      );
    } finally {
      setEmailBindingLoading(false);
    }
  };
  const handleBindWeChat = async () => {
    const code = wechatVerificationCode.trim();
    if (!code) {
      showError(t('请输入微信验证码'));
      return;
    }
    setWeChatBindingLoading(true);
    try {
      const res = await API.get(
        `/api/oauth/wechat/bind?code=${encodeURIComponent(code)}`,
      );
      if (res.data?.success) {
        showSuccess(t('微信账户绑定成功'));
        setShowWeChatBindDialog(false);
        setWeChatVerificationCode('');
        await loadData({ showSkeleton: false });
      } else {
        showError(res.data?.message || t('微信绑定失败'));
      }
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('微信绑定失败'),
      );
    } finally {
      setWeChatBindingLoading(false);
    }
  };
  const customProviders = Array.isArray(statusInfo?.custom_oauth_providers)
    ? statusInfo.custom_oauth_providers
    : [];
  const findCustomBinding = (providerId) => {
    const normalizedProviderId = Number(providerId);
    return oauthBindings.find(
      (binding) => Number(binding.provider_id) === normalizedProviderId,
    );
  };

  const roleLabel = userInfo?.role >= 10 ? t('Super Admin') : t('Standard User');
  const isRootUser = (userInfo?.username || '').trim().toLowerCase() === 'root';
  const showUserGroupInProfile =
    (userInfo?.role || 0) >= 10 ||
    statusInfo?.personal_setting_show_user_group_for_non_admin === true;

  if (loading) {
    return (
      <div className='flex min-h-[280px] items-center justify-center'>
        <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-6 xl:grid-cols-10'>
      <div className='space-y-6 xl:col-span-4'>
        <Card className='overflow-hidden border-[#d6e1f2]'>
          <div className='h-24 bg-gradient-to-r from-[#4a4bd7] via-[#5d67f4] to-[#8188ff]' />
          <CardContent className='space-y-4 px-6 pb-6 pt-0'>
            <div className='-mt-10 flex items-end justify-between gap-3'>
              <div className='flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-[#e6e8ff] text-2xl font-extrabold text-[#3435b8]'>
                {(userInfo?.username || 'U').slice(0, 2).toUpperCase()}
              </div>
              <Badge className='rounded-full bg-[#eef3ff] px-3 py-1 text-[11px] font-semibold text-[#4a4bd7] hover:bg-[#e3ebff]'>
                {roleLabel}
              </Badge>
            </div>

            <div>
              <p className='text-xl font-bold text-slate-900'>
                {userInfo?.username || '-'}
              </p>
              <p className='mt-1 text-sm text-slate-500'>
                {userInfo?.email || t('未绑定邮箱')}
              </p>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='rounded-xl border border-[#dce7f8] bg-[#f5f8ff] p-3'>
                <p className='text-[11px] font-semibold uppercase tracking-wide text-[#6e7f98]'>
                  {t('Total Balance')}
                </p>
                <p className='mt-1 text-lg font-bold text-slate-900'>
                  {renderQuota(userInfo?.quota ?? 0)}
                </p>
              </div>
              <div className='rounded-xl border border-[#dce7f8] bg-[#f5f8ff] p-3'>
                <p className='text-[11px] font-semibold uppercase tracking-wide text-[#6e7f98]'>
                  {t('Mtd Usage')}
                </p>
                <p className='mt-1 text-lg font-bold text-slate-900'>
                  {renderQuota(userInfo?.used_quota ?? 0)}
                </p>
              </div>
            </div>

            <div className='space-y-3'>
              <Input
                label={t('用户名')}
                value={userInfo?.username || ''}
                readOnly
                className='h-9 rounded-lg border-[#d6e3f5] bg-[#f9fbff]'
              />
              <Input
                label={t('显示名称')}
                value={userInfo?.display_name || ''}
                readOnly
                className='h-9 rounded-lg border-[#d6e3f5] bg-[#f9fbff]'
              />
              <div className='grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2'>
                <div className='flex items-center gap-2 rounded-lg border border-[#dce7f8] bg-[#f7f9ff] px-3 py-2'>
                  <IdCard className='h-3.5 w-3.5 text-slate-500' />
                  <span>
                    {t('用户 ID')}: {userInfo?.id ?? '-'}
                  </span>
                </div>
                {showUserGroupInProfile ? (
                  <div className='flex items-center gap-2 rounded-lg border border-[#dce7f8] bg-[#f7f9ff] px-3 py-2'>
                    <User className='h-3.5 w-3.5 text-slate-500' />
                    <span>
                      {t('用户分组')}: {userInfo?.group || '-'}
                    </span>
                  </div>
                ) : null}
              </div>
              <Button
                type='button'
                variant='outline'
                disabled
                className='h-9 w-full rounded-lg text-sm font-semibold'
              >
                {t('旧版个人资料不支持编辑')}
              </Button>
              <div className='rounded-lg border border-[#dce7f8] bg-[#f7f9ff] p-3'>
                <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-[#6e7f98]'>
                  {t('账户安全')}
                </p>
                <div className='grid grid-cols-2 gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    className='h-8 rounded-lg text-xs'
                    onClick={() => {
                      setShowChangePasswordDialog(true);
                    }}
                  >
                    {t('修改密码')}
                  </Button>
                  <Button
                    type='button'
                    variant='destructive'
                    className='h-8 rounded-lg text-xs'
                    disabled={isRootUser}
                    onClick={() => {
                      if (isRootUser) {
                        showError(t('Root 用户不可删除'));
                        return;
                      }
                      setShowDeleteAccountDialog(true);
                    }}
                  >
                    {isRootUser ? t('Root 用户不可删除') : t('删除账户')}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='border-[#d6e1f2]'>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-sm'>
              <Shield className='h-4 w-4' />
              {t('OAuth 绑定')}
            </CardTitle>
            <CardDescription className='text-xs text-slate-500'>
              {t('查看并确认第三方身份绑定状态')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='flex items-center justify-between rounded-lg border border-[#dce7f8] px-3 py-2 text-sm'>
              <span className='flex items-center gap-2'>
                <AtSign className='h-3.5 w-3.5 text-slate-500' />
                Email
              </span>
              <div className='flex items-center gap-2'>
                <Badge variant={userInfo?.email ? 'default' : 'outline'}>
                  {userInfo?.email ? t('已绑定') : t('未绑定')}
                </Badge>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-7 rounded-lg px-2 text-xs'
                  onClick={() => {
                    setShowEmailBindDialog(true);
                  }}
                >
                  {userInfo?.email ? t('修改绑定') : t('绑定')}
                </Button>
              </div>
            </div>
            <div className='flex items-center justify-between rounded-lg border border-[#dce7f8] px-3 py-2 text-sm'>
              <span className='flex items-center gap-2'>
                <SiWechat className='h-3.5 w-3.5 text-emerald-600' />
                WeChat
              </span>
              <div className='flex items-center gap-2'>
                <Badge
                  variant={
                    userInfo?.wechat_id
                      ? 'default'
                      : statusInfo?.wechat_login
                        ? 'outline'
                        : 'secondary'
                  }
                >
                  {userInfo?.wechat_id
                    ? t('已绑定')
                    : statusInfo?.wechat_login
                      ? t('未绑定')
                      : t('未启用')}
                </Badge>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-7 rounded-lg px-2 text-xs'
                  disabled={!statusInfo?.wechat_login}
                  onClick={() => {
                    setShowWeChatBindDialog(true);
                  }}
                >
                  {userInfo?.wechat_id
                    ? t('修改绑定')
                    : statusInfo?.wechat_login
                      ? t('绑定')
                      : t('未启用')}
                </Button>
              </div>
            </div>
            {builtInOAuthProviders.map((provider) => {
              const bound = Boolean(userInfo?.[provider.field]);
              const enabled = Boolean(statusInfo?.[provider.enabledKey]);
              const loadingKey = provider.key;
              return (
                <div
                  key={provider.key}
                  className='flex items-center justify-between rounded-lg border border-[#dce7f8] px-3 py-2 text-sm'
                >
                  <span className='flex items-center gap-2'>
                    {provider.icon}
                    {provider.label}
                  </span>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant={
                        bound
                          ? 'default'
                          : enabled
                            ? 'outline'
                            : 'secondary'
                      }
                    >
                      {bound ? t('已绑定') : enabled ? t('未绑定') : t('未启用')}
                    </Badge>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='h-7 rounded-lg px-2 text-xs'
                      disabled={bound || !enabled}
                      loading={Boolean(oauthActionLoading[loadingKey])}
                      onClick={() => {
                        handleBindBuiltInOAuth(provider);
                      }}
                    >
                      {bound ? t('已绑定') : enabled ? t('绑定') : t('未启用')}
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className='flex items-center justify-between rounded-lg border border-[#dce7f8] px-3 py-2 text-sm'>
              <span className='flex items-center gap-2'>
                <SiTelegram className='h-3.5 w-3.5 text-sky-500' />
                Telegram
              </span>
              <div className='flex items-center gap-2'>
                <Badge
                  variant={
                    userInfo?.telegram_id
                      ? 'default'
                      : statusInfo?.telegram_oauth
                        ? 'outline'
                        : 'secondary'
                  }
                >
                  {userInfo?.telegram_id
                    ? t('已绑定')
                    : statusInfo?.telegram_oauth
                      ? t('未绑定')
                      : t('未启用')}
                </Badge>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-7 rounded-lg px-2 text-xs'
                  disabled={!statusInfo?.telegram_oauth || userInfo?.telegram_id}
                  onClick={() => {
                    setShowTelegramBindDialog(true);
                  }}
                >
                  {!statusInfo?.telegram_oauth
                    ? t('未启用')
                    : userInfo?.telegram_id
                      ? t('已绑定')
                      : t('绑定')}
                </Button>
              </div>
            </div>
            {customProviders.length > 0 ? (
              <div className='pt-2'>
                <p className='mb-2 text-xs text-slate-500'>
                  {t('自定义 OAuth 提供商')}
                </p>
                <div className='space-y-2'>
                  {customProviders.map((provider) => {
                    const binding = findCustomBinding(provider.id);
                    const bound = Boolean(binding);
                    const bindLoadingKey = `custom-bind-${provider.id}`;
                    const unbindLoadingKey = `custom-unbind-${provider.id}`;
                    return (
                      <div
                        key={`${provider.id}-${provider.slug}`}
                        className='flex items-center justify-between rounded-lg border border-[#dce7f8] px-3 py-2 text-sm'
                      >
                        <span className='flex items-center gap-2'>
                          <Link2 className='h-3.5 w-3.5 text-slate-500' />
                          {getOAuthProviderIcon(
                            provider.icon || binding?.provider_icon || '',
                            14,
                          )}
                          {provider.name || provider.slug}
                        </span>
                        <div className='flex items-center gap-2'>
                          <Badge variant={bound ? 'default' : 'outline'}>
                            {bound ? t('已绑定') : t('未绑定')}
                          </Badge>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='h-7 rounded-lg px-2 text-xs'
                            loading={Boolean(
                              oauthActionLoading[
                                bound ? unbindLoadingKey : bindLoadingKey
                              ],
                            )}
                            onClick={() => {
                              if (bound) {
                                handleUnbindCustomOAuth(provider);
                              } else {
                                handleBindCustomOAuth(provider);
                              }
                            }}
                          >
                            {bound ? t('解绑') : t('绑定')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className='xl:col-span-6'>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className='w-full'
        >
          <TabsList className='grid w-full grid-cols-3 rounded-xl border border-[#d7e3f4] bg-[#f4f8ff] p-1'>
            <TabsTrigger value={TAB_NOTIFICATION} className='gap-2'>
              <Bell className='h-4 w-4' />
              {t('Notification')}
            </TabsTrigger>
            <TabsTrigger value={TAB_BILLING} className='gap-2'>
              <CreditCard className='h-4 w-4' />
              {t('Billing')}
            </TabsTrigger>
            <TabsTrigger value={TAB_PREFERENCES} className='gap-2'>
              <Globe className='h-4 w-4' />
              {t('Preferences')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={TAB_NOTIFICATION} className='mt-4'>
            <NotificationTabContent
              t={t}
              settings={notificationSettings}
              onChange={(patch) => {
                setNotificationSettings((prev) => ({ ...prev, ...patch }));
              }}
              onSave={handleNotificationSave}
              saving={savingNotify}
              showUpstreamModelSwitch={(userInfo?.role || 0) >= 10}
            />
          </TabsContent>

          <TabsContent value={TAB_BILLING} className='mt-4'>
            <BillingTabContent t={t} userInfo={userInfo} />
          </TabsContent>

          <TabsContent value={TAB_PREFERENCES} className='mt-4'>
            <PreferencesTabContent
              t={t}
              language={languagePreference}
              languageSaving={savingPreference}
              onLanguageChange={handleLanguagePreferenceSave}
              passkeySupported={passkeySupported}
              passkeyEnabled={passkeyStatus.enabled}
              passkeyLoading={passkeyLoading}
              onRegisterPasskey={handleRegisterPasskey}
              onRemovePasskey={handleRemovePasskey}
              tokenLoading={tokenLoading}
              onResetToken={handleResetToken}
              onOpenChangePassword={() => {
                setShowChangePasswordDialog(true);
              }}
              onOpenDeleteAccount={() => {
                if (isRootUser) {
                  showError(t('Root 用户不可删除'));
                  return;
                }
                setShowDeleteAccountDialog(true);
              }}
              canDeleteAccount={!isRootUser}
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={showEmailBindDialog}
        onOpenChange={(nextOpen) => {
          setShowEmailBindDialog(nextOpen);
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('绑定邮箱')}</DialogTitle>
            <DialogDescription>
              {t('输入邮箱并完成验证码校验后即可绑定')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3'>
            <Input
              label={t('邮箱')}
              value={emailBindForm.email}
              onChange={(event) => {
                setEmailBindForm((prev) => ({
                  ...prev,
                  email: event.target.value,
                }));
              }}
            />
            <div className='grid grid-cols-[1fr_auto] gap-2'>
              <Input
                label={t('邮箱验证码')}
                value={emailBindForm.code}
                onChange={(event) => {
                  setEmailBindForm((prev) => ({
                    ...prev,
                    code: event.target.value,
                  }));
                }}
              />
              <Button
                type='button'
                variant='outline'
                className='h-9 self-end'
                disabled={emailCodeLoading || emailCodeCountdown > 0}
                loading={emailCodeLoading}
                onClick={handleSendEmailVerificationCode}
              >
                {emailCodeCountdown > 0
                  ? `${emailCodeCountdown}s`
                  : t('发送验证码')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setShowEmailBindDialog(false);
              }}
            >
              {t('取消')}
            </Button>
            <Button
              type='button'
              loading={emailBindingLoading}
              onClick={handleBindEmail}
            >
              {t('确认绑定')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showWeChatBindDialog}
        onOpenChange={(nextOpen) => {
          setShowWeChatBindDialog(nextOpen);
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('绑定微信')}</DialogTitle>
            <DialogDescription>
              {t('请前往扫码获取验证码，再回填完成绑定')}
            </DialogDescription>
          </DialogHeader>
          <Input
            label={t('微信验证码')}
            value={wechatVerificationCode}
            onChange={(event) => {
              setWeChatVerificationCode(event.target.value);
            }}
          />
          {statusInfo?.wechat_qrcode ? (
            <div className='rounded-lg border border-dashed border-slate-300 p-2'>
              <img
                src={statusInfo.wechat_qrcode}
                alt='wechat-qrcode'
                className='mx-auto h-40 w-40 object-contain'
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setShowWeChatBindDialog(false);
              }}
            >
              {t('取消')}
            </Button>
            <Button
              type='button'
              loading={wechatBindingLoading}
              onClick={handleBindWeChat}
            >
              {t('确认绑定')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showTelegramBindDialog}
        onOpenChange={(nextOpen) => {
          setShowTelegramBindDialog(nextOpen);
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('绑定 Telegram')}</DialogTitle>
            <DialogDescription>
              {t('点击下方按钮跳转并完成 Telegram 授权')}
            </DialogDescription>
          </DialogHeader>
          <div className='rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600'>
            <p className='mb-2'>
              {t('完成授权后返回本页面，点击“刷新状态”确认绑定结果。')}
            </p>
            {statusInfo?.telegram_bot_name ? (
              <div className='flex justify-center'>
                <TelegramLoginButton
                  dataAuthUrl='/api/oauth/telegram/bind'
                  botName={statusInfo.telegram_bot_name}
                />
              </div>
            ) : (
              <div className='flex items-center gap-2 text-amber-600'>
                <ShieldAlert className='h-4 w-4' />
                <span>{t('Telegram Bot 未配置，暂时无法绑定')}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={async () => {
                await loadData({ showSkeleton: false });
                showSuccess(t('绑定状态已刷新'));
              }}
            >
              <ShieldCheck className='mr-1 h-3.5 w-3.5' />
              {t('刷新状态')}
            </Button>
            <Button
              type='button'
              onClick={() => {
                setShowTelegramBindDialog(false);
              }}
            >
              <MessageCircle className='mr-1 h-3.5 w-3.5' />
              {t('完成')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showChangePasswordDialog}
        onOpenChange={(nextOpen) => {
          setShowChangePasswordDialog(nextOpen);
          if (!nextOpen) {
            setPasswordForm({
              original_password: '',
              new_password: '',
              confirm_new_password: '',
            });
          }
        }}
      >
        <DialogContent className='max-w-lg overflow-hidden rounded-2xl border-[#d6e1f2] bg-[#f8fbff] p-0 shadow-[0_24px_80px_rgba(55,80,140,0.28)]'>
          <DialogHeader className='mb-0 border-b border-[#cedcf2] bg-gradient-to-r from-[#4a4bd7] via-[#5b67ee] to-[#7886ff] px-6 py-5 text-white'>
            <DialogTitle className='flex items-center gap-3 text-base font-semibold text-white'>
              <span className='inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/20'>
                <Lock className='h-4 w-4 text-white' />
              </span>
              {t('修改密码')}
            </DialogTitle>
            <DialogDescription className='mt-2 text-xs leading-relaxed text-white/90'>
              {t('请输入原密码和新密码，完成后立即生效。')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 px-6 py-5'>
            <div className='rounded-xl border border-[#d6e3f5] bg-white/80 px-3 py-2 text-xs text-slate-600'>
              {t('密码建议：至少 8 位，并包含字母与数字。')}
            </div>
            <div className='space-y-3'>
              <Input
                type='password'
                autoComplete='current-password'
                label={t('原密码')}
                value={passwordForm.original_password}
                onChange={(event) => {
                  setPasswordForm((prev) => ({
                    ...prev,
                    original_password: event.target.value,
                  }));
                }}
                className='h-10 border-[#d4def0] bg-white text-sm focus-visible:ring-[#4a4bd7]/30'
              />
              <Input
                type='password'
                autoComplete='new-password'
                label={t('新密码')}
                value={passwordForm.new_password}
                onChange={(event) => {
                  setPasswordForm((prev) => ({
                    ...prev,
                    new_password: event.target.value,
                  }));
                }}
                className='h-10 border-[#d4def0] bg-white text-sm focus-visible:ring-[#4a4bd7]/30'
              />
              <Input
                type='password'
                autoComplete='new-password'
                label={t('确认新密码')}
                value={passwordForm.confirm_new_password}
                onChange={(event) => {
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirm_new_password: event.target.value,
                  }));
                }}
                className='h-10 border-[#d4def0] bg-white text-sm focus-visible:ring-[#4a4bd7]/30'
              />
            </div>
            <DialogFooter className='mt-1 border-t border-[#d6e1f2] pt-4'>
              <Button
                type='button'
                variant='outline'
                className='h-9 rounded-lg border-[#d0dbef] bg-white text-sm hover:bg-[#f4f7ff]'
                onClick={() => {
                  setShowChangePasswordDialog(false);
                }}
              >
                {t('取消')}
              </Button>
              <Button
                type='button'
                loading={changingPassword}
                className='h-9 rounded-lg bg-[#4a4bd7] text-sm font-semibold text-white hover:bg-[#4042ca]'
                onClick={handleChangePassword}
              >
                {t('确认修改')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDeleteAccountDialog}
        onOpenChange={(nextOpen) => {
          setShowDeleteAccountDialog(nextOpen);
          if (!nextOpen) {
            setSelfDeleteConfirmInput('');
          }
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-red-700'>
              <Trash2 className='h-4 w-4' />
              {t('删除账户确认')}
            </DialogTitle>
            <DialogDescription>
              {t('此操作不可逆，所有数据将被永久删除。')}
            </DialogDescription>
          </DialogHeader>
          <div className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'>
            {t('请输入当前用户名后才能删除账户。')}
          </div>
          <Input
            label={t('确认用户名')}
            value={selfDeleteConfirmInput}
            placeholder={t('请输入用户名 {{username}}', {
              username: userInfo?.username || '',
            })}
            onChange={(event) => {
              setSelfDeleteConfirmInput(event.target.value);
            }}
          />
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setShowDeleteAccountDialog(false);
              }}
            >
              {t('取消')}
            </Button>
            <Button
              type='button'
              variant='destructive'
              loading={deletingAccount}
              onClick={handleDeleteAccount}
            >
              {t('确认删除')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
