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
import { Plus, Save } from 'lucide-react';
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

const defaultForm = {
  username: '',
  password: '',
  display_name: '',
  email: '',
  remark: '',
  group: '',
  quota: '',
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

const toTrimmedString = (value) => String(value ?? '').trim();

export default function AddUserModal({
  open = false,
  onClose = () => {},
  onSuccess,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(defaultForm);
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const quotaHint = useMemo(() => {
    const { ok, quota } = normalizeQuota(form.quota);
    if (!ok || quota === null || quota <= 0) {
      return '';
    }
    return `${t('原生额度')}: ${quota} · ${renderQuotaWithPrompt(quota)}`;
  }, [form.quota, t]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let mounted = true;
    const loadGroups = async () => {
      setLoadingGroups(true);
      try {
        const response = await API.get('/api/group/');
        if (!mounted) {
          return;
        }
        const nextGroups =
          response?.data?.success
            ? normalizeGroupList(response?.data?.data)
            : [];
        const safeGroups = nextGroups.length > 0 ? nextGroups : ['default'];
        setGroups(safeGroups);
        setForm((prev) => {
          const hasCurrent = prev.group && safeGroups.includes(prev.group);
          return {
            ...prev,
            group: hasCurrent ? prev.group : safeGroups[0] || '',
          };
        });
      } catch (error) {
        if (mounted) {
          showError(error?.message || t('获取分组失败'));
        }
      } finally {
        if (mounted) {
          setLoadingGroups(false);
        }
      }
    };

    loadGroups();
    return () => {
      mounted = false;
    };
  }, [open, t]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    onClose();
  };

  const findCreatedUser = async (username) => {
    const params = new URLSearchParams({
      keyword: username,
      group: '',
      p: '0',
      page_size: '20',
    });
    const response = await API.get(`/api/user/search?${params.toString()}`);
    if (!response?.data?.success) {
      return null;
    }
    const items = Array.isArray(response?.data?.data?.items)
      ? response.data.data.items
      : [];
    const exactUsers = items
      .filter((item) => toTrimmedString(item?.username) === username)
      .sort((left, right) => Number(right?.id || 0) - Number(left?.id || 0));
    return exactUsers[0] || null;
  };

  const syncCreatedUserProfile = async ({
    username,
    displayName,
    group,
    quota,
    remark,
  }) => {
    const normalizedRemark = toTrimmedString(remark);
    const shouldSync =
      Boolean(group) || quota !== null || Boolean(normalizedRemark);
    if (!shouldSync) {
      return;
    }

    const createdUser = await findCreatedUser(username);
    if (!createdUser?.id) {
      throw new Error(t('用户已创建，但未查询到新用户记录，请刷新后编辑用户修正分组'));
    }

    const currentGroup = toTrimmedString(createdUser.group);
    const targetGroup = toTrimmedString(group) || currentGroup || 'default';
    const currentQuota = Number(createdUser.quota || 0);
    const targetQuota = quota === null ? currentQuota : quota;
    const currentRemark = toTrimmedString(createdUser.remark);
    const targetDisplayName =
      toTrimmedString(displayName) ||
      toTrimmedString(createdUser.display_name) ||
      username;

    const needUpdate =
      currentGroup !== targetGroup ||
      currentQuota !== targetQuota ||
      currentRemark !== normalizedRemark;
    if (!needUpdate) {
      return;
    }

    const updatePayload = {
      id: Number(createdUser.id),
      username: toTrimmedString(createdUser.username) || username,
      display_name: targetDisplayName,
      group: targetGroup,
      pricing_group: targetGroup,
      quota: targetQuota,
      remark: normalizedRemark,
    };

    const updateResponse = await API.put('/api/user/', updatePayload);
    if (!updateResponse?.data?.success) {
      throw new Error(updateResponse?.data?.message || t('用户分组保存失败'));
    }
  };

  const submit = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      showError(t('用户名和密码必填'));
      return;
    }

    const { ok, quota } = normalizeQuota(form.quota);
    if (!ok) {
      showError(t('额度格式不正确'));
      return;
    }

    setSubmitting(true);
    let created = false;
    try {
      const payload = {
        username: form.username.trim(),
        password: form.password,
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        remark: form.remark.trim(),
      };

      if (form.group) {
        payload.group = form.group;
        payload.pricing_group = form.group;
      }
      if (quota !== null) {
        payload.quota = quota;
      }

      const response = await API.post('/api/user/', payload);
      if (!response?.data?.success) {
        showError(response?.data?.message || t('用户创建失败'));
        return;
      }
      created = true;

      await syncCreatedUserProfile({
        username: payload.username,
        displayName: payload.display_name,
        group: form.group,
        quota,
        remark: payload.remark,
      });

      showSuccess(t('用户创建成功'));
      onSuccess?.();
      setForm((prev) => ({ ...defaultForm, group: prev.group }));
      onClose();
    } catch (error) {
      if (created) {
        showError(
          error?.message ||
            t('用户已创建，但分组或额度保存失败，请刷新后在编辑用户中修正'),
        );
        onSuccess?.();
        onClose();
      } else {
        showError(error?.message || t('用户创建失败'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? handleClose() : null)}>
      <DialogContent className='max-h-[88vh] w-[min(96vw,56rem)] overflow-y-auto rounded-[24px] border-[#e7ebf3] bg-[#f7f9fc] p-0 shadow-[0_30px_90px_rgba(15,23,42,0.16)]'>
        <DialogHeader className='space-y-2 border-b border-[#e7ebf3] bg-white px-6 py-5'>
          <div className='flex items-start justify-between gap-3'>
            <div className='space-y-1'>
              <DialogTitle className='text-2xl font-semibold text-slate-900'>
                {t('添加用户')}
              </DialogTitle>
              <DialogDescription className='text-sm text-slate-500'>
                {t('按 Stitch 管理台样式创建用户，保持旧版业务字段与提交逻辑。')}
              </DialogDescription>
            </div>
            <div className='rounded-2xl border border-[#e7ebf3] bg-[#eef2ff] p-2 text-[#3652f5]'>
              <Plus className='h-5 w-5' />
            </div>
          </div>
        </DialogHeader>

        <div className='space-y-4 px-6 py-5'>
          <section className='space-y-3 rounded-[20px] border border-[#e7ebf3] bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]'>
            <h3 className='text-sm font-semibold text-slate-900'>
              {t('基础信息')}
            </h3>
            <div className='grid gap-3 md:grid-cols-2'>
              <Input
                label={t('用户名')}
                value={form.username}
                onChange={(event) => updateField('username', event.target.value)}
                placeholder={t('请输入用户名')}
              />
              <Input
                type='password'
                label={t('密码')}
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder={t('请输入密码')}
              />
              <Input
                label={t('显示名称')}
                value={form.display_name}
                onChange={(event) =>
                  updateField('display_name', event.target.value)
                }
                placeholder={t('请输入显示名称')}
              />
              <Input
                label={t('邮箱')}
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder={t('请输入邮箱（可选）')}
              />
            </div>
            <Input
              label={t('备注')}
              value={form.remark}
              onChange={(event) => updateField('remark', event.target.value)}
              placeholder={t('请输入备注（仅管理员可见）')}
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
                  disabled={loadingGroups}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingGroups ? t('分组加载中...') : t('请选择分组')
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
                label={t('初始额度 (USD)')}
                value={form.quota}
                onChange={(event) => updateField('quota', event.target.value)}
                placeholder={t('例如 1.5，留空表示使用系统默认值')}
              />
            </div>
            {quotaHint ? (
              <p className='text-xs text-slate-500'>{quotaHint}</p>
            ) : null}
          </section>
        </div>

        <DialogFooter className='border-t border-[#e7ebf3] bg-white px-6 py-4'>
          <Button
            variant='outline'
            onClick={handleClose}
            disabled={submitting}
          >
            {t('取消')}
          </Button>
          <Button onClick={submit} loading={submitting} disabled={submitting}>
            <Save className='mr-2 h-4 w-4' />
            {t('创建用户')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
