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

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Typography,
  Button,
  Card,
  Tag,
  Modal,
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  Empty,
  Popconfirm,
  Space,
  Spin,
  Table,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';

const stableJSONStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJSONStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableJSONStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const normalizeDecimalString = (value) => String(value).replace(/[，。]/g, '.').trim();

const parseRatioValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const parsed = Number(normalizeDecimalString(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function GroupManagement() {
  const { t } = useTranslation();

  // Data state
  const [groupRatio, setGroupRatio] = useState({}); // {"default":1,"vip":0.8}
  const [groupModelRatio, setGroupModelRatio] = useState({}); // {"vip":{"gpt-4":0.5}}
  const [allModels, setAllModels] = useState([]); // model list from /api/pricing
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // UI state
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupBaseRatio, setNewGroupBaseRatio] = useState(1);

  // Editing state for right panel
  const [editBaseRatio, setEditBaseRatio] = useState(1);
  const [editModelRatios, setEditModelRatios] = useState({}); // {model: ratio}
  const [addModelName, setAddModelName] = useState('');
  const [addModelRatio, setAddModelRatio] = useState(1);
  const [dirty, setDirty] = useState(false);
  const savingGuardRef = useRef(false);

  const groupNames = useMemo(() => {
    const allKeys = new Set([...Object.keys(groupRatio), ...Object.keys(groupModelRatio)]);
    return [...allKeys].sort();
  }, [groupRatio, groupModelRatio]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [optionRes, pricingRes] = await Promise.all([
        API.get('/api/option/'),
        API.get('/api/pricing'),
      ]);

      // Parse options
      if (optionRes.data?.success) {
        const options = optionRes.data.data || [];

        // GroupRatio
        const grRaw = options.find((item) => item.key === 'GroupRatio')?.value || '{}';
        let gr = {};
        try { gr = JSON.parse(grRaw); } catch { gr = {}; }
        setGroupRatio(gr);

        // GroupModelRatio from group_ratio_setting
        const gmrRaw = options.find((item) => item.key === 'GroupModelRatio')?.value || '{}';
        let gmr = {};
        try { gmr = JSON.parse(gmrRaw); } catch { gmr = {}; }
        setGroupModelRatio(gmr);
      }

      // Model list from pricing
      if (pricingRes.data?.success) {
        const pricingData = pricingRes.data.data || [];
        const models = pricingData.map((m) => (typeof m === 'string' ? m : m.id || m.model_name || '')).filter(Boolean);
        setAllModels(models.sort());
      }
    } catch (error) {
      showError(t('加载失败'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  // When selected group changes, load its data into edit panel
  useEffect(() => {
    if (selectedGroup && (groupRatio[selectedGroup] !== undefined || groupModelRatio[selectedGroup] !== undefined)) {
      setEditBaseRatio(groupRatio[selectedGroup] ?? 1.0);
      setEditModelRatios({ ...(groupModelRatio[selectedGroup] || {}) });
      // Reset "add model ratio" draft when switching groups to avoid stale display.
      setAddModelName('');
      setAddModelRatio(1);
      setDirty(false);
    }
  }, [selectedGroup, groupRatio, groupModelRatio]);

  // Model options for dropdown (exclude already added models)
  const availableModelOptions = useMemo(() => {
    const existing = new Set(Object.keys(editModelRatios));
    return allModels
      .filter((m) => !existing.has(m))
      .map((m) => ({ label: m, value: m }));
  }, [allModels, editModelRatios]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedGroup) {
      return false;
    }
    const prevBaseRatio = Number(groupRatio[selectedGroup] ?? 1.0);
    const baseChanged = prevBaseRatio !== Number(editBaseRatio);

    const currentModelRatios = groupModelRatio[selectedGroup] || {};
    const modelChanged =
      stableJSONStringify(currentModelRatios) !== stableJSONStringify(editModelRatios || {});

    return baseChanged || modelChanged;
  }, [selectedGroup, groupRatio, groupModelRatio, editBaseRatio, editModelRatios]);

  // Save all changes
  const handleSave = async () => {
    if (!selectedGroup) return;
    if (savingGuardRef.current) return;
    savingGuardRef.current = true;
    setSaving(true);
    try {
      if (!hasUnsavedChanges) {
        showSuccess(t('未检测到变更'));
        setDirty(false);
        return;
      }

      const saveRes = await API.put('/api/option/group_pricing', {
        group: selectedGroup,
        base_ratio: Number(editBaseRatio),
        model_ratios: editModelRatios,
      });
      if (!saveRes.data?.success) {
        throw new Error(saveRes.data?.message || t('保存失败'));
      }

      const respData = saveRes.data?.data || {};
      if (respData.group_ratio && typeof respData.group_ratio === 'object') {
        setGroupRatio(respData.group_ratio);
      }
      if (respData.group_model_ratio && typeof respData.group_model_ratio === 'object') {
        setGroupModelRatio(respData.group_model_ratio);
      }
      setDirty(false);
      showSuccess(t('保存成功'));
    } catch (error) {
      showError(error?.message || t('保存失败'));
    } finally {
      setSaving(false);
      savingGuardRef.current = false;
    }
  };

  // Create new group
  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      showError(t('请输入分组名称'));
      return;
    }
    if (groupRatio[name] !== undefined) {
      showError(t('分组已存在'));
      return;
    }
    setSaving(true);
    try {
      const newGr = { ...groupRatio, [name]: newGroupBaseRatio };
      const res = await API.put('/api/option/', {
        key: 'GroupRatio',
        value: JSON.stringify(newGr),
      });
      if (!res.data?.success) {
        throw new Error(res.data?.message || t('创建失败'));
      }
      setGroupRatio(newGr);
      setCreateModalVisible(false);
      setNewGroupName('');
      setNewGroupBaseRatio(1);
      setSelectedGroup(name);
      showSuccess(t('创建成功'));
    } catch (error) {
      showError(error?.message || t('创建失败'));
    } finally {
      setSaving(false);
    }
  };

  // Delete group
  const handleDeleteGroup = async (name) => {
    setSaving(true);
    try {
      // Remove from GroupRatio
      const newGr = { ...groupRatio };
      delete newGr[name];
      const grRes = await API.put('/api/option/', {
        key: 'GroupRatio',
        value: JSON.stringify(newGr),
      });
      if (!grRes.data?.success) {
        throw new Error(grRes.data?.message || t('删除失败'));
      }

      // Remove from group_model_ratio
      const newGmr = { ...groupModelRatio };
      delete newGmr[name];
      const gmrRes = await API.put('/api/option/', {
        key: 'GroupModelRatio',
        value: JSON.stringify(newGmr),
      });
      if (!gmrRes.data?.success) {
        throw new Error(gmrRes.data?.message || t('删除模型倍率失败'));
      }

      setGroupRatio(newGr);
      setGroupModelRatio(newGmr);
      if (selectedGroup === name) {
        setSelectedGroup(null);
      }
      showSuccess(t('删除成功'));
    } catch (error) {
      showError(error?.message || t('删除失败'));
    } finally {
      setSaving(false);
    }
  };

  // Add model ratio row
  const handleAddModelRatio = () => {
    if (!addModelName) {
      showError(t('请选择模型'));
      return;
    }
    setEditModelRatios((prev) => ({ ...prev, [addModelName]: addModelRatio }));
    setAddModelName('');
    setAddModelRatio(1);
    setDirty(true);
  };

  // Remove model ratio row
  const handleRemoveModelRatio = (model) => {
    setEditModelRatios((prev) => {
      const next = { ...prev };
      delete next[model];
      return next;
    });
    setDirty(true);
  };

  // Model ratio table columns
  const modelRatioColumns = [
    {
      title: t('模型'),
      dataIndex: 'model',
      width: '50%',
    },
    {
      title: t('倍率'),
      dataIndex: 'ratio',
      width: '30%',
      render: (_, record) => (
        <InputNumber
          value={record.ratio}
          min={0}
          step={0.1}
          parser={normalizeDecimalString}
          style={{ width: 120 }}
          onChange={(val) => {
            const ratio = parseRatioValue(val);
            if (ratio === undefined) {
              return;
            }
            setEditModelRatios((prev) => ({ ...prev, [record.model]: ratio }));
            setDirty(true);
          }}
        />
      ),
    },
    {
      title: t('操作'),
      dataIndex: 'action',
      width: '20%',
      render: (_, record) => (
        <Button
          icon={<IconDelete />}
          type='danger'
          theme='light'
          size='small'
          onClick={() => handleRemoveModelRatio(record.model)}
        />
      ),
    },
  ];

  const modelRatioData = useMemo(
    () =>
      Object.entries(editModelRatios)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([model, ratio]) => ({ key: model, model, ratio })),
    [editModelRatios],
  );

  return (
    <Spin spinning={loading}>
      <div style={{ paddingBottom: 8 }}>
        <div style={{ marginBottom: 24 }}>
          <Typography.Title
            heading={3}
            style={{ marginBottom: 4, fontSize: '1.5rem', fontWeight: 600 }}
          >
            {t('定价分组管理')}
          </Typography.Title>
          <Typography.Text style={{ color: '#727786' }}>
            {t('管理定价分组的通用倍率和模型级别倍率')}
          </Typography.Text>
        </div>

        <Row gutter={24}>
          {/* Left panel: group list */}
          <Col xs={24} md={8}>
            <Card
              style={{ borderRadius: 12, minHeight: 400 }}
              bodyStyle={{ padding: 16 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <Typography.Title heading={5} style={{ margin: 0, fontWeight: 600 }}>
                  {t('分组列表')}
                </Typography.Title>
              </div>

              {groupNames.length === 0 ? (
                <Empty description={t('暂无分组')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groupNames.map((name) => (
                    <Card
                      key={name}
                      style={{
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: selectedGroup === name ? '2px solid var(--semi-color-primary)' : '1px solid var(--semi-color-border)',
                        background: selectedGroup === name ? 'var(--semi-color-primary-light-default)' : undefined,
                      }}
                      bodyStyle={{ padding: '12px 16px' }}
                      onClick={() => setSelectedGroup(name)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Typography.Text strong>{name}</Typography.Text>
                          <br />
                          <Typography.Text type='tertiary' size='small'>
                            {t('通用倍率')}: {groupRatio[name] ?? 1.0}
                          </Typography.Text>
                        </div>
                        <Tag color='blue' size='small'>
                          x{groupRatio[name] ?? 1.0}
                        </Tag>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <Button
                icon={<IconPlus />}
                theme='solid'
                type='primary'
                block
                style={{ marginTop: 16 }}
                onClick={() => setCreateModalVisible(true)}
              >
                {t('新建分组')}
              </Button>
            </Card>
          </Col>

          {/* Right panel: group detail edit */}
          <Col xs={24} md={16}>
            <Card
              style={{ borderRadius: 12, minHeight: 400 }}
              bodyStyle={{ padding: 24 }}
            >
              {!selectedGroup ? (
                <Empty description={t('请从左侧选择一个分组进行编辑')} style={{ marginTop: 80 }} />
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Typography.Title heading={4} style={{ margin: 0, fontWeight: 600 }}>
                      {selectedGroup}
                    </Typography.Title>
                    <Space>
                      {selectedGroup !== 'default' && (
                        <Popconfirm
                          title={t('确定删除该分组？删除后不可恢复。')}
                          onConfirm={() => handleDeleteGroup(selectedGroup)}
                        >
                          <Button type='danger' theme='light'>
                            {t('删除分组')}
                          </Button>
                        </Popconfirm>
                      )}
                    </Space>
                  </div>

                  {/* Base ratio */}
                  <div style={{ marginBottom: 24 }}>
                    <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                      {t('通用倍率')}
                    </Typography.Text>
                    <InputNumber
                      value={editBaseRatio}
                      min={0}
                      step={0.1}
                      parser={normalizeDecimalString}
                      style={{ width: 200 }}
                      onChange={(val) => {
                        const ratio = parseRatioValue(val);
                        if (ratio === undefined) {
                          return;
                        }
                        setEditBaseRatio(ratio);
                        setDirty(true);
                      }}
                    />
                    <Typography.Text type='tertiary' size='small' style={{ display: 'block', marginTop: 4 }}>
                      {t('该分组下所有模型的默认价格倍率')}
                    </Typography.Text>
                  </div>

                  {/* Model-specific ratios */}
                  <div style={{ marginBottom: 16 }}>
                    <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                      {t('模型倍率')}
                    </Typography.Text>
                    <Typography.Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
                      {t('为特定模型设置独立倍率，优先级高于通用倍率')}
                    </Typography.Text>

                    {modelRatioData.length > 0 && (
                      <Table
                        columns={modelRatioColumns}
                        dataSource={modelRatioData}
                        pagination={false}
                        size='small'
                        style={{ marginBottom: 16 }}
                      />
                    )}
                    {modelRatioData.length === 0 && (
                      <Typography.Text
                        type='tertiary'
                        size='small'
                        style={{ display: 'block', marginBottom: 12 }}
                      >
                        {t('当前分组暂无模型倍率配置')}
                      </Typography.Text>
                    )}

                    {/* Add model row */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Select
                        filter
                        placeholder={t('选择模型')}
                        value={addModelName}
                        onChange={setAddModelName}
                        optionList={availableModelOptions}
                        style={{ width: 300 }}
                        showClear
                      />
                      <InputNumber
                        value={addModelRatio}
                        min={0}
                        step={0.1}
                        parser={normalizeDecimalString}
                        style={{ width: 120 }}
                        onChange={(val) => {
                          const ratio = parseRatioValue(val);
                          if (ratio === undefined) {
                            return;
                          }
                          setAddModelRatio(ratio);
                        }}
                        placeholder={t('倍率')}
                      />
                      <Button
                        icon={<IconPlus />}
                        theme='light'
                        type='primary'
                        onClick={handleAddModelRatio}
                      >
                        {t('添加')}
                      </Button>
                    </div>
                  </div>

                  {/* Save button */}
                  <div style={{ marginTop: 24 }}>
                    <Button
                      theme='solid'
                      type='primary'
                      size='large'
                      loading={saving}
                      disabled={!hasUnsavedChanges || saving}
                      onClick={handleSave}
                    >
                      {t('保存')}
                    </Button>
                    {hasUnsavedChanges && (
                      <Typography.Text type='warning' style={{ marginLeft: 12 }}>
                        {t('有未保存的更改')}
                      </Typography.Text>
                    )}
                  </div>
                </>
              )}
            </Card>
          </Col>
        </Row>

        {/* Create group modal */}
        <Modal
          title={t('新建定价分组')}
          visible={createModalVisible}
          onOk={handleCreateGroup}
          onCancel={() => setCreateModalVisible(false)}
          confirmLoading={saving}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('分组名称')}</div>
            <Input
              value={newGroupName}
              onChange={setNewGroupName}
              placeholder={t('例如：vip')}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('通用倍率')}</div>
            <InputNumber
              value={newGroupBaseRatio}
              min={0}
              step={0.1}
              parser={normalizeDecimalString}
              style={{ width: '100%' }}
              onChange={(val) => {
                const ratio = parseRatioValue(val);
                if (ratio === undefined) {
                  return;
                }
                setNewGroupBaseRatio(ratio);
              }}
            />
          </div>
        </Modal>
      </div>
    </Spin>
  );
}
