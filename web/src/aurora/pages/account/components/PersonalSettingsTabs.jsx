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
import { Globe, Lock, Mail, Shield, Trash2, Wallet } from 'lucide-react';
import { Input } from '../../../primitives/input';
import { Button } from '../../../primitives/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../primitives/select';
import { Switch } from '../../../primitives/switch';
import { Badge } from '../../../primitives/badge';

export const NOTIFY_TYPES = [
  { value: 'email', label: 'Email' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'bark', label: 'Bark' },
  { value: 'gotify', label: 'Gotify' },
];

function SettingsRow({ label, children }) {
  return (
    <div className='space-y-1'>
      <p className='text-[11px] font-semibold uppercase tracking-wide text-slate-500'>
        {label}
      </p>
      {children}
    </div>
  );
}

export function NotificationTabContent({
  t,
  settings,
  onChange,
  onSave,
  saving,
  showUpstreamModelSwitch = true,
}) {
  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm'>
      <div className='mb-4'>
        <h3 className='text-sm font-semibold text-slate-900'>{t('通知设置')}</h3>
        <p className='mt-1 text-xs text-slate-500'>
          {t('配置额度预警渠道与风控偏好')}
        </p>
      </div>
      <div className='space-y-3'>
        <SettingsRow label={t('通知方式')}>
          <Select
            value={settings.notify_type}
            onValueChange={(value) => {
              onChange({ notify_type: value });
            }}
          >
            <SelectTrigger className='h-9 rounded-lg border-slate-200 bg-slate-50 text-sm'>
              <SelectValue placeholder={t('选择通知方式')} />
            </SelectTrigger>
            <SelectContent>
              {NOTIFY_TYPES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow label={t('额度预警阈值')}>
          <Input
            type='number'
            min='1'
            value={String(settings.quota_warning_threshold)}
            onChange={(event) => {
              onChange({ quota_warning_threshold: event.target.value });
            }}
            className='h-9 rounded-lg border-slate-200 bg-slate-50 text-sm'
          />
        </SettingsRow>

        {settings.notify_type === 'email' ? (
          <SettingsRow label={t('通知邮箱')}>
            <Input
              icon={<Mail className='h-4 w-4 text-slate-400' />}
              value={settings.notification_email}
              onChange={(event) => {
                onChange({ notification_email: event.target.value });
              }}
              className='h-9 rounded-lg border-slate-200 bg-slate-50 text-sm'
            />
          </SettingsRow>
        ) : null}

        {settings.notify_type === 'webhook' ? (
          <>
            <SettingsRow label='Webhook URL'>
              <Input
                value={settings.webhook_url}
                onChange={(event) => {
                  onChange({ webhook_url: event.target.value });
                }}
                className='h-9 rounded-lg border-slate-200 bg-slate-50 text-sm'
              />
            </SettingsRow>
            <SettingsRow label='Webhook Secret'>
              <Input
                value={settings.webhook_secret}
                onChange={(event) => {
                  onChange({ webhook_secret: event.target.value });
                }}
                className='h-9 rounded-lg border-slate-200 bg-slate-50 text-sm'
              />
            </SettingsRow>
          </>
        ) : null}

        {settings.notify_type === 'bark' ? (
          <SettingsRow label='Bark URL'>
            <Input
              value={settings.bark_url}
              onChange={(event) => {
                onChange({ bark_url: event.target.value });
              }}
              className='h-9 rounded-lg border-slate-200 bg-slate-50 text-sm'
            />
          </SettingsRow>
        ) : null}

        {settings.notify_type === 'gotify' ? (
          <>
            <SettingsRow label='Gotify URL'>
              <Input
                value={settings.gotify_url}
                onChange={(event) => {
                  onChange({ gotify_url: event.target.value });
                }}
                className='h-9 rounded-lg border-slate-200 bg-slate-50 text-sm'
              />
            </SettingsRow>
            <SettingsRow label='Gotify Token'>
              <Input
                value={settings.gotify_token}
                onChange={(event) => {
                  onChange({ gotify_token: event.target.value });
                }}
                className='h-9 rounded-lg border-slate-200 bg-slate-50 text-sm'
              />
            </SettingsRow>
            <SettingsRow label='Gotify Priority'>
              <Input
                type='number'
                min='0'
                max='10'
                value={String(settings.gotify_priority)}
                onChange={(event) => {
                  onChange({ gotify_priority: event.target.value });
                }}
                className='h-9 rounded-lg border-slate-200 bg-slate-50 text-sm'
              />
            </SettingsRow>
          </>
        ) : null}

        <div className='rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm'>
          <div className='flex items-center justify-between'>
            <span className='text-slate-700'>{t('接受未设置模型比率')}</span>
            <Switch
              checked={settings.accept_unset_model_ratio_model}
              onCheckedChange={(checked) => {
                onChange({ accept_unset_model_ratio_model: checked });
              }}
            />
          </div>
        </div>
        <div className='rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm'>
          <div className='flex items-center justify-between'>
            <span className='text-slate-700'>{t('记录请求 IP 日志')}</span>
            <Switch
              checked={settings.record_ip_log}
              onCheckedChange={(checked) => {
                onChange({ record_ip_log: checked });
              }}
            />
          </div>
        </div>
        {showUpstreamModelSwitch ? (
          <div className='rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm'>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-slate-700'>
                {t('上游模型变更通知')}
              </span>
              <Switch
                checked={settings.upstream_model_update_notify_enabled}
                onCheckedChange={(checked) => {
                  onChange({ upstream_model_update_notify_enabled: checked });
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <Button
        onClick={onSave}
        loading={saving}
        className='mt-4 h-9 w-full rounded-lg bg-indigo-600 text-sm font-semibold hover:bg-indigo-500'
      >
        {t('保存通知设置')}
      </Button>
    </div>
  );
}

export function BillingTabContent({ t, userInfo }) {
  return (
    <div className='space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm'>
      <div>
        <h3 className='text-sm font-semibold text-slate-900'>{t('Billing')}</h3>
        <p className='mt-1 text-xs text-slate-500'>
          {t('额度、邀请收益与支付账户状态')}
        </p>
      </div>

      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <MetricCard label={t('当前余额')} value={userInfo?.quota ?? 0} />
        <MetricCard label={t('累计消耗')} value={userInfo?.used_quota ?? 0} />
        <MetricCard label={t('邀请奖励余额')} value={userInfo?.aff_quota ?? 0} />
        <MetricCard
          label={t('Stripe 账户')}
          value={userInfo?.stripe_customer ? t('已关联') : t('未关联')}
        />
      </div>

      <div className='rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600'>
        <div className='mb-1 text-[11px] uppercase tracking-wide text-slate-500'>
          {t('邀请统计')}
        </div>
        <div className='flex items-center gap-2'>
          <Wallet className='h-3.5 w-3.5' />
          <span>
            {t('邀请人数')}: {userInfo?.aff_count ?? 0} · {t('历史收益')}:{' '}
            {userInfo?.aff_history_quota ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className='rounded-lg border border-slate-200 bg-slate-50 p-3'>
      <p className='text-[11px] uppercase tracking-wide text-slate-500'>{label}</p>
      <p className='mt-1 text-lg font-semibold text-slate-900'>{value}</p>
    </div>
  );
}

export function PreferencesTabContent({
  t,
  language,
  languageSaving,
  onLanguageChange,
  passkeySupported,
  passkeyEnabled,
  passkeyLoading,
  onRegisterPasskey,
  onRemovePasskey,
  tokenLoading,
  onResetToken,
  onOpenChangePassword,
  onOpenDeleteAccount,
  canDeleteAccount = true,
}) {
  const languageOptions = [
    { code: 'zh-CN', label: '简体中文' },
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'ja', label: '日本語' },
    { code: 'ru', label: 'Русский' },
    { code: 'vi', label: 'Tiếng Việt' },
  ];

  return (
    <div className='space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm'>
      <div>
        <h3 className='text-sm font-semibold text-slate-900'>{t('Advanced')}</h3>
        <p className='mt-1 text-xs text-slate-500'>
          {t('认证能力与安全凭据')}
        </p>
      </div>

      <div className='rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm'>
        <div className='mb-2 flex items-center gap-2 text-slate-700'>
          <Globe className='h-4 w-4' />
          <span className='font-medium'>{t('语言偏好')}</span>
        </div>
        <p className='mb-2 text-xs text-slate-500'>
          {t('选择您的首选界面语言，设置将自动同步到当前账号。')}
        </p>
        <div>
          <Select
            value={language}
            onValueChange={(value) => {
              onLanguageChange(value);
            }}
            disabled={languageSaving}
          >
            <SelectTrigger className='h-9 rounded-lg border-slate-200 bg-white text-sm'>
              <SelectValue placeholder={t('选择语言')} />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm'>
        <div className='mb-2 flex items-center gap-2 text-slate-700'>
          <Shield className='h-4 w-4' />
          <span className='font-medium'>{t('Passkey')}</span>
          <Badge variant={passkeyEnabled ? 'default' : 'outline'}>
            {passkeyEnabled ? t('已启用') : t('未启用')}
          </Badge>
        </div>
        <p className='mb-2 text-xs text-slate-500'>
          {passkeySupported
            ? t('当前设备支持 Passkey，可用于无密码认证。')
            : t('当前设备不支持 Passkey。')}
        </p>
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            className='h-8 rounded-lg text-xs'
            disabled={!passkeySupported || passkeyLoading}
            loading={passkeyLoading && !passkeyEnabled}
            onClick={onRegisterPasskey}
          >
            {t('启用 Passkey')}
          </Button>
          <Button
            variant='outline'
            className='h-8 rounded-lg text-xs'
            disabled={!passkeyEnabled || passkeyLoading}
            loading={passkeyLoading && passkeyEnabled}
            onClick={onRemovePasskey}
          >
            {t('移除 Passkey')}
          </Button>
        </div>
      </div>

      <div className='rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm'>
        <p className='mb-2 font-medium text-slate-700'>{t('系统令牌')}</p>
        <p className='mb-2 text-xs text-slate-500'>
          {t('重置后会自动复制到剪贴板，请妥善保管。')}
        </p>
        <Button
          variant='outline'
          className='h-8 rounded-lg text-xs'
          loading={tokenLoading}
          onClick={onResetToken}
        >
          {t('重置并复制令牌')}
        </Button>
      </div>

      <div className='rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm'>
        <div className='mb-2 flex items-center gap-2 text-slate-700'>
          <Lock className='h-4 w-4' />
          <span className='font-medium'>{t('密码管理')}</span>
        </div>
        <p className='mb-2 text-xs text-slate-500'>
          {t('定期更改密码可以提高账户安全性。')}
        </p>
        <Button
          variant='outline'
          className='h-8 rounded-lg text-xs'
          onClick={onOpenChangePassword}
        >
          {t('修改密码')}
        </Button>
      </div>

      <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm'>
        <div className='mb-2 flex items-center gap-2 text-red-700'>
          <Trash2 className='h-4 w-4' />
          <span className='font-medium'>{t('危险操作')}</span>
        </div>
        <p className='mb-2 text-xs text-red-600'>
          {t('删除账户后将无法恢复，请谨慎操作。')}
        </p>
        <Button
          variant='destructive'
          className='h-8 rounded-lg text-xs'
          disabled={!canDeleteAccount}
          onClick={onOpenDeleteAccount}
        >
          {canDeleteAccount ? t('删除账户') : t('Root 用户不可删除')}
        </Button>
      </div>
    </div>
  );
}
