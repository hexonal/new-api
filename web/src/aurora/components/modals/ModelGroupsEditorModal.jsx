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
import { Checkbox } from '../../primitives/checkbox';
import { Button } from '../../primitives/button';
import { API, showError, showSuccess } from '../../../helpers';

const parseGroups = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function ModelGroupsEditorModal({
  open = false,
  onClose = () => {},
  model,
}) {
  const { t } = useTranslation();
  const [allGroups, setAllGroups] = useState([]);
  const [mapping, setMapping] = useState({});
  const [saving, setSaving] = useState(false);

  const channels = useMemo(() => model?.channels || [], [model]);

  useEffect(() => {
    if (!open || !model) return;

    API.get('/api/group/')
      .then((res) => {
        if (res.data?.success) {
          const data = res.data.data;
          setAllGroups(Array.isArray(data) ? data : Object.keys(data || {}));
        }
      })
      .catch(() => {});

    const initial = {};
    channels.forEach((channel) => {
      initial[channel.id] = parseGroups(channel.group || channel.groups);
    });
    setMapping(initial);
  }, [open, model, channels]);

  const toggleGroup = (channelId, group) => {
    setMapping((prev) => {
      const current = new Set(prev[channelId] || []);
      if (current.has(group)) {
        current.delete(group);
      } else {
        current.add(group);
      }
      return { ...prev, [channelId]: Array.from(current) };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let updated = 0;
      for (const channel of channels) {
        const groups = (mapping[channel.id] || []).sort().join(',');
        const original = parseGroups(channel.group || channel.groups)
          .sort()
          .join(',');
        if (groups === original) {
          continue;
        }

        const res = await API.put('/api/models/channel_group', {
          model: model.model_name || model.name,
          channel_id: channel.id,
          group: groups,
        });
        if (!res.data?.success) {
          throw new Error(res.data?.message || t('更新渠道分组失败'));
        }
        updated += 1;
      }

      showSuccess(t('模型分组已更新') + ` (${updated})`);
      onClose(true);
    } catch (error) {
      showError(error?.message || t('模型分组更新失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? onClose(false) : null)}
    >
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle>{t('模型分组编辑')}</DialogTitle>
          <DialogDescription>
            {t('按渠道调整模型可见分组')}
            {model?.model_name ? ` - ${model.model_name}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className='max-h-[60vh] space-y-3 overflow-y-auto pr-1'>
          {channels.map((channel) => (
            <div
              key={channel.id}
              className='rounded-lg border border-border p-3'
            >
              <div className='mb-2 text-sm font-medium'>
                {channel.name || channel.id}
              </div>
              <div className='flex flex-wrap gap-3'>
                {allGroups.map((group) => (
                  <label
                    key={`${channel.id}-${group}`}
                    className='flex items-center gap-2 text-sm'
                  >
                    <Checkbox
                      checked={(mapping[channel.id] || []).includes(group)}
                      onCheckedChange={() => toggleGroup(channel.id, group)}
                    />
                    {group}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onClose(false)}
            disabled={saving}
          >
            {t('取消')}
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {t('保存')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
