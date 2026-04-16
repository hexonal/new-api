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

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  CreditCard,
  Globe,
  Loader2,
  Link2,
  Lock,
  User,
} from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
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
  accept_unset_model_ratio_model: false,
  record_ip_log: false,
};

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

const oauthFieldList = [
  { key: 'email', label: 'Email', field: 'email' },
  { key: 'github', label: 'GitHub', field: 'github_id' },
  { key: 'discord', label: 'Discord', field: 'discord_id' },
  { key: 'oidc', label: 'OIDC', field: 'oidc_id' },
  { key: 'wechat', label: 'WeChat', field: 'wechat_id' },
  { key: 'telegram', label: 'Telegram', field: 'telegram_id' },
  { key: 'linuxdo', label: 'LinuxDO', field: 'linux_do_id' },
];
const TAB_NOTIFICATION = String.fromCharCode(
  110,
  111,
  116,
  105,
  102,
  105,
  99,
  97,
  116,
  105,
  111,
  110,
);
const TAB_BILLING = String.fromCharCode(98, 105, 108, 108, 105, 110, 103);
const TAB_PREFERENCES = String.fromCharCode(
  112,
  114,
  101,
  102,
  101,
  114,
  101,
  110,
  99,
  101,
  115,
);

const getRoleLabel = (role, t) => {
  if (role >= 100) return t('超级管理员');
  if (role >= 10) return t('管理员');
  return t('普通用户');
};

const formatQuota = (value) => Number(value || 0).toLocaleString();

