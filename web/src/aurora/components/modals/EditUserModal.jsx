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

const emptyForm = {
  username: '',
  display_name: '',
  email: '',
  group: '',
  quota: '',
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    let mounted = true;
    Promise.all([API.get(`/api/user/${user.id}`), API.get('/api/group/')])
      .then(([userRes, groupsRes]) => {
        if (!mounted) return;
        if (userRes.data?.success) {
          const data = userRes.data.data || {};
          setForm({
            username: data.username || '',
            display_name: data.display_name || '',
            email: data.email || '',
            group: data.group || '',
            quota: data.quota ?? '',
          });
        }
        if (groupsRes.data?.success) {
          const data = groupsRes.data.data;
          setGroups(Array.isArray(data) ? data : Object.keys(data || {}));
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [open, user?.id]);

  const submit = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const payload = {
        id: user.id,
        username: form.username,
        display_name: form.display_name,
        email: form.email,
        group: form.group,
      };
      if (String(form.quota).trim() !== '') {
        payload.quota = Number(form.quota);
      }

      const res = await API.put('/api/user/', payload);
      if (res.data?.success) {
        showSuccess(t('用户更新成功'));
        onSuccess?.();
        onClose();
      } else {
        showError(res.data?.message || t('用户更新失败'));
      }
    } catch (error) {
      showError(error?.message || t('用户更新失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('编辑用户')}</DialogTitle>
          <DialogDescription>{t('更新用户基础信息和分组')}</DialogDescription>
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

          <div>
            <div className='mb-1.5 text-sm font-medium'>{t('用户分组')}</div>
            <Select
              value={form.group}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, group: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('选择分组')} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input
            type='number'
            label={t('额度（可选）')}
            value={form.quota}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, quota: e.target.value }))
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
