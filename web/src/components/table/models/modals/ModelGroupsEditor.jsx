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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Tag,
  Select,
  Typography,
  Spin,
  Banner,
} from '@douyinfe/semi-ui';
import { API, showSuccess, showError } from '../../../../helpers';
import { useTranslation } from 'react-i18next';

const normalizeGroupList = (groupData) => {
  if (!Array.isArray(groupData)) {
    return [];
  }
  const values = groupData
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      if (!item || typeof item !== 'object') {
        return '';
      }
      return item.name || item.group || item.value || item.key || '';
    })
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return Array.from(new Set(values));
};

const parseChannelGroups = (groupStr) =>
  String(groupStr || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);

const sortedJoin = (groups) => [...(groups || [])].sort().join(',');

export default function ModelGroupsEditor({ visible, onClose, model }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allGroups, setAllGroups] = useState([]);
  const [channelGroups, setChannelGroups] = useState({});
  const [originalChannelGroups, setOriginalChannelGroups] = useState({});

  const loadCancelRef = useRef(false);
  useEffect(() => {
    loadCancelRef.current = false;
    if (visible && model) {
      loadData();
    }
    return () => { loadCancelRef.current = true; };
  }, [visible, model]);

  const boundChannels = useMemo(
    () => (Array.isArray(model?.bound_channels) ? model.bound_channels : []),
    [model],
  );

  async function loadData() {
    setLoading(true);
    try {
      const groupRes = await API.get('/api/group/');
      if (loadCancelRef.current) return; // stale request guard
      if (groupRes.data?.success) {
        setAllGroups(normalizeGroupList(groupRes.data?.data || []));
      } else {
        setAllGroups([]);
      }

      const initial = {};
      for (const ch of boundChannels) {
        if (ch?.id) {
          initial[ch.id] = parseChannelGroups(ch.group);
        }
      }
      setChannelGroups(initial);
      setOriginalChannelGroups(initial);
    } catch (e) {
      if (!loadCancelRef.current) showError(t('加载失败'));
    } finally {
      if (!loadCancelRef.current) setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      let updated = 0;
      for (const ch of boundChannels) {
        const channelId = ch?.id;
        if (!channelId) continue;

        const currentGroups = channelGroups[channelId] || [];
        const originalGroups = originalChannelGroups[channelId] || [];
        if (sortedJoin(currentGroups) === sortedJoin(originalGroups)) {
          continue;
        }
        if (currentGroups.length === 0) {
          showError(t('渠道 ') + (ch.name || channelId) + t(' 至少需要一个分组'));
          setSaving(false);
          return;
        }

        const res = await API.put('/api/channel/', {
          id: Number(channelId),
          group: currentGroups.join(','),
        });
        if (!res.data?.success) {
          throw new Error(res.data?.message || 'update-channel-group-failed');
        }
        updated++;
      }

      if (updated > 0) {
        showSuccess(t('已更新 ') + updated + t(' 个渠道的分组配置'));
      } else {
        showSuccess(t('没有变更'));
      }
      onClose(true);
    } catch (e) {
      showError(e?.message || t('保存失败'));
    } finally {
      setSaving(false);
    }
  }

  if (!model) {
    return null;
  }

  const enableGroups = Array.isArray(model.enable_groups) ? model.enable_groups : [];

  return (
    <Modal
      title={t('编辑模型可用分组') + ': ' + (model.model_name || '')}
      visible={visible}
      onOk={handleSave}
      onCancel={() => onClose(false)}
      okText={t('保存')}
      cancelText={t('取消')}
      confirmLoading={saving}
      width={680}
    >
      <Spin spinning={loading}>
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong>{t('当前可用分组')}</Typography.Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {enableGroups.map((g) => (
              <Tag color='blue' key={g}>
                {g}
              </Tag>
            ))}
            {enableGroups.length === 0 && (
              <Typography.Text type='tertiary'>{t('无')}</Typography.Text>
            )}
          </div>
        </div>

        <Banner
          type='info'
          description={t('修改渠道的分组配置会影响该渠道下的所有模型')}
          style={{ marginBottom: 16 }}
        />

        <Typography.Text strong>{t('关联渠道分组配置')}</Typography.Text>
        {boundChannels.map((ch) => (
          <div
            key={ch.id || `${ch.name}-${ch.type}`}
            style={{
              marginTop: 12,
              padding: 12,
              border: '1px solid var(--semi-color-border)',
              borderRadius: 8,
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <Typography.Text>{ch.name || '-'}</Typography.Text>
              <Tag style={{ marginLeft: 8 }} size='small'>
                {t('类型')}: {ch.type}
              </Tag>
            </div>
            <Select
              multiple
              filter
              value={channelGroups[ch.id] || []}
              onChange={(val) => {
                setChannelGroups((prev) => ({
                  ...prev,
                  [ch.id]: Array.isArray(val) ? val : [],
                }));
              }}
              optionList={allGroups.map((g) => ({ label: g, value: g }))}
              placeholder={t('选择该渠道的可用分组')}
              style={{ width: '100%' }}
              maxTagCount={6}
            />
          </div>
        ))}

        {boundChannels.length === 0 && (
          <Typography.Text type='tertiary' style={{ marginTop: 8, display: 'block' }}>
            {t('该模型未绑定任何渠道')}
          </Typography.Text>
        )}
      </Spin>
    </Modal>
  );
}
