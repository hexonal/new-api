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
import { Mail, Shield, Wallet } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../primitives/card';
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

export const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'ru', label: 'Русский' },
  { value: 'ja', label: '日本語' },
  { value: 'vi', label: 'Tiếng Việt' },
];

export const NOTIFY_TYPES = [
  { value: 'email', label: 'Email' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'bark', label: 'Bark' },
  { value: 'gotify', label: 'Gotify' },
];

export function NotificationTabContent({
  t,
  settings,
  onChange,
  onSave,
  saving,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('通知设置')}</CardTitle>
        <CardDescription>{t('配置额度预警渠道与风控偏好')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div>
          <div className='mb-1.5 text-sm font-medium'>{t('通知方式')}</div>
          <Select
            value={settings.notify_type}
            onValueChange={(value) => {
              onChange({ notify_type: value });
            }}
          >
            <SelectTrigger>
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
        </div>

        <Input
          label={t('额度预警阈值')}
          type='number'
          min='1'
          value={String(settings.quota_warning_threshold)}
          onChange={(event) => {
            onChange({ quota_warning_threshold: event.target.value });
          }}
        />

        {settings.notify_type === 'email' ? (
          <Input
            label={t('通知邮箱')}
            icon={<Mail className='h-4 w-4' />}
            value={settings.notification_email}
            onChange={(event) => {
              onChange({ notification_email: event.target.value });
            }}
          />
        ) : null}

        {settings.notify_type === 'webhook' ? (
          <>
            <Input
              label={t('Webhook URL')}
              value={settings.webhook_url}
              onChange={(event) => {
                onChange({ webhook_url: event.target.value });
              }}
            />
            <Input
              label={t('Webhook Secret')}
              value={settings.webhook_secret}
              onChange={(event) => {
                onChange({ webhook_secret: event.target.value });
              }}
            />
          </>
        ) : null}

        {settings.notify_type === 'bark' ? (
          <Input
            label={t('Bark URL')}
            value={settings.bark_url}
            onChange={(event) => {
              onChange({ bark_url: event.target.value });
            }}
          />
        ) : null}

        {settings.notify_type === 'gotify' ? (
          <>
            <Input
              label={t('Gotify URL')}
              value={settings.gotify_url}
              onChange={(event) => {
                onChange({ gotify_url: event.target.value });
              }}
            />
            <Input
              label={t('Gotify Token')}
              value={settings.gotify_token}
              onChange={(event) => {
                onChange({ gotify_token: event.target.value });
              }}
            />
            <Input
              label={t('Gotify Priority (0-10)')}
              type='number'
              min='0'
              max='10'
              value={String(settings.gotify_priority)}
              onChange={(event) => {
                onChange({ gotify_priority: event.target.value });
              }}
            />
          </>
        ) : null}

        <div className='rounded-lg border border-border px-3 py-2 text-sm'>
          <div className='flex items-center justify-between'>
            <span>{t('接受未设置模型比率')}</span>
            <Switch
              checked={settings.accept_unset_model_ratio_model}
              onCheckedChange={(checked) => {
                onChange({ accept_unset_model_ratio_model: checked });
              }}
            />
          </div>
        </div>
        <div className='rounded-lg border border-border px-3 py-2 text-sm'>
          <div className='flex items-center justify-between'>
            <span>{t('记录请求 IP 日志')}</span>
            <Switch
              checked={settings.record_ip_log}
              onCheckedChange={(checked) => {
                onChange({ record_ip_log: checked });
              }}
            />
          </div>
        </div>

        <Button onClick={onSave} loading={saving}>
          {t('保存通知设置')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function BillingTabContent({ t, userInfo }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Billing Overview')}</CardTitle>
        <CardDescription>{t('额度、邀请收益与支付账户状态')}</CardDescription>
      </CardHeader>
      <CardContent className='grid grid-cols-1 gap-3 md:grid-cols-2'>
        <div className='rounded-lg border border-border p-3'>
          <div className='mb-1 text-xs text-muted-foreground'>
            {t('当前余额')}
          </div>
          <div className='text-xl font-semibold'>{userInfo?.quota ?? 0}</div>
        </div>
        <div className='rounded-lg border border-border p-3'>
          <div className='mb-1 text-xs text-muted-foreground'>
            {t('累计消耗')}
          </div>
          <div className='text-xl font-semibold'>
            {userInfo?.used_quota ?? 0}
          </div>
        </div>
        <div className='rounded-lg border border-border p-3'>
          <div className='mb-1 text-xs text-muted-foreground'>
            {t('邀请奖励余额')}
          </div>
          <div className='text-xl font-semibold'>
            {userInfo?.aff_quota ?? 0}
          </div>
        </div>
        <div className='rounded-lg border border-border p-3'>
          <div className='mb-1 text-xs text-muted-foreground'>
            {t('Stripe 账户')}
          </div>
          <div className='text-sm font-medium'>
            {userInfo?.stripe_customer ? t('已关联') : t('未关联')}
          </div>
        </div>
        <div className='rounded-lg border border-border p-3 md:col-span-2'>
          <div className='mb-1 text-xs text-muted-foreground'>
            {t('邀请统计')}
          </div>
          <div className='flex items-center gap-3'>
            <Wallet className='h-4 w-4 text-muted-foreground' />
            <span>
              {t('邀请人数')}: {userInfo?.aff_count ?? 0} · {t('历史收益')}:{' '}
              {userInfo?.aff_history_quota ?? 0}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PreferencesTabContent({
  t,
  preferences,
  onLanguageChange,
  onSave,
  saving,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('偏好设置')}</CardTitle>
        <CardDescription>{t('界面语言与个人体验偏好')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div>
          <div className='mb-1.5 text-sm font-medium'>{t('界面语言')}</div>
          <Select
            value={preferences.language}
            onValueChange={(value) => {
              onLanguageChange(value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('选择语言')} />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground'>
          <div className='flex items-center gap-2'>
            <Shield className='h-3.5 w-3.5' />
            <span>{t('偏好设置通过 /api/user/self 的 language 字段保存')}</span>
          </div>
        </div>

        <Button onClick={onSave} loading={saving}>
          {t('保存偏好设置')}
        </Button>
      </CardContent>
    </Card>
  );
}
