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
import { Clock3, KeyRound, Plus, Save, Shield, Wallet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../primitives/dialog';
import { Input } from '../primitives/input';
import { Button } from '../primitives/button';
import { Checkbox } from '../primitives/checkbox';
import { Switch } from '../primitives/switch';
import { Badge } from '../primitives/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../primitives/card';
import {
  API,
  renderQuotaWithPrompt,
  showError,
  showSuccess,
} from '../../helpers';
import {
  buildTokenCreatePayloads,
  getTokenFormInitialValues,
  normalizeTokenFormPayload,
  resolveDefaultGroupValue,
  toDateTimeLocalValue,
} from './token-modal-utils';

const generateRandomSuffix = () => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let index = 0; index < 6; index += 1) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
};

const formatGroupOptions = (groupMap = {}, selfGroup = '') =>
  Object.entries(groupMap)
    .map(([group, info]) => ({
      value: group,
      label: info?.desc || group,
    }))
    .filter(
      (item) => !selfGroup || item.value === selfGroup || item.value === 'auto',
    );

const setExpiryOffset = (setForm, seconds) => {
  if (!seconds) {
    setForm((prev) => ({ ...prev, expired_time: '' }));
    return;
  }

  const nextDate = new Date(Date.now() + seconds * 1000);
  const year = nextDate.getFullYear();
  const month = `${nextDate.getMonth() + 1}`.padStart(2, '0');
  const day = `${nextDate.getDate()}`.padStart(2, '0');
  const hours = `${nextDate.getHours()}`.padStart(2, '0');
  const minutes = `${nextDate.getMinutes()}`.padStart(2, '0');

  setForm((prev) => ({
    ...prev,
    expired_time: `${year}-${month}-${day}T${hours}:${minutes}`,
  }));
};

const SectionCard = ({ icon, title, description, children }) => (
  <Card className='rounded-[24px] border-[#e7ebf3] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]'>
    <CardHeader className='pb-4'>
      <div className='flex items-start gap-3'>
        <div className='rounded-2xl border border-[#e7ebf3] bg-[#f7f9fc] p-2 text-[#3652f5]'>
          {icon}
        </div>
        <div className='space-y-1'>
          <CardTitle className='text-base font-semibold text-slate-900'>
            {title}
          </CardTitle>
          {description ? (
            <DialogDescription className='text-sm text-slate-500'>
              {description}
            </DialogDescription>
          ) : null}
        </div>
      </div>
    </CardHeader>
    <CardContent className='space-y-4'>{children}</CardContent>
  </Card>
);

const Field = ({ label, hint, children }) => (
  <label className='block space-y-1.5'>
    <span className='text-sm font-medium text-slate-900'>{label}</span>
    {children}
    {hint ? <span className='block text-xs text-slate-500'>{hint}</span> : null}
  </label>
);

