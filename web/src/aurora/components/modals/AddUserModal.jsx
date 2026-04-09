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

const defaultForm = {
  username: '',
  password: '',
  display_name: '',
  email: '',
};

export default function AddUserModal({
  open = false,
  onClose = () => {},
  onSuccess,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.username || !form.password) {
      showError(t('用户名和密码必填'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/user/', form);
      if (res.data?.success) {
        showSuccess(t('用户创建成功'));
        onSuccess?.();
        onClose();
        setForm(defaultForm);
      } else {
        showError(res.data?.message || t('用户创建失败'));
      }
    } catch (error) {
      showError(error?.message || t('用户创建失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('新增用户')}</DialogTitle>
          <DialogDescription>{t('创建本地账号')}</DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <Input
            label={t('用户名')}
            value={form.username}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, username: e.target.value }))
            }
          />
          <Input
            type='password'
            label={t('密码')}
            value={form.password}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, password: e.target.value }))
            }
          />
          <Input
            label={t('显示名')}
            value={form.display_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, display_name: e.target.value }))
            }
          />
          <Input
            label={t('邮箱')}
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={loading}>
            {t('取消')}
          </Button>
          <Button onClick={submit} loading={loading}>
            {t('创建用户')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
