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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import { Input } from '../../primitives/input';
import { Button } from '../../primitives/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../primitives/select';
import { API, showError, showSuccess } from '../../../helpers';

const defaultForm = {
  plan_name: '',
  amount: '',
  quota: '',
  duration: 30,
  duration_unit: 'day',
  user_group: '',
};

export default function CreateSubscriptionPlanModal({
  open = false,
  onClose = () => {},
  onSuccess,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(defaultForm);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    API.get('/api/group')
      .then((res) => {
        if (res.data?.success) {
          const data = res.data.data || {};
          setGroups(Array.isArray(data) ? data : Object.keys(data));
        }
      })
      .catch(() => {});
  }, [open]);

  const submit = async () => {
    setLoading(true);
    try {
      const payload = {
        plan_name: form.plan_name,
        amount: Number(form.amount || 0),
        quota: Number(form.quota || 0),
        duration: Number(form.duration || 0),
        duration_unit: form.duration_unit,
        user_group: form.user_group || undefined,
      };
      const res = await API.post('/api/subscription/admin/plans', payload);
      if (res.data?.success) {
        showSuccess(t('套餐创建成功'));
        onSuccess?.();
        onClose();
        setForm(defaultForm);
      } else {
        showError(res.data?.message || t('套餐创建失败'));
      }
    } catch (error) {
      showError(error?.message || t('套餐创建失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('创建订阅套餐')}</DialogTitle>
          <DialogDescription>{t('创建可销售的订阅计划')}</DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <Input
            label={t('套餐名称')}
            value={form.plan_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, plan_name: e.target.value }))
            }
          />
          <Input
            label={t('价格')}
            type='number'
            value={form.amount}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, amount: e.target.value }))
            }
          />
          <Input
            label={t('额度')}
            type='number'
            value={form.quota}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, quota: e.target.value }))
            }
          />
          <div className='grid grid-cols-2 gap-3'>
            <Input
              label={t('周期长度')}
              type='number'
              value={form.duration}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, duration: e.target.value }))
              }
            />
            <div>
              <div className='mb-1.5 text-sm font-medium'>{t('周期单位')}</div>
              <Select
                value={form.duration_unit}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, duration_unit: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='day'>{t('天')}</SelectItem>
                  <SelectItem value='month'>{t('月')}</SelectItem>
                  <SelectItem value='year'>{t('年')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className='mb-1.5 text-sm font-medium'>{t('适用分组')}</div>
            <Select
              value={form.user_group || '__all__'}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  user_group: value === '__all__' ? '' : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('全部分组')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__all__'>{t('全部分组')}</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={loading}>
            {t('取消')}
          </Button>
          <Button onClick={submit} loading={loading}>
            {t('创建')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