export default function PersonalSettingsPage() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);

  const [userInfo, setUserInfo] = useState(null);
  const [oauthBindings, setOauthBindings] = useState([]);

  const [profileForm, setProfileForm] = useState({
    username: '',
    display_name: '',
  });

  const [preferences, setPreferences] = useState({ language: 'zh-CN' });
  const [notificationSettings, setNotificationSettings] = useState(
    defaultNotificationSettings,
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, oauthRes] = await Promise.all([
        API.get('/api/user/self'),
        API.get('/api/user/oauth/bindings'),
      ]);

      if (!userRes.data?.success) {
        showError(userRes.data?.message || t('加载用户信息失败'));
        setLoading(false);
        return;
      }

      const nextUser = userRes.data.data;
      setUserInfo(nextUser);
      setProfileForm({
        username: nextUser.username || '',
        display_name: nextUser.display_name || '',
      });

      const settings = parseUserSetting(nextUser.setting);
      setPreferences({
        language: settings.language || i18n.language || 'zh-CN',
      });

      setNotificationSettings({
        notify_type: settings.notify_type || 'email',
        quota_warning_threshold: Number(settings.quota_warning_threshold || 10),
        notification_email: settings.notification_email || nextUser.email || '',
        webhook_url: settings.webhook_url || '',
        webhook_secret: settings.webhook_secret || '',
        bark_url: settings.bark_url || '',
        gotify_url: settings.gotify_url || '',
        gotify_token: settings.gotify_token || '',
        gotify_priority: Number(settings.gotify_priority ?? 5),
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
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('加载失败'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProfileSave = async () => {
    const payload = {};
    const displayName = profileForm.display_name.trim();
    const username = profileForm.username.trim();

    if (!userInfo) return;

    if (displayName !== (userInfo.display_name || '')) {
      payload.display_name = displayName;
    }
    if (username && username !== (userInfo.username || '')) {
      payload.username = username;
    }

    if (Object.keys(payload).length === 0) {
      showSuccess(t('没有需要保存的资料变更'));
      return;
    }

    setSavingProfile(true);
    try {
      const res = await API.put('/api/user/self', payload);
      if (res.data?.success) {
        showSuccess(t('个人资料已更新'));
        await loadData();
      } else {
        showError(res.data?.message || t('更新失败'));
      }
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('更新失败'),
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleNotificationSave = async () => {
    const threshold = Number(notificationSettings.quota_warning_threshold);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      showError(t('预警阈值必须大于 0'));
      return;
    }

    const payload = {
      notify_type: notificationSettings.notify_type,
      quota_warning_threshold: threshold,
      notification_email: notificationSettings.notification_email || '',
      webhook_url: notificationSettings.webhook_url || '',
      webhook_secret: notificationSettings.webhook_secret || '',
      bark_url: notificationSettings.bark_url || '',
      gotify_url: notificationSettings.gotify_url || '',
      gotify_token: notificationSettings.gotify_token || '',
      gotify_priority: Number(notificationSettings.gotify_priority || 5),
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
        await loadData();
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

  const handlePreferenceSave = async () => {
    setSavingPreference(true);
    try {
      const res = await API.put('/api/user/self', {
        language: preferences.language,
      });
      if (res.data?.success) {
        showSuccess(t('偏好设置已保存'));
        await i18n.changeLanguage(preferences.language);
        await loadData();
      } else {
        showError(res.data?.message || t('保存失败'));
      }
    } catch (error) {
      showError(
        error?.response?.data?.message || error.message || t('保存失败'),
      );
    } finally {
      setSavingPreference(false);
    }
  };

  if (loading) {
    return (
      <div className='flex min-h-[280px] items-center justify-center'>
        <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='space-y-5'>
      <div className='grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]'>
        <Card className='overflow-hidden border-border/70 bg-card/95'>
          <CardContent className='p-0'>
            <div className='border-b border-border/60 bg-gradient-to-r from-primary/10 via-card to-card px-6 py-5'>
              <div className='flex flex-col gap-5 md:flex-row md:items-start md:justify-between'>
                <div className='flex items-center gap-4'>
                  <div className='flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-2xl font-semibold text-primary-foreground shadow-sm'>
                    {(userInfo?.display_name || userInfo?.username || 'U')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className='space-y-2'>
                    <div>
                      <div className='text-2xl font-semibold tracking-tight'>
                        {userInfo?.display_name || userInfo?.username || '-'}
                      </div>
                      <div className='mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
                        <span>@{userInfo?.username || '-'}</span>
                        <span className='text-muted-foreground'>•</span>
                        <span>{getRoleLabel(userInfo?.role, t)}</span>
                      </div>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <Badge variant='secondary'>
                        {t('用户 ID')}: {userInfo?.id ?? '-'}
                      </Badge>
                      <Badge variant='outline'>
                        {t('用户组')}: {userInfo?.group || '-'}
                      </Badge>
                      <Badge variant='outline'>
                        {t('已绑定身份')}:{' '}
                        {oauthFieldList.filter((item) => userInfo?.[item.field])
                          .length + oauthBindings.length}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className='grid min-w-[260px] grid-cols-2 gap-3'>
                  <div className='rounded-2xl border border-border/60 bg-background/80 p-4'>
                    <div className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                      {t('累计消耗')}
                    </div>
                    <div className='mt-2 text-2xl font-semibold'>
                      {formatQuota(userInfo?.used_quota)}
                    </div>
                  </div>
                  <div className='rounded-2xl border border-border/60 bg-background/80 p-4'>
                    <div className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                      {t('邀请人数')}
                    </div>
                    <div className='mt-2 text-2xl font-semibold'>
                      {formatQuota(userInfo?.aff_count)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='border-primary/15 bg-gradient-to-br from-primary/8 via-card to-secondary/10'>
          <CardHeader className='pb-3'>
            <CardDescription className='text-xs uppercase tracking-[0.16em]'>
              {t('账单概览')}
            </CardDescription>
            <CardTitle className='text-3xl font-semibold'>
              {formatQuota(userInfo?.quota)}
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='rounded-2xl border border-border/60 bg-background/85 p-4'>
              <div className='text-xs text-muted-foreground'>
                {t('邀请奖励余额')}
              </div>
              <div className='mt-1 text-lg font-semibold'>
                {formatQuota(userInfo?.aff_quota)}
              </div>
            </div>
            <div className='rounded-2xl border border-border/60 bg-background/85 p-4'>
              <div className='text-xs text-muted-foreground'>
                {t('历史收益')}
              </div>
              <div className='mt-1 text-lg font-semibold'>
                {formatQuota(userInfo?.aff_history_quota)}
              </div>
            </div>
            <div className='flex items-center justify-between rounded-2xl border border-border/60 bg-background/85 px-4 py-3 text-sm'>
              <span className='text-muted-foreground'>{t('Stripe 账户')}</span>
              <Badge
                variant={userInfo?.stripe_customer ? 'secondary' : 'outline'}
              >
                {userInfo?.stripe_customer ? t('已关联') : t('未关联')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]'>
        <div className='space-y-4'>
          <Card className='border-border/70'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-xl'>
                <User className='h-5 w-5' />
                {t('Profile')}
              </CardTitle>
              <CardDescription>{t('维护基础资料和账户标识')}</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <Input
                label={t('用户名')}
                value={profileForm.username}
                onChange={(event) => {
                  setProfileForm((prev) => ({
                    ...prev,
                    username: event.target.value,
                  }));
                }}
              />
              <Input
                label={t('显示名称')}
                value={profileForm.display_name}
                onChange={(event) => {
                  setProfileForm((prev) => ({
                    ...prev,
                    display_name: event.target.value,
                  }));
                }}
              />
              <div className='rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground'>
                <div>
                  {t('当前账户用于控制台登录名、显示名和管理身份识别。')}
                </div>
              </div>
              <Button
                onClick={handleProfileSave}
                loading={savingProfile}
                className='min-w-[124px]'
              >
                {t('保存资料')}
              </Button>
            </CardContent>
          </Card>

          <Card className='border-border/70'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-xl'>
                <Lock className='h-5 w-5' />
                {t('OAuth 绑定')}
              </CardTitle>
              <CardDescription>
                {t('查看当前账号与第三方身份绑定状态')}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid gap-3 md:grid-cols-2'>
                {oauthFieldList.map((item) => {
                  const value = userInfo?.[item.field];
                  return (
                    <div
                      key={item.key}
                      className='rounded-2xl border border-border/70 bg-background/70 p-4'
                    >
                      <div className='flex items-center justify-between gap-3'>
                        <div>
                          <div className='text-sm font-medium'>
                            {item.label}
                          </div>
                          <div className='mt-1 text-xs text-muted-foreground'>
                            {value || t('未连接')}
                          </div>
                        </div>
                        <Badge variant={value ? 'secondary' : 'outline'}>
                          {value ? t('已绑定') : t('未绑定')}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              {oauthBindings.length > 0 ? (
                <div className='space-y-2 border-t border-border/60 pt-3'>
                  <div className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                    {t('自定义 OAuth 提供商')}
                  </div>
                  <div className='grid gap-2'>
                    {oauthBindings.map((binding) => (
                      <div
                        key={`${binding.provider_id}-${binding.provider_slug}`}
                        className='flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm'
                      >
                        <span className='flex items-center gap-2'>
                          <Link2 className='h-3.5 w-3.5 text-muted-foreground' />
                          {binding.provider_name || binding.provider_slug}
                        </span>
                        <Badge variant='secondary'>{t('已绑定')}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div>
          <Tabs defaultValue={TAB_NOTIFICATION} className='w-full'>
            <TabsList className='grid h-auto w-full grid-cols-3 rounded-2xl border border-border/70 bg-muted/25 p-1.5'>
              <TabsTrigger
                value={TAB_NOTIFICATION}
                className='gap-2 rounded-xl py-3'
              >
                <Bell className='h-4 w-4' />
                {t('Notification')}
              </TabsTrigger>
              <TabsTrigger
                value={TAB_BILLING}
                className='gap-2 rounded-xl py-3'
              >
                <CreditCard className='h-4 w-4' />
                {t('Billing')}
              </TabsTrigger>
              <TabsTrigger
                value={TAB_PREFERENCES}
                className='gap-2 rounded-xl py-3'
              >
                <Globe className='h-4 w-4' />
                {t('Preferences')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={TAB_NOTIFICATION}>
              <NotificationTabContent
                t={t}
                settings={notificationSettings}
                onChange={(patch) => {
                  setNotificationSettings((prev) => ({ ...prev, ...patch }));
                }}
                onSave={handleNotificationSave}
                saving={savingNotify}
              />
            </TabsContent>

            <TabsContent value={TAB_BILLING}>
              <BillingTabContent t={t} userInfo={userInfo} />
            </TabsContent>

            <TabsContent value={TAB_PREFERENCES}>
              <PreferencesTabContent
                t={t}
                preferences={preferences}
                onLanguageChange={(language) => {
                  setPreferences((prev) => ({ ...prev, language }));
                }}
                onSave={handlePreferenceSave}
                saving={savingPreference}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
