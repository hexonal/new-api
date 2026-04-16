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

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PencilLine, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../primitives/select';
import { API, renderQuotaWithPrompt, showError, showSuccess } from '../../../helpers';
import { getQuotaPerUnit } from '../../../helpers/quota';

const emptyForm = {
  username: '',
  display_name: '',
  password: '',
  email: '',
  remark: '',
  group: '',
  quota: '',
  github_id: '',
  oidc_id: '',
  discord_id: '',
  wechat_id: '',
  telegram_id: '',
  linux_do_id: '',
};

const normalizeQuota = (value) => {
  if (String(value).trim() === '') {
    return { ok: true, quota: null };
  }
  const quotaUSD = Number(value);
  if (!Number.isFinite(quotaUSD) || quotaUSD < 0) {
    return { ok: false, quota: null };
  }
  const quota = Math.round(quotaUSD * getQuotaPerUnit());
  return { ok: true, quota };
};

const formatUSDFromQuota = (quota) => {
  const normalizedQuota = Number(quota);
  if (!Number.isFinite(normalizedQuota) || normalizedQuota < 0) {
    return '';
  }
  if (normalizedQuota === 0) {
    return '0';
  }
  const usd = normalizedQuota / getQuotaPerUnit();
  return usd.toFixed(6).replace(/\.?0+$/, '');
};

const pickString = (value) => (value === null || value === undefined ? '' : String(value));

const normalizeGroupList = (rawGroups) => {
  if (!Array.isArray(rawGroups)) {
    return [];
  }
  const normalized = rawGroups
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      if (item && typeof item === 'object') {
        return item.group || item.name || item.value || item.label || '';
      }
      return '';
    })
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const defaultBindingStatus = {
  github_oauth: false,
  discord_oauth: false,
  oidc_enabled: false,
  wechat_login: false,
  telegram_oauth: false,
  linuxdo_oauth: false,
};

