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
import { CheckCircle2, CreditCard, Layers, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../primitives/dialog';
import { Input } from '../../../primitives/input';
import { Button } from '../../../primitives/button';
import { API, showError, showSuccess } from '../../../../helpers';
import {
  displayAmountToQuota,
  quotaToDisplayAmount,
} from '../../../../helpers/quota';

const DURATION_UNITS = [
  { value: 'year', label: '年' },
  { value: 'month', label: '月' },
  { value: 'day', label: '日' },
  { value: 'hour', label: '小时' },
  { value: 'custom', label: '自定义(秒)' },
];

const RESET_PERIODS = [
  { value: 'never', label: '不重置' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'custom', label: '自定义(秒)' },
];

function parseFinite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildDefaultForm() {
  return {
    title: '',
    subtitle: '',
    price_amount: '0',
    total_amount: '0',
    duration_unit: 'month',
    duration_value: '1',
    custom_seconds: '0',
    quota_reset_period: 'never',
    quota_reset_custom_seconds: '0',
    sort_order: '0',
    max_purchase_per_user: '0',
    enabled: true,
    upgrade_group: '',
    stripe_price_id: '',
    creem_product_id: '',
  };
}

function buildFormFromPlan(plan) {
  const next = buildDefaultForm();
  if (!plan?.id) {
    return next;
  }
  return {
    ...next,
    title: String(plan.title || ''),
    subtitle: String(plan.subtitle || ''),
    price_amount: String(parseFinite(plan.price_amount, 0)),
    total_amount: String(
      parseFinite(quotaToDisplayAmount(plan.total_amount || 0), 0),
    ),
    duration_unit: plan.duration_unit || 'month',
    duration_value: String(parseFinite(plan.duration_value, 1)),
    custom_seconds: String(parseFinite(plan.custom_seconds, 0)),
    quota_reset_period: plan.quota_reset_period || 'never',
    quota_reset_custom_seconds: String(
      parseFinite(plan.quota_reset_custom_seconds, 0),
    ),
    sort_order: String(parseFinite(plan.sort_order, 0)),
    max_purchase_per_user: String(parseFinite(plan.max_purchase_per_user, 0)),
    enabled: plan.enabled !== false,
    upgrade_group: String(plan.upgrade_group || ''),
    stripe_price_id: String(plan.stripe_price_id || ''),
    creem_product_id: String(plan.creem_product_id || ''),
  };
}

function Section({ icon, title, description, children }) {
  return (
    <section className='rounded-xl border border-gray-200 bg-white p-4 shadow-sm'>
      <div className='mb-4 flex items-start gap-3'>
        <span className='inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#4a4bd7]/10 text-[#4a4bd7]'>
          {icon}
        </span>
        <div>
          <h3 className='text-sm font-bold text-[#05345c]'>{title}</h3>
          <p className='mt-0.5 text-xs text-[#3d618c]'>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function SubscriptionPlanFormDialog({
  visible,
  handleClose,
  editingPlan,
  refresh,
  t,
}) {
  const plan = editingPlan?.plan || null;
  const isEdit = !!plan?.id;
  const [loading, setLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupOptions, setGroupOptions] = useState([]);
  const [form, setForm] = useState(buildDefaultForm);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setForm(buildFormFromPlan(plan));
  }, [visible, plan]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setGroupLoading(true);
    API.get('/api/group')
      .then((res) => {
        if (!res.data?.success) {
          setGroupOptions([]);
          return;
        }
        const groups = res.data.data;
        if (Array.isArray(groups)) {
          setGroupOptions(groups);
          return;
        }
        if (groups && typeof groups === 'object') {
          setGroupOptions(Object.keys(groups));
          return;
        }
        setGroupOptions([]);
      })
      .catch(() => {
        setGroupOptions([]);
      })
      .finally(() => {
        setGroupLoading(false);
      });
  }, [visible]);

  const payload = useMemo(() => {
    const durationIsCustom = form.duration_unit === 'custom';
    const resetIsCustom = form.quota_reset_period === 'custom';
    return {
      plan: {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        price_amount: parseFinite(form.price_amount, 0),
        currency: 'USD',
        duration_unit: form.duration_unit,
        duration_value: durationIsCustom
          ? 0
          : Math.max(1, Math.floor(parseFinite(form.duration_value, 1))),
        custom_seconds: durationIsCustom
          ? Math.max(1, Math.floor(parseFinite(form.custom_seconds, 1)))
          : 0,
        quota_reset_period: form.quota_reset_period,
        quota_reset_custom_seconds: resetIsCustom
          ? Math.max(
              60,
              Math.floor(parseFinite(form.quota_reset_custom_seconds, 60)),
            )
          : 0,
        enabled: !!form.enabled,
        sort_order: Math.max(0, Math.floor(parseFinite(form.sort_order, 0))),
        max_purchase_per_user: Math.max(
          0,
          Math.floor(parseFinite(form.max_purchase_per_user, 0)),
        ),
        total_amount: displayAmountToQuota(parseFinite(form.total_amount, 0)),
        upgrade_group: form.upgrade_group || '',
        stripe_price_id: form.stripe_price_id.trim(),
        creem_product_id: form.creem_product_id.trim(),
      },
    };
  }, [form]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!payload.plan.title) {
      showError(t('套餐标题不能为空'));
      return false;
    }
    if (payload.plan.price_amount < 0) {
      showError(t('金额不能小于 0'));
      return false;
    }
    if (payload.plan.duration_unit === 'custom' && payload.plan.custom_seconds < 1) {
      showError(t('自定义有效期秒数必须大于 0'));
      return false;
    }
    if (
      payload.plan.duration_unit !== 'custom' &&
      payload.plan.duration_value < 1
    ) {
      showError(t('有效期数值必须大于 0'));
      return false;
    }
    if (
      payload.plan.quota_reset_period === 'custom' &&
      payload.plan.quota_reset_custom_seconds < 60
    ) {
      showError(t('自定义重置秒数不能小于 60'));
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validate()) {
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        const res = await API.put(
          `/api/subscription/admin/plans/${plan.id}`,
          payload,
        );
        if (res.data?.success) {
          showSuccess(t('更新成功'));
          handleClose();
          refresh?.();
        } else {
          showError(res.data?.message || t('更新失败'));
        }
      } else {
        const res = await API.post('/api/subscription/admin/plans', payload);
        if (res.data?.success) {
          showSuccess(t('创建成功'));
          handleClose();
          refresh?.();
        } else {
          showError(res.data?.message || t('创建失败'));
        }
      }
    } catch (error) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={visible}
      onOpenChange={(next) => {
        if (!next) {
          handleClose();
        }
      }}
    >
      <DialogContent className='max-h-[92vh] w-[96vw] max-w-[980px] overflow-hidden rounded-2xl border border-[#d9e0ea] bg-[#f7f9fc] p-0 shadow-[0_30px_90px_rgba(15,23,42,0.16)]'>
        <DialogHeader className='border-b border-[#dbe5f2] bg-white px-6 py-5'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <DialogTitle className='font-headline text-2xl font-black tracking-tight text-[#05345c]'>
                {isEdit ? t('更新套餐信息') : t('创建新的订阅套餐')}
              </DialogTitle>
              <p className='mt-1 text-sm text-[#3d618c]'>
                {isEdit
                  ? t('更新套餐档位、权益和支付映射配置')
                  : t('新增可售订阅档位并立即在用户端展示')}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isEdit
                  ? 'bg-[#e5eeff] text-[#4a4bd7]'
                  : 'bg-[#ecfdf3] text-[#0f9f63]'
              }`}
            >
              {isEdit ? t('编辑模式') : t('创建模式')}
            </span>
          </div>
        </DialogHeader>

        <div className='max-h-[70vh] space-y-4 overflow-y-auto p-6'>
          <Section
            icon={<Sparkles size={16} />}
            title={t('基础信息')}
            description={t('配置套餐名称、金额和总额度')}
          >
            <div className='grid gap-3 md:grid-cols-2'>
              <Input
                label={t('套餐标题')}
                value={form.title}
                onChange={(event) => setField('title', event.target.value)}
                placeholder={t('例如：Pro')}
              />
              <Input
                label={t('套餐副标题')}
                value={form.subtitle}
                onChange={(event) => setField('subtitle', event.target.value)}
                placeholder={t('例如：适合生产环境')}
              />
              <Input
                label={t('实付金额（USD）')}
                type='number'
                min='0'
                step='0.01'
                value={form.price_amount}
                onChange={(event) => setField('price_amount', event.target.value)}
              />
              <Input
                label={t('总额度')}
                type='number'
                min='0'
                step='0.01'
                value={form.total_amount}
                onChange={(event) => setField('total_amount', event.target.value)}
              />
            </div>
            <p className='mt-2 text-xs text-[#5a7da9]'>
              {t('0 表示不限')} · {t('原生额度')}：{payload.plan.total_amount}
            </p>
          </Section>

          <Section
            icon={<Layers size={16} />}
            title={t('有效期与规则')}
            description={t('配置有效期、重置周期、购买限制与排序')}
          >
            <div className='grid gap-3 md:grid-cols-2'>
              <label className='w-full'>
                <span className='mb-1.5 block text-sm font-medium text-[#05345c]'>
                  {t('有效期单位')}
                </span>
                <select
                  className='h-10 w-full rounded-lg border border-[#c9d8ea] bg-white px-3 text-sm text-[#05345c] outline-none focus:border-[#4a4bd7] focus:ring-2 focus:ring-[#4a4bd7]/15'
                  value={form.duration_unit}
                  onChange={(event) => setField('duration_unit', event.target.value)}
                >
                  {DURATION_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.duration_unit === 'custom' ? (
                <Input
                  label={t('自定义有效期秒数')}
                  type='number'
                  min='1'
                  step='1'
                  value={form.custom_seconds}
                  onChange={(event) =>
                    setField('custom_seconds', event.target.value)
                  }
                />
              ) : (
                <Input
                  label={t('有效期数值')}
                  type='number'
                  min='1'
                  step='1'
                  value={form.duration_value}
                  onChange={(event) =>
                    setField('duration_value', event.target.value)
                  }
                />
              )}

              <label className='w-full'>
                <span className='mb-1.5 block text-sm font-medium text-[#05345c]'>
                  {t('额度重置周期')}
                </span>
                <select
                  className='h-10 w-full rounded-lg border border-[#c9d8ea] bg-white px-3 text-sm text-[#05345c] outline-none focus:border-[#4a4bd7] focus:ring-2 focus:ring-[#4a4bd7]/15'
                  value={form.quota_reset_period}
                  onChange={(event) =>
                    setField('quota_reset_period', event.target.value)
                  }
                >
                  {RESET_PERIODS.map((period) => (
                    <option key={period.value} value={period.value}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label={t('自定义重置秒数')}
                type='number'
                min='0'
                step='1'
                value={form.quota_reset_custom_seconds}
                onChange={(event) =>
                  setField('quota_reset_custom_seconds', event.target.value)
                }
                disabled={form.quota_reset_period !== 'custom'}
              />
              <Input
                label={t('购买上限')}
                type='number'
                min='0'
                step='1'
                value={form.max_purchase_per_user}
                onChange={(event) =>
                  setField('max_purchase_per_user', event.target.value)
                }
              />
              <Input
                label={t('排序')}
                type='number'
                min='0'
                step='1'
                value={form.sort_order}
                onChange={(event) => setField('sort_order', event.target.value)}
              />
            </div>

            <div className='mt-3 flex items-center justify-between rounded-lg border border-[#d9e3f4] bg-[#f5f8ff] px-3 py-2'>
              <div>
                <p className='text-sm font-semibold text-[#05345c]'>
                  {t('套餐启用状态')}
                </p>
                <p className='text-xs text-[#5a7da9]'>
                  {t('启用后将展示在用户端订阅列表')}
                </p>
              </div>
              <button
                type='button'
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  form.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
                onClick={() => setField('enabled', !form.enabled)}
                aria-label={form.enabled ? 'disable-plan' : 'enable-plan'}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    form.enabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </Section>

          <Section
            icon={<CreditCard size={16} />}
            title={t('分组与支付映射')}
            description={t('可选配置分组升级和第三方支付商品 ID')}
          >
            <div className='grid gap-3 md:grid-cols-2'>
              <label className='w-full'>
                <span className='mb-1.5 block text-sm font-medium text-[#05345c]'>
                  {t('升级分组')}
                </span>
                <select
                  className='h-10 w-full rounded-lg border border-[#c9d8ea] bg-white px-3 text-sm text-[#05345c] outline-none focus:border-[#4a4bd7] focus:ring-2 focus:ring-[#4a4bd7]/15'
                  value={form.upgrade_group}
                  onChange={(event) => setField('upgrade_group', event.target.value)}
                  disabled={groupLoading}
                >
                  <option value=''>{t('不升级')}</option>
                  {groupOptions.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
              <div className='rounded-lg border border-[#d9e3f4] bg-[#f5f8ff] px-3 py-2'>
                <p className='text-xs text-[#5a7da9]'>
                  {t(
                    '购买后会升级到该分组；订阅失效后自动回退，回退可能有几分钟延迟。',
                  )}
                </p>
              </div>
              <Input
                label={t('Stripe PriceId')}
                value={form.stripe_price_id}
                onChange={(event) =>
                  setField('stripe_price_id', event.target.value)
                }
                placeholder='price_...'
              />
              <Input
                label={t('Creem ProductId')}
                value={form.creem_product_id}
                onChange={(event) =>
                  setField('creem_product_id', event.target.value)
                }
                placeholder='prod_...'
              />
            </div>
          </Section>
        </div>

        <DialogFooter className='border-t border-[#dbe5f2] bg-white px-6 py-4'>
          <div className='flex w-full items-center justify-end gap-2'>
            <Button variant='outline' onClick={handleClose} disabled={loading}>
              {t('取消')}
            </Button>
            <Button onClick={submit} disabled={loading}>
              <CheckCircle2 size={14} />
              {loading ? t('提交中...') : isEdit ? t('保存修改') : t('创建套餐')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
