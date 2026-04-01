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
import {
  Typography,
  Button,
  Card,
  Tag,
  Modal,
  Input,
  Select,
  Row,
  Col,
  Empty,
  Popconfirm,
  Space,
  Spin,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';

const USER_USABLE_GROUPS_KEY = 'UserUsableGroups';
const GROUP_SPECIAL_USABLE_GROUP_KEY =
  'group_ratio_setting.group_special_usable_group';

function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const normalized = {};
  Object.entries(value).forEach(([key, val]) => {
    normalized[String(key)] = String(val ?? '');
  });
  return normalized;
}

function normalizeNestedObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const normalized = {};
  Object.entries(value).forEach(([outerKey, nested]) => {
    normalized[String(outerKey)] = normalizeObject(nested);
  });
  return normalized;
}

function parseJsonObject(value) {
  if (!value || String(value).trim() === '') {
    return {};
  }
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid-json-object');
  }
  return parsed;
}

function extractTokenGroups(groupData) {
  if (Array.isArray(groupData)) {
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
      .filter((item) => item !== '');
    return Array.from(new Set(values));
  }

  if (groupData && typeof groupData === 'object') {
    return Object.keys(groupData);
  }

  return [];
}

function parseSelectedGroups(userGroup, globalUsable, specialRules) {
  const result = new Set(Object.keys(globalUsable));
  const rules = specialRules[userGroup] || {};
  for (const [key] of Object.entries(rules)) {
    if (key.startsWith('-:')) {
      result.delete(key.substring(2));
    } else if (key.startsWith('+:')) {
      result.add(key.substring(2));
    } else {
      result.add(key);
    }
  }
  return Array.from(result);
}

function derivePermissionGroups(globalUsable, special) {
  return Object.keys(special).map((name) => ({
    name,
    selectedTokenGroups: parseSelectedGroups(name, globalUsable, special),
  }));
}

function computeSpecialRules(selectedGroups, globalUsable) {
  const rules = {};
  for (const key of Object.keys(globalUsable)) {
    if (!selectedGroups.includes(key)) {
      rules[`-:${key}`] = globalUsable[key];
    }
  }
  for (const key of selectedGroups) {
    if (!(key in globalUsable)) {
      rules[`+:${key}`] = key;
    }
  }
  return rules;
}

function areFlatObjectsEqual(a, b) {
  const aEntries = Object.entries(a || {});
  const bEntries = Object.entries(b || {});
  if (aEntries.length !== bEntries.length) {
    return false;
  }
  return aEntries.every(([key, value]) => b[key] === value);
}