export default function EditUserModal({
  open = false,
  onClose = () => {},
  user,
  onSuccess,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [groups, setGroups] = useState([]);
  const [bindingStatus, setBindingStatus] = useState(defaultBindingStatus);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const userId = user?.id;

  const quotaHint = useMemo(() => {
    const { ok, quota } = normalizeQuota(form.quota);
    if (!ok || quota === null || quota <= 0) {
      return '';
    }
    return `${t('原生额度')}: ${quota} · ${renderQuotaWithPrompt(quota)}`;
  }, [form.quota, t]);

  const bindingFields = useMemo(() => {
    const allFields = [
      {
        key: 'github_id',
        label: 'GitHub ID',
        placeholder: 'GitHub ID',
        enabled: Boolean(bindingStatus.github_oauth),
      },
      {
        key: 'oidc_id',
        label: 'OIDC ID',
        placeholder: 'OIDC ID',
        enabled: Boolean(bindingStatus.oidc_enabled),
      },
      {
        key: 'discord_id',
        label: 'Discord ID',
        placeholder: 'Discord ID',
        enabled: Boolean(bindingStatus.discord_oauth),
      },
      {
        key: 'wechat_id',
        label: 'WeChat ID',
        placeholder: 'WeChat ID',
        enabled: Boolean(bindingStatus.wechat_login),
      },
      {
        key: 'telegram_id',
        label: 'Telegram ID',
        placeholder: 'Telegram ID',
        enabled: Boolean(bindingStatus.telegram_oauth),
      },
      {
        key: 'linux_do_id',
        label: 'LinuxDo ID',
        placeholder: 'LinuxDo ID',
        enabled: Boolean(bindingStatus.linuxdo_oauth),
      },
    ];

    // 与旧版一致：未启用时不展示输入；若历史已绑定值存在，仍展示便于查看/清理。
    return allFields.filter(
      (field) => field.enabled || Boolean(pickString(form[field.key]).trim()),
    );
  }, [bindingStatus, form]);

  useEffect(() => {
    if (!open || !userId) {
      if (!open) {
        setForm(emptyForm);
        setBindingStatus(defaultBindingStatus);
      }
      return;
    }

    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [userResponse, groupsResponse, statusResponse] = await Promise.all([
          API.get(`/api/user/${userId}`),
          API.get('/api/group/'),
          API.get('/api/status'),
        ]);

        if (!mounted) {
          return;
        }

        if (!userResponse?.data?.success) {
          showError(userResponse?.data?.message || t('用户信息加载失败'));
          return;
        }

        const userData = userResponse.data.data || {};
        const currentUserGroup = pickString(userData.group).trim();
        const nextGroups = groupsResponse?.data?.success
          ? normalizeGroupList(groupsResponse?.data?.data)
          : [];
        if (currentUserGroup && !nextGroups.includes(currentUserGroup)) {
          nextGroups.unshift(currentUserGroup);
        }
        const safeGroups = nextGroups.length > 0 ? nextGroups : ['default'];
        setGroups(safeGroups);

        const nextBindingStatus = statusResponse?.data?.success
          ? {
              ...defaultBindingStatus,
              ...(statusResponse?.data?.data || {}),
            }
          : defaultBindingStatus;
        setBindingStatus(nextBindingStatus);

        setForm({
          username: pickString(userData.username),
          display_name: pickString(userData.display_name),
          password: '',
          email: pickString(userData.email),
          remark: pickString(userData.remark),
          group: currentUserGroup || safeGroups[0] || '',
          quota: formatUSDFromQuota(userData.quota ?? ''),
          github_id: pickString(userData.github_id),
          oidc_id: pickString(userData.oidc_id),
          discord_id: pickString(userData.discord_id),
          wechat_id: pickString(userData.wechat_id),
          telegram_id: pickString(userData.telegram_id),
          linux_do_id: pickString(userData.linux_do_id),
        });
      } catch (error) {
        if (mounted) {
          showError(error?.message || t('用户信息加载失败'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [open, userId, t]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    onClose();
  };

  const submit = async () => {
    if (!userId) {
      return;
    }
    if (!form.username.trim()) {
      showError(t('用户名不能为空'));
      return;
    }

    const { ok, quota } = normalizeQuota(form.quota);
    if (!ok) {
      showError(t('额度格式不正确'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: Number(userId),
        username: form.username.trim(),
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        remark: form.remark.trim(),
        group: form.group,
        pricing_group: form.group,
        github_id: form.github_id.trim(),
        oidc_id: form.oidc_id.trim(),
        discord_id: form.discord_id.trim(),
        wechat_id: form.wechat_id.trim(),
        telegram_id: form.telegram_id.trim(),
        linux_do_id: form.linux_do_id.trim(),
      };

      if (form.password.trim()) {
        payload.password = form.password;
      }
      if (quota !== null) {
        payload.quota = quota;
      }

      const response = await API.put('/api/user/', payload);
      if (!response?.data?.success) {
        showError(response?.data?.message || t('用户更新失败'));
        return;
      }

      showSuccess(t('用户信息更新成功'));
      onSuccess?.();
      onClose();
    } catch (error) {
      showError(error?.message || t('用户更新失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? handleClose() : null)}>
      <DialogContent className='max-h-[88vh] w-[min(96vw,64rem)] overflow-y-auto rounded-[24px] border-[#e7ebf3] bg-[#f7f9fc] p-0 shadow-[0_30px_90px_rgba(15,23,42,0.16)]'>
        <DialogHeader className='space-y-2 border-b border-[#e7ebf3] bg-white px-6 py-5'>
          <div className='flex items-start justify-between gap-3'>
            <div className='space-y-1'>
              <DialogTitle className='text-2xl font-semibold text-slate-900'>
                {t('编辑用户')}
              </DialogTitle>
              <DialogDescription className='text-sm text-slate-500'>
                {t('按 Stitch 信息层级编辑用户资料、分组、额度与账号绑定。')}
              </DialogDescription>
            </div>
            <div className='rounded-2xl border border-[#e7ebf3] bg-[#eef2ff] p-2 text-[#3652f5]'>
              <PencilLine className='h-5 w-5' />
            </div>
          </div>
        </DialogHeader>

        <div className='space-y-4 px-6 py-5'>
          <section className='space-y-3 rounded-[20px] border border-[#e7ebf3] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]'>
            <h3 className='text-sm font-semibold text-slate-900'>
              {t('基础资料')}
            </h3>
            <div className='grid gap-3 md:grid-cols-2'>
              <Input
                label={t('用户名')}
                value={form.username}
                onChange={(event) => updateField('username', event.target.value)}
                placeholder={t('请输入用户名')}
                disabled={loading}
              />
              <Input
                label={t('显示名称')}
                value={form.display_name}
                onChange={(event) =>
                  updateField('display_name', event.target.value)
                }
                placeholder={t('请输入显示名称')}
                disabled={loading}
              />
              <Input
                type='password'
                label={t('重置密码')}
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder={t('留空表示不修改')}
                disabled={loading}
              />
              <Input
                label={t('邮箱')}
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder={t('请输入邮箱')}
                disabled={loading}
              />
            </div>
            <Input
              label={t('备注')}
              value={form.remark}
              onChange={(event) => updateField('remark', event.target.value)}
              placeholder={t('请输入备注')}
              disabled={loading}
            />
          </section>

          <section className='space-y-3 rounded-[20px] border border-[#e7ebf3] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]'>
            <h3 className='text-sm font-semibold text-slate-900'>
              {t('权限与额度')}
            </h3>
            <div className='grid gap-3 md:grid-cols-2'>
              <label className='space-y-1.5'>
                <span className='text-sm font-medium text-slate-900'>
                  {t('分组')}
                </span>
                <Select
                  value={form.group || undefined}
                  onValueChange={(value) => updateField('group', value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loading ? t('分组加载中...') : t('请选择分组')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <Input
                type='number'
                min='0'
                step='0.01'
                label={t('剩余额度 (USD)')}
                value={form.quota}
                onChange={(event) => updateField('quota', event.target.value)}
                placeholder={t('例如 2.0')}
                disabled={loading}
              />
            </div>
            {quotaHint ? (
              <p className='text-xs text-slate-500'>{quotaHint}</p>
            ) : null}
          </section>

          <section className='space-y-3 rounded-[20px] border border-[#e7ebf3] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]'>
            <h3 className='text-sm font-semibold text-slate-900'>
              {t('账号绑定')}
            </h3>
            {bindingFields.length > 0 ? (
              <div className='grid gap-3 md:grid-cols-2'>
                {bindingFields.map((field) => (
                  <Input
                    key={field.key}
                    label={field.label}
                    value={form[field.key]}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    disabled={loading}
                  />
                ))}
              </div>
            ) : (
              <div className='grid gap-3 md:grid-cols-2'>
                <div className='md:col-span-2 h-12 rounded-xl border border-dashed border-[#d7dfec] bg-[#f8fbff] px-4 text-sm text-slate-500 flex items-center'>
                  {t('当前未启用第三方登录绑定项')}
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className='border-t border-[#e7ebf3] bg-white px-6 py-4'>
          <Button
            variant='outline'
            onClick={handleClose}
            disabled={submitting || loading}
          >
            {t('取消')}
          </Button>
          <Button
            onClick={submit}
            loading={submitting}
            disabled={submitting || loading}
          >
            <Save className='mr-2 h-4 w-4' />
            {t('保存修改')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