export default function EditTokenModal({
  open = false,
  visiable = false,
  editingToken = { id: undefined },
  handleClose = () => {},
  refresh,
}) {
  const { t } = useTranslation();
  const visible = open || visiable;
  const isEdit = editingToken?.id !== undefined;
  const [form, setForm] = useState(getTokenFormInitialValues());
  const [models, setModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedModels = useMemo(
    () => Array.from(new Set(form.model_limits || [])),
    [form.model_limits],
  );

  useEffect(() => {
    if (!visible) {
      setForm(getTokenFormInitialValues());
      return;
    }

    let mounted = true;

    const loadModalData = async () => {
      setLoading(true);

      try {
        const [modelsRes, groupsRes, selfRes, tokenRes] = await Promise.all([
          API.get('/api/user/models'),
          API.get('/api/user/self/groups'),
          API.get('/api/user/self'),
          isEdit
            ? API.get(`/api/token/${editingToken.id}`)
            : Promise.resolve(null),
        ]);

        if (!mounted) {
          return;
        }

        const modelList = modelsRes?.data?.success
          ? modelsRes.data.data || []
          : [];
        setModels(Array.isArray(modelList) ? modelList : []);

        const selfGroup = selfRes?.data?.success
          ? selfRes.data.data?.group
          : '';
        const groupOptions = groupsRes?.data?.success
          ? formatGroupOptions(groupsRes.data.data, selfGroup)
          : [];
        setGroups(groupOptions);

        if (isEdit && tokenRes?.data?.success) {
          const token = tokenRes.data.data || {};
          setForm({
            ...getTokenFormInitialValues(),
            name: token.name || '',
            remain_quota: `${token.remain_quota ?? 0}`,
            expired_time: toDateTimeLocalValue(token.expired_time),
            unlimited_quota: Boolean(token.unlimited_quota),
            model_limits: `${token.model_limits || ''}`
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
            allow_ips: token.allow_ips || '',
            group: token.group || resolveDefaultGroupValue(groupOptions),
            cross_group_retry: Boolean(token.cross_group_retry),
          });
        } else {
          setForm((prev) => ({
            ...getTokenFormInitialValues(),
            group: resolveDefaultGroupValue(groupOptions),
            name: prev.name || '',
          }));
        }
      } catch (error) {
        showError(error?.message || t('加载令牌信息失败'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadModalData();

    return () => {
      mounted = false;
    };
  }, [visible, isEdit, editingToken?.id, t]);

  const toggleModel = (modelName) => {
    setForm((prev) => {
      const next = new Set(prev.model_limits || []);

      if (next.has(modelName)) {
        next.delete(modelName);
      } else {
        next.add(modelName);
      }

      return {
        ...prev,
        model_limits: Array.from(next),
      };
    });
  };

  const submit = async () => {
    setSubmitting(true);

    try {
      if (isEdit) {
        const payload = normalizeTokenFormPayload(form);

        if (!payload) {
          showError(t('过期时间格式错误！'));
          return;
        }

        const response = await API.put('/api/token/', {
          ...payload,
          id: Number.parseInt(editingToken.id, 10),
        });

        if (!response?.data?.success) {
          showError(t(response?.data?.message || '令牌更新失败！'));
          return;
        }

        showSuccess(t('令牌更新成功！'));
      } else {
        const payloads = buildTokenCreatePayloads(form, generateRandomSuffix);

        if (!payloads) {
          showError(t('过期时间格式错误！'));
          return;
        }

        for (const payload of payloads) {
          const response = await API.post('/api/token/', payload);

          if (!response?.data?.success) {
            showError(t(response?.data?.message || '令牌创建失败！'));
            return;
          }
        }

        showSuccess(t('令牌创建成功，请在列表页面点击复制获取令牌！'));
      }

      refresh?.();
      handleClose?.();
    } catch (error) {
      showError(error?.message || t('操作失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={visible}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose?.();
        }
      }}
    >
      <DialogContent className='max-h-[88vh] w-[min(96vw,72rem)] overflow-y-auto rounded-[24px] border-[#e7ebf3] bg-[#f7f9fc] p-0 shadow-[0_30px_90px_rgba(15,23,42,0.16)] md:rounded-[32px]'>
        <DialogHeader className='border-b border-[#e7ebf3] px-5 py-5 md:px-8 md:py-6'>
          <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
            <div className='space-y-2'>
              <div className='flex items-center gap-3'>
                <Badge variant={isEdit ? 'secondary' : 'default'}>
                  {isEdit ? t('更新') : t('新建')}
                </Badge>
                <DialogTitle className='text-2xl font-semibold text-slate-950'>
                  {isEdit ? t('更新令牌信息') : t('创建新的令牌')}
                </DialogTitle>
              </div>
              <DialogDescription className='max-w-2xl text-sm leading-6 text-slate-500'>
                {t('设置名称、分组、额度、过期时间与访问限制。')}
              </DialogDescription>
            </div>
            <div className='rounded-2xl border border-[#e7ebf3] bg-white px-4 py-3 text-right shadow-sm'>
              <div className='text-xs uppercase tracking-[0.18em] text-slate-400'>
                {t('令牌')}
              </div>
              <div className='mt-1 text-sm font-medium text-slate-800'>
                {isEdit ? t('编辑模式') : t('创建模式')}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className='grid grid-cols-1 gap-5 px-5 py-5 md:px-8 md:py-6 sm:[grid-template-columns:repeat(auto-fit,minmax(420px,1fr))]'>
          <div className='space-y-5'>
            <SectionCard
              icon={<KeyRound className='h-4 w-4' />}
              title={t('基本信息')}
              description={t('设置令牌名称、分组和过期策略')}
            >
              <div className='grid gap-4 lg:grid-cols-2'>
                <Input
                  label={t('名称')}
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder={t('请输入名称')}
                />

                <Field label={t('令牌分组')}>
                  <select
                    value={form.group}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        group: event.target.value,
                      }))
                    }
                    className='flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm'
                    disabled={!groups.length}
                  >
                    <option value=''>
                      {groups.length
                        ? t('令牌分组，默认为用户的分组')
                        : t('管理员未设置用户可选分组')}
                    </option>
                    {groups.map((group) => (
                      <option key={group.value} value={group.value}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {form.group === 'auto' ? (
                <label className='flex items-start gap-3 rounded-2xl border border-[#e7ebf3] bg-[#fbfcff] px-4 py-3'>
                  <Switch
                    checked={form.cross_group_retry}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({
                        ...prev,
                        cross_group_retry: Boolean(checked),
                      }))
                    }
                  />
                  <span className='space-y-1'>
                    <span className='block text-sm font-medium text-slate-900'>
                      {t('跨分组重试')}
                    </span>
                    <span className='block text-xs text-slate-500'>
                      {t(
                        '开启后，当前分组渠道失败时会按顺序尝试下一个分组的渠道',
                      )}
                    </span>
                  </span>
                </label>
              ) : null}

              <div className='grid gap-4 2xl:grid-cols-[1fr_auto]'>
                <Input
                  type='datetime-local'
                  label={t('过期时间')}
                  value={form.expired_time}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      expired_time: event.target.value,
                    }))
                  }
                />

                <Field label={t('过期时间快捷设置')}>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => setExpiryOffset(setForm, 0)}
                    >
                      {t('永不过期')}
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() =>
                        setExpiryOffset(setForm, 30 * 24 * 60 * 60)
                      }
                    >
                      {t('一个月')}
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => setExpiryOffset(setForm, 24 * 60 * 60)}
                    >
                      {t('一天')}
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => setExpiryOffset(setForm, 60 * 60)}
                    >
                      {t('一小时')}
                    </Button>
                  </div>
                </Field>
              </div>

              {!isEdit ? (
                <Input
                  type='number'
                  min='1'
                  label={t('新建数量')}
                  value={form.tokenCount}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      tokenCount: event.target.value,
                    }))
                  }
                  placeholder='1'
                />
              ) : null}
            </SectionCard>

            <SectionCard
              icon={<Shield className='h-4 w-4' />}
              title={t('访问限制')}
              description={t('控制模型能力范围与来源 IP')}
            >
              <Field
                label={t('模型限制列表')}
                hint={t('非必要，不建议启用模型限制')}
              >
                <Input
                  value={selectedModels.join(',')}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      model_limits: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder={t('请选择该令牌支持的模型，留空支持所有模型')}
                />
              </Field>

              {models.length ? (
                <div className='flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-[#e7ebf3] bg-[#fbfcff] p-3'>
                  {models.map((modelName) => {
                    const active = selectedModels.includes(modelName);

                    return (
                      <button
                        key={modelName}
                        type='button'
                        onClick={() => toggleModel(modelName)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          active
                            ? 'border-[#3652f5] bg-[#3652f5] text-white'
                            : 'border-[#dbe2ef] bg-white text-slate-600 hover:border-[#3652f5]/40'
                        }`}
                      >
                        {modelName}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <Field
                label={t('IP白名单（支持CIDR表达式）')}
                hint={t(
                  '请勿过度信任此功能，IP可能被伪造，请配合nginx和cdn等网关使用',
                )}
              >
                <textarea
                  value={form.allow_ips}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      allow_ips: event.target.value,
                    }))
                  }
                  placeholder={t('允许的IP，一行一个，不填写则不限制')}
                  rows={4}
                  className='min-h-[110px] w-full rounded-2xl border border-input bg-background px-3 py-3 text-sm outline-none transition-colors focus:border-primary'
                />
              </Field>
            </SectionCard>
          </div>

          <div className='space-y-5'>
            <SectionCard
              icon={<Wallet className='h-4 w-4' />}
              title={t('额度设置')}
              description={t('配置可用额度和无限额度策略')}
            >
              <Input
                type='number'
                label={t('额度')}
                value={form.remain_quota}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    remain_quota: event.target.value,
                  }))
                }
                disabled={form.unlimited_quota}
                placeholder='0'
              />
              <div className='rounded-2xl border border-[#e7ebf3] bg-[#fbfcff] px-4 py-3 text-sm text-slate-600'>
                {renderQuotaWithPrompt(form.remain_quota || 0)}
              </div>
              <label className='flex items-start gap-3 rounded-2xl border border-[#e7ebf3] bg-[#fbfcff] px-4 py-3'>
                <Switch
                  checked={form.unlimited_quota}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      unlimited_quota: Boolean(checked),
                    }))
                  }
                />
                <span className='space-y-1'>
                  <span className='block text-sm font-medium text-slate-900'>
                    {t('无限额度')}
                  </span>
                  <span className='block text-xs text-slate-500'>
                    {t(
                      '令牌的额度仅用于限制令牌本身的最大额度使用量，实际的使用受到账户的剩余额度限制',
                    )}
                  </span>
                </span>
              </label>
            </SectionCard>

            <Card className='rounded-[24px] border-[#e7ebf3] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]'>
              <CardContent className='space-y-4 p-6'>
                <div className='flex items-center gap-3'>
                  <div className='rounded-2xl border border-[#e7ebf3] bg-[#f7f9fc] p-2 text-[#3652f5]'>
                    <Clock3 className='h-4 w-4' />
                  </div>
                  <div>
                    <div className='text-sm font-medium text-slate-900'>
                      {t('提交前检查')}
                    </div>
                    <div className='text-xs text-slate-500'>
                      {t('确认配置后提交，提交成功会自动刷新列表')}
                    </div>
                  </div>
                </div>

                <div className='space-y-2 rounded-2xl border border-[#e7ebf3] bg-[#fbfcff] p-4 text-sm text-slate-600'>
                  <div className='flex items-center justify-between gap-3'>
                    <span>{t('模式')}</span>
                    <span className='font-medium text-slate-900'>
                      {isEdit ? t('编辑') : t('创建')}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-3'>
                    <span>{t('分组')}</span>
                    <span className='font-medium text-slate-900'>
                      {form.group || t('默认分组')}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-3'>
                    <span>{t('模型限制')}</span>
                    <span className='font-medium text-slate-900'>
                      {selectedModels.length || t('无限制')}
                    </span>
                  </div>
                  {!isEdit ? (
                    <div className='flex items-center justify-between gap-3'>
                      <span>{t('新建数量')}</span>
                      <span className='font-medium text-slate-900'>
                        {form.tokenCount || '1'}
                      </span>
                    </div>
                  ) : null}
                </div>

                <label className='flex items-start gap-3 rounded-2xl border border-[#e7ebf3] bg-[#fbfcff] px-4 py-3'>
                  <Checkbox checked={visible} disabled />
                  <span className='text-xs leading-6 text-slate-500'>
                    {t(
                      '当前弹层已切换到 Aurora 原生实现，避免使用会触发 StrictMode 警告的旧版组件链。',
                    )}
                  </span>
                </label>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className='border-t border-[#e7ebf3] bg-white px-5 py-5 md:px-8'>
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
            disabled={loading}
            className='min-w-[140px]'
          >
            {isEdit ? (
              <>
                <Save className='mr-2 h-4 w-4' />
                {t('提交')}
              </>
            ) : (
              <>
                <Plus className='mr-2 h-4 w-4' />
                {t('提交')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