export default function GroupManagement() {
  const { t } = useTranslation();

  const [globalUsableGroups, setGlobalUsableGroups] = useState({});
  const [savedGlobalUsableGroups, setSavedGlobalUsableGroups] = useState({});
  const [specialRules, setSpecialRules] = useState({});
  const [allTokenGroups, setAllTokenGroups] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [modalName, setModalName] = useState('');
  const [modalSelected, setModalSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewGroup, setPreviewGroup] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [optionRes, groupRes] = await Promise.all([
          API.get('/api/option/'),
          API.get('/api/group/'),
        ]);

        if (!optionRes.data?.success) {
          showError(optionRes.data?.message || t('获取配置失败'));
          return;
        }

        const options = optionRes.data?.data || [];
        const globalRaw =
          options.find((item) => item.key === USER_USABLE_GROUPS_KEY)?.value || '{}';
        const specialRaw =
          options.find((item) => item.key === GROUP_SPECIAL_USABLE_GROUP_KEY)?.value ||
          '{}';

        const parsedGlobal = normalizeObject(parseJsonObject(globalRaw));
        const parsedSpecial = normalizeNestedObject(parseJsonObject(specialRaw));

        setGlobalUsableGroups(parsedGlobal);
        setSavedGlobalUsableGroups(parsedGlobal);
        setSpecialRules(parsedSpecial);
        setPermissionGroups(derivePermissionGroups(parsedGlobal, parsedSpecial));

        if (groupRes.data?.success) {
          setAllTokenGroups(extractTokenGroups(groupRes.data?.data || []));
        } else {
          setAllTokenGroups([]);
        }
      } catch (error) {
        showError(t('加载失败，请检查配置格式或稍后重试'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [t]);

  useEffect(() => {
    setPermissionGroups(derivePermissionGroups(globalUsableGroups, specialRules));
  }, [globalUsableGroups, specialRules]);

  const tokenGroupOptions = useMemo(
    () => allTokenGroups.map((group) => ({ label: group, value: group })),
    [allTokenGroups],
  );
  const previewResult = useMemo(() => {
    if (!previewGroup) {
      return [];
    }
    return parseSelectedGroups(previewGroup, globalUsableGroups, specialRules);
  }, [previewGroup, globalUsableGroups, specialRules]);
  const isGlobalModified = useMemo(
    () => !areFlatObjectsEqual(globalUsableGroups, savedGlobalUsableGroups),
    [globalUsableGroups, savedGlobalUsableGroups],
  );

  function handleCreate() {
    setEditingGroup(null);
    setModalName('');
    setModalSelected([]);
    setModalVisible(true);
  }

  function handleEdit(group) {
    setEditingGroup(group.name);
    setModalName(group.name);
    setModalSelected(group.selectedTokenGroups);
    setModalVisible(true);
  }

  function handleDelete(name) {
    const newSpecial = { ...specialRules };
    delete newSpecial[name];
    setSpecialRules(newSpecial);
  }

  function handleModalSave() {
    const finalName = String(modalName || '').trim();
    if (!finalName) {
      showError(t('请输入分组名称'));
      return;
    }
    if (!editingGroup && specialRules[finalName]) {
      showError(t('分组名称已存在'));
      return;
    }

    const rules = computeSpecialRules(modalSelected, globalUsableGroups);
    const newSpecial = { ...specialRules, [finalName]: rules };
    setSpecialRules(newSpecial);
    setModalVisible(false);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const specialJson = JSON.stringify(specialRules);

      const specialRes = await API.put('/api/option/', {
        key: GROUP_SPECIAL_USABLE_GROUP_KEY,
        value: specialJson,
      });
      if (!specialRes.data?.success) {
        throw new Error(specialRes.data?.message || 'save-special-failed');
      }

      if (isGlobalModified) {
        const globalJson = JSON.stringify(globalUsableGroups);
        const globalRes = await API.put('/api/option/', {
          key: USER_USABLE_GROUPS_KEY,
          value: globalJson,
        });
        if (!globalRes.data?.success) {
          throw new Error(globalRes.data?.message || 'save-global-failed');
        }
        setSavedGlobalUsableGroups(globalUsableGroups);
      }

      showSuccess(t('保存成功'));
    } catch (error) {
      showError(error?.message || t('保存失败'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Spin spinning={loading}>
      <div style={{ paddingBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <Typography.Title
              heading={3}
              style={{ marginBottom: 4, fontSize: '1.5rem', fontWeight: 600 }}
            >
              {t('权限分组管理')}
            </Typography.Title>
            <Typography.Text style={{ color: '#727786' }}>
              {t('管理用户权限分组，配置每个分组可使用的令牌分组')}
            </Typography.Text>
          </div>
        </div>

        <Row gutter={24}>
          <Col span={16}>
            <Card
              style={{ borderRadius: 12, marginBottom: 16 }}
              bodyStyle={{ padding: 24 }}
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
                  {t('权限分组')}
                </Typography.Title>
                <Button
                  icon={<IconPlus />}
                  theme='solid'
                  type='primary'
                  onClick={handleCreate}
                >
                  {t('新建权限分组')}
                </Button>
              </div>

              {permissionGroups.length === 0 ? (
                <Empty description={t('暂无权限分组，点击上方按钮创建')} />
              ) : (
                permissionGroups.map((group) => (
                  <Card
                    key={group.name}
                    style={{ borderRadius: 12, marginBottom: 16 }}
                    title={
                      <Typography.Title heading={5} style={{ margin: 0, fontWeight: 600 }}>
                        {group.name}
                      </Typography.Title>
                    }
                    headerExtraContent={
                      <Space>
                        <Button
                          size='small'
                          theme='light'
                          type='primary'
                          onClick={() => handleEdit(group)}
                        >
                          {t('编辑')}
                        </Button>
                        <Popconfirm
                          title={t('确定删除该权限分组？')}
                          onConfirm={() => handleDelete(group.name)}
                        >
                          <Button size='small' theme='light' type='danger'>
                            {t('删除')}
                          </Button>
                        </Popconfirm>
                      </Space>
                    }
                    bodyStyle={{ paddingTop: 12, paddingBottom: 16 }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {group.selectedTokenGroups.map((tokenGroup) => (
                        <Tag
                          size='large'
                          color='blue'
                          key={`${group.name}-${tokenGroup}`}
                        >
                          {tokenGroup}
                        </Tag>
                      ))}
                      {group.selectedTokenGroups.length === 0 && (
                        <Typography.Text type='tertiary'>
                          {t('无可用令牌分组')}
                        </Typography.Text>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </Card>
          </Col>

          <Col span={8}>
            <Card
              style={{
                borderRadius: 12,
                borderLeft: '4px solid var(--semi-color-primary)',
                marginBottom: 16,
              }}
              bodyStyle={{ padding: 20 }}
            >
              <Typography.Title heading={5} style={{ marginTop: 0 }}>
                {t('预览最终分组')}
              </Typography.Title>
              <Select
                placeholder={t('选择用户分组')}
                optionList={permissionGroups.map((g) => ({ label: g.name, value: g.name }))}
                value={previewGroup}
                onChange={setPreviewGroup}
                style={{ width: '100%', marginBottom: 16 }}
              />
              <div>
                <Typography.Text strong>{t('最终可用分组：')}</Typography.Text>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 8,
                    minHeight: 28,
                  }}
                >
                  {previewResult.length > 0 ? (
                    previewResult.map((g) => (
                      <Tag color='blue' size='large' key={g}>
                        {g}
                      </Tag>
                    ))
                  ) : (
                    <Typography.Text type='tertiary'>
                      {previewGroup ? t('无可用令牌分组') : t('请选择用户分组')}
                    </Typography.Text>
                  )}
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Modal
          title={editingGroup ? t('编辑权限分组') : t('新建权限分组')}
          visible={modalVisible}
          onOk={handleModalSave}
          onCancel={() => setModalVisible(false)}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              {t('权限分组名称')}
            </div>
            <Input
              value={modalName}
              onChange={setModalName}
              disabled={!!editingGroup}
              placeholder={t('例如：plus-8折')}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              {t('可用令牌分组')}
            </div>
            <Select
              multiple
              filter
              value={modalSelected}
              onChange={setModalSelected}
              optionList={tokenGroupOptions}
              placeholder={t('选择该权限分组可使用的令牌分组')}
              style={{ width: '100%' }}
              maxTagCount={10}
            />
          </div>
        </Modal>

        <div style={{ marginTop: 24 }}>
          <Button
            theme='solid'
            type='primary'
            size='large'
            loading={loading}
            onClick={handleSave}
          >
            {t('保存设置')}
          </Button>
        </div>
      </div>
    </Spin>
  );
}
