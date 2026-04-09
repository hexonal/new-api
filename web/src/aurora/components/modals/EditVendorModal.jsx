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
import { API, showError, showSuccess } from '../../../helpers';

const emptyVendor = {
  name: '',
  description: '',
  icon: '',
  endpoint: '',
};

export default function EditVendorModal({
  open = false,
  onClose = () => {},
  editingVendor,
  onSuccess,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyVendor);
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(editingVendor?.id);

  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      setForm(emptyVendor);
      return;
    }

    API.get(`/api/vendors/${editingVendor.id}`)
      .then((res) => {
        if (res.data?.success) {
          setForm({ ...emptyVendor, ...(res.data.data || {}) });
        }
      })
      .catch(() => {});
  }, [open, isEdit, editingVendor?.id]);

  const submit = async () => {
    setLoading(true);
    try {
      const payload = { ...form };
      let res;
      if (isEdit) {
        payload.id = editingVendor.id;
        res = await API.put('/api/vendors/', payload);
      } else {
        res = await API.post('/api/vendors/', payload);
      }

      if (res.data?.success) {
        showSuccess(t('供应商保存成功'));
        onSuccess?.();
        onClose();
      } else {
        showError(res.data?.message || t('供应商保存失败'));
      }
    } catch (error) {
      showError(error?.message || t('供应商保存失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('编辑供应商') : t('创建供应商')}
          </DialogTitle>
          <DialogDescription>{t('维护模型供应商信息')}</DialogDescription>
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
            label={t('描述')}
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
          />
          <Input
            label={t('图标 URL')}
            value={form.icon}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, icon: e.target.value }))
            }
          />
          <Input
            label={t('Endpoint')}
            value={form.endpoint}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, endpoint: e.target.value }))
            }
          />
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={loading}>
            {t('取消')}
          </Button>
          <Button onClick={submit} loading={loading}>
            {t('保存')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
