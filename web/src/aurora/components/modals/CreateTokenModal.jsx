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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import { Input } from '../../primitives/input';
import { Button } from '../../primitives/button';
import { Checkbox } from '../../primitives/checkbox';
import { API, showError, showSuccess } from '../../../helpers';

const defaultForm = {
  name: '',
  expired_time: '',
  remain_quota: '',
  unlimited_quota: false,
  model_limits_enabled: false,
  model_limits: '',
  count: 1,
};

const toUnix = (timeText) => {
  if (!timeText) return -1;
  const parsed = Date.parse(timeText);
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
};

export default function CreateTokenModal({
  open = false,
  onClose = () => {},
  onSuccess,
  defaultValues,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm({ ...defaultForm, ...(defaultValues || {}) });
    API.get('/api/user/models')
      .then((res) => {
        if (res.data?.success) {
          setModels(Array.isArray(res.data.data) ? res.data.data : []);
        }
      })
      .catch(() => {});
  }, [open, defaultValues]);

  const selectedModels = useMemo(
    () =>
      String(form.model_limits || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [form.model_limits],
  );

  const toggleModel = (model) => {
    const set = new Set(selectedModels);
    if (set.has(model)) {
      set.delete(model);
    } else {
      set.add(model);
    }
    setForm((prev) => ({ ...prev, model_limits: Array.from(set).join(',') }));
  };

  const handleSubmit = async () => {
    const count = Math.max(1, Number(form.count) || 1);
    const remainQuota = form.unlimited_quota
      ? 0
      : Number(form.remain_quota || 0);
    const expiredTime = toUnix(form.expired_time);
    if (expiredTime === null) {
      showError(t('过期时间格式错误'));
      return;
    }

    const payload = {
      name: form.name || undefined,
      expired_time: expiredTime,
      remain_quota: remainQuota,
      unlimited_quota: form.unlimited_quota,
    };

    if (form.model_limits_enabled) {
      payload.model_limits_enabled = true;
      payload.model_limits = form.model_limits;
    }

    setLoading(true);
    try {
      for (let i = 0; i < count; i++) {
        const res = await API.post('/api/token/', payload);
        if (!res.data?.success) {
          showError(res.data?.message || t('创建令牌失败'));
          return;
        }
      }
      showSuccess(t('令牌创建成功'));
      onSuccess?.();
      onClose();
    } catch (error) {
      showError(error?.message || t('创建令牌失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('创建令牌')}</DialogTitle>
          <DialogDescription>
            {t('支持名称、过期时间、额度、模型限制和批量生成。')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <Input
            label={t('名称')}
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder={t('可选')}
          />
          <Input
            type='datetime-local'
            label={t('过期时间')}
            value={form.expired_time}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, expired_time: e.target.value }))
            }
          />
          <Input
            type='number'
            label={t('额度')}
            disabled={form.unlimited_quota}
            value={form.remain_quota}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, remain_quota: e.target.value }))
            }
            placeholder='0'
          />
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox
              checked={form.unlimited_quota}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  unlimited_quota: Boolean(checked),
                }))
              }
            />
            {t('无限额度')}
          </label>
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox
              checked={form.model_limits_enabled}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  model_limits_enabled: Boolean(checked),
                }))
              }
            />
            {t('启用模型限制')}
          </label>
          {form.model_limits_enabled ? (
            <div className='space-y-2 rounded-lg border border-border p-3'>
              <Input
                label={t('模型限制（逗号分隔）')}
                value={form.model_limits}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, model_limits: e.target.value }))
                }
                placeholder={t('gpt-4o,gpt-4.1-mini')}
              />
              {models.length > 0 ? (
                <div className='flex max-h-32 flex-wrap gap-2 overflow-y-auto'>
                  {models.map((model) => (
                    <button
                      key={model}
                      type='button'
                      className={`rounded border px-2 py-1 text-xs ${
                        selectedModels.includes(model)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border'
                      }`}
                      onClick={() => toggleModel(model)}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <Input
            type='number'
            label={t('批量数量')}
            value={form.count}
            min='1'
            onChange={(e) =>
              setForm((prev) => ({ ...prev, count: e.target.value }))
            }
          />
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={loading}>
            {t('取消')}
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {t('创建')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
