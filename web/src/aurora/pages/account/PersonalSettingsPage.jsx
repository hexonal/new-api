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
    <div className='grid grid-cols-1 gap-4 xl:grid-cols-5'>
      <div className='space-y-4 xl:col-span-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <User className='h-4 w-4' />
              {t('Profile')}
            </CardTitle>
            <CardDescription>{t('维护基础资料和账户标识')}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
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
            <div className='rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground'>
              <div>
                {t('用户 ID')}: {userInfo?.id ?? '-'}
              </div>
              <div>
                {t('用户组')}: {userInfo?.group || '-'}
              </div>
            </div>
            <Button onClick={handleProfileSave} loading={savingProfile}>
              {t('保存资料')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Lock className='h-4 w-4' />
              {t('OAuth 绑定')}
            </CardTitle>
            <CardDescription>
              {t('查看当前账号与第三方身份绑定状态')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {oauthFieldList.map((item) => {
              const value = userInfo?.[item.field];
              return (
                <div
                  key={item.key}
                  className='flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm'
                >
                  <span>{item.label}</span>
                  <Badge variant={value ? 'default' : 'outline'}>
                    {value ? t('已绑定') : t('未绑定')}
                  </Badge>
                </div>
              );
            })}
            {oauthBindings.length > 0 ? (
              <div className='pt-2'>
                <div className='mb-2 text-xs text-muted-foreground'>
                  {t('自定义 OAuth 提供商')}
                </div>
                <div className='space-y-2'>
                  {oauthBindings.map((binding) => (
                    <div
                      key={`${binding.provider_id}-${binding.provider_slug}`}
                      className='flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm'
                    >
                      <span className='flex items-center gap-2'>
                        <Link2 className='h-3.5 w-3.5 text-muted-foreground' />
                        {binding.provider_name || binding.provider_slug}
                      </span>
                      <Badge>{t('已绑定')}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className='xl:col-span-3'>
        <Tabs defaultValue='notification' className='w-full'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='notification' className='gap-2'>
              <Bell className='h-4 w-4' />
              {t('Notification')}
            </TabsTrigger>
            <TabsTrigger value='billing' className='gap-2'>
              <CreditCard className='h-4 w-4' />
              {t('Billing')}
            </TabsTrigger>
            <TabsTrigger value='preferences' className='gap-2'>
              <Globe className='h-4 w-4' />
              {t('Preferences')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='notification'>
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

          <TabsContent value='billing'>
            <BillingTabContent t={t} userInfo={userInfo} />
          </TabsContent>

          <TabsContent value='preferences'>
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
  );
}
