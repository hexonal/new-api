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
import { API, showError, showSuccess } from '../../../helpers';

const initForm = {
  tag: '',
  new_tag: '',
  models: '',
  groups: '',
  model_mapping: '',
  header_override: '',
  param_override: '',
};

export default function EditTagModal({
  open = false,
  onClose = () => {},
  tag = '',
  onSuccess,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initForm);
  const [allModels, setAllModels] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({ ...prev, tag, new_tag: tag }));

    Promise.all([
      API.get('/api/channel/models'),
      API.get('/api/group/'),
      tag
        ? API.get(`/api/channel/tag/models?tag=${encodeURIComponent(tag)}`)
        : null,
    ])
      .then(([modelsRes, groupsRes, tagModelsRes]) => {
        if (modelsRes?.data?.success) {
          setAllModels(
            Array.isArray(modelsRes.data.data) ? modelsRes.data.data : [],
          );
        }
        if (groupsRes?.data?.success) {
          const data = groupsRes.data.data;
          setAllGroups(Array.isArray(data) ? data : Object.keys(data || {}));
        }
        if (tagModelsRes?.data?.success) {
          const models = Array.isArray(tagModelsRes.data.data)
            ? tagModelsRes.data.data
            : [];
          setForm((prev) => ({ ...prev, models: models.join(',') }));
        }
      })
      .catch(() => {});
  }, [open, tag]);

  const modelList = useMemo(
    () =>
      String(form.models)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [form.models],
  );

  const groupList = useMemo(
    () =>
      String(form.groups)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [form.groups],
  );

  const toggleInList = (target, key, values) => {
    const set = new Set(values);
    if (set.has(target)) {
      set.delete(target);
    } else {
      set.add(target);
    }
    setForm((prev) => ({ ...prev, [key]: Array.from(set).join(',') }));
  };

  const submit = async () => {
    if (!form.tag) {
      showError(t('原标签不能为空'));
      return;
    }

    const payload = {
      tag: form.tag,
      new_tag: form.new_tag || form.tag,
      models: modelList,
      groups: groupList,
      model_mapping: form.model_mapping || '',
      header_override: form.header_override || '',
      param_override: form.param_override || '',
    };

    setLoading(true);
    try {
      const res = await API.put('/api/channel/tag', payload);
      if (res.data?.success) {
        showSuccess(t('标签批量编辑成功'));
        onSuccess?.();
        onClose();
      } else {
        showError(res.data?.message || t('标签编辑失败'));
      }
    } catch (error) {
      showError(error?.message || t('标签编辑失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('批量编辑标签')}</DialogTitle>
          <DialogDescription>
            {t('批量更新标签绑定模型、分组和覆盖配置')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <div className='grid grid-cols-2 gap-3'>
            <Input
              label={t('原标签')}
              value={form.tag}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tag: e.target.value }))
              }
            />
            <Input
              label={t('新标签')}
              value={form.new_tag}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, new_tag: e.target.value }))
              }
            />
          </div>

          <Input
            label={t('模型（逗号分隔）')}
            value={form.models}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, models: e.target.value }))
            }
          />
          <div className='flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border p-2'>
            {allModels.map((model) => (
              <button
                key={model}
                type='button'
                className={`rounded border px-2 py-1 text-xs ${
                  modelList.includes(model)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border'
                }`}
                onClick={() => toggleInList(model, 'models', modelList)}
              >
                {model}
              </button>
            ))}
          </div>

          <Input
            label={t('分组（逗号分隔）')}
            value={form.groups}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, groups: e.target.value }))
            }
          />
          <div className='flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border p-2'>
            {allGroups.map((group) => (
              <button
                key={group}
                type='button'
                className={`rounded border px-2 py-1 text-xs ${
                  groupList.includes(group)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border'
                }`}
                onClick={() => toggleInList(group, 'groups', groupList)}
              >
                {group}
              </button>
            ))}
          </div>

          <Input
            label={t('模型映射 JSON')}
            value={form.model_mapping}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, model_mapping: e.target.value }))
            }
          />
          <Input
            label={t('请求头覆盖 JSON')}
            value={form.header_override}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, header_override: e.target.value }))
            }
          />
          <Input
            label={t('参数覆盖 JSON')}
            value={form.param_override}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, param_override: e.target.value }))
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
