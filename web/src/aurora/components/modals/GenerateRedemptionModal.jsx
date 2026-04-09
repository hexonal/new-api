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

import React, { useState } from 'react';
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
import { API, showError, showSuccess } from '../../../helpers';

const initialForm = {
  name: '',
  quota: '',
  count: 1,
  expired_time: '',
};

const toUnix = (timeText) => {
  if (!timeText) return -1;
  const parsed = Date.parse(timeText);
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
};

export default function GenerateRedemptionModal({
  open = false,
  onClose = () => {},
  onSuccess,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const expired_time = toUnix(form.expired_time);
    if (expired_time === null) {
      showError(t('过期时间格式错误'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/redemption/', {
        name: form.name,
        quota: Number(form.quota || 0),
        count: Math.max(1, Number(form.count) || 1),
        expired_time,
      });

      if (res.data?.success) {
        showSuccess(t('兑换码生成成功'));
        onSuccess?.();
        onClose();
        setForm(initialForm);
      } else {
        showError(res.data?.message || t('生成失败'));
      }
    } catch (error) {
      showError(error?.message || t('生成失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('生成兑换码')}</DialogTitle>
          <DialogDescription>{t('支持批量生成')}</DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <Input
            label={t('名称')}
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <Input
            type='number'
            label={t('额度')}
            value={form.quota}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, quota: e.target.value }))
            }
          />
          <Input
            type='number'
            label={t('数量')}
            value={form.count}
            min='1'
            onChange={(e) =>
              setForm((prev) => ({ ...prev, count: e.target.value }))
            }
          />
          <Input
            type='datetime-local'
            label={t('过期时间')}
            value={form.expired_time}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, expired_time: e.target.value }))
            }
          />
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={loading}>
            {t('取消')}
          </Button>
          <Button onClick={submit} loading={loading}>
            {t('生成')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
