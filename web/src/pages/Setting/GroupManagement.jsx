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

import React, { useMemo, useState, useEffect } from 'react';
import {
  Button,
  Card,
  Collapse,
  Form,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../helpers';

const USER_USABLE_GROUPS_KEY = 'UserUsableGroups';
const GROUP_SPECIAL_USABLE_GROUP_KEY =
  'group_ratio_setting.group_special_usable_group';

const safeStringify = (value) => JSON.stringify(value, null, 2);

const normalizeObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const result = {};
  Object.entries(value).forEach(([key, val]) => {
    result[String(key)] = String(val ?? '');
  });
  return result;
};

const parseJsonObject = (jsonText, t, errorLabel) => {
  if (!jsonText || jsonText.trim() === '') {
    return {};
  }
  if (!verifyJSON(jsonText)) {
    showError(t('{{label}} 不是合法的 JSON 字符串', { label: errorLabel }));
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      showError(t('{{label}} 必须是 JSON 对象', { label: errorLabel }));
      return null;
    }
    return parsed;
  } catch {
    showError(t('{{label}} 解析失败', { label: errorLabel }));
    return null;
  }
};

const parseSpecialGroupObject = (jsonText, t) => {
  const parsed = parseJsonObject(jsonText, t, t('分组特殊可用分组'));
  if (parsed === null) {
    return null;
  }

  const normalized = {};
  Object.entries(parsed).forEach(([groupName, rules]) => {
    normalized[String(groupName)] = normalizeObject(rules);
  });
  return normalized;
};

function previewFinalGroups(
  userGroup,
  usableGroups,
  specialGroups,
  userGroupLabel,
) {
  const result = { ...usableGroups };
  const rules = specialGroups[userGroup] || {};

  Object.entries(rules).forEach(([key, desc]) => {
    if (key.startsWith('-:')) {
      delete result[key.substring(2)];
    } else if (key.startsWith('+:')) {
      result[key.substring(2)] = desc;
    } else {
      result[key] = desc;
    }
  });

  if (userGroup && !result[userGroup]) {
    result[userGroup] = userGroupLabel;
  }

  return result;
}

export default function GroupManagement() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);

  const [inputs, setInputs] = useState({
    [USER_USABLE_GROUPS_KEY]: '{}',
    [GROUP_SPECIAL_USABLE_GROUP_KEY]: '{}',
  });
  const [originInputs, setOriginInputs] = useState({
    [USER_USABLE_GROUPS_KEY]: '{}',
    [GROUP_SPECIAL_USABLE_GROUP_KEY]: '{}',
  });

  const [userUsableGroups, setUserUsableGroups] = useState({});
  const [specialUsableGroups, setSpecialUsableGroups] = useState({});
  const [groupOptions, setGroupOptions] = useState([]);
  const [previewGroup, setPreviewGroup] = useState('');

  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [editingGroupKey, setEditingGroupKey] = useState('');
  const [groupFormValue, setGroupFormValue] = useState({
    key: '',
    description: '',
  });

  const [userRuleModalVisible, setUserRuleModalVisible] = useState(false);
  const [newUserGroupName, setNewUserGroupName] = useState('');

  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [ruleTargetUserGroup, setRuleTargetUserGroup] = useState('');
  const [ruleFormValue, setRuleFormValue] = useState({
    operation: 'add',
    targetGroup: '',
    description: '',
  });

  const userUsableTableData = useMemo(
    () =>
      Object.entries(userUsableGroups).map(([key, description]) => ({
        key,
        groupKey: key,
        description,
      })),
    [userUsableGroups],
  );

  const previewResult = useMemo(() => {
    if (!previewGroup) {
      return {};
    }
    return previewFinalGroups(
      previewGroup,
      userUsableGroups,
      specialUsableGroups,
      t('用户分组'),
    );
  }, [previewGroup, userUsableGroups, specialUsableGroups, t]);

  const updateUserUsableGroups = (nextValue) => {
    const normalized = normalizeObject(nextValue);
    setUserUsableGroups(normalized);
    setInputs((prev) => ({
      ...prev,
      [USER_USABLE_GROUPS_KEY]: safeStringify(normalized),
    }));
  };

  const updateSpecialUsableGroups = (nextValue) => {
    const normalized = {};
    Object.entries(nextValue || {}).forEach(([groupName, rules]) => {
      normalized[String(groupName)] = normalizeObject(rules);
    });

    setSpecialUsableGroups(normalized);
    setInputs((prev) => ({
      ...prev,
      [GROUP_SPECIAL_USABLE_GROUP_KEY]: safeStringify(normalized),
    }));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [optionRes, groupRes] = await Promise.all([
        API.get('/api/option/'),
        API.get('/api/group'),
      ]);

      if (!optionRes.data?.success) {
        showError(optionRes.data?.message || t('获取配置失败'));
        return;
      }

      const loadedInputs = {
        [USER_USABLE_GROUPS_KEY]: '{}',
        [GROUP_SPECIAL_USABLE_GROUP_KEY]: '{}',
      };

      (optionRes.data?.data || []).forEach((item) => {
        if (
          item.key === USER_USABLE_GROUPS_KEY ||
          item.key === GROUP_SPECIAL_USABLE_GROUP_KEY
        ) {
          loadedInputs[item.key] = item.value || '{}';
        }
      });

      const parsedUserGroups = parseJsonObject(
        loadedInputs[USER_USABLE_GROUPS_KEY],
        t,
        t('用户可选分组'),
      );
      const parsedSpecialGroups = parseSpecialGroupObject(
        loadedInputs[GROUP_SPECIAL_USABLE_GROUP_KEY],
        t,
      );

      if (parsedUserGroups === null || parsedSpecialGroups === null) {
        return;
      }

      const normalizedUserGroups = normalizeObject(parsedUserGroups);

      setInputs({
        [USER_USABLE_GROUPS_KEY]: safeStringify(normalizedUserGroups),
        [GROUP_SPECIAL_USABLE_GROUP_KEY]: safeStringify(parsedSpecialGroups),
      });

      setOriginInputs({
        [USER_USABLE_GROUPS_KEY]: safeStringify(normalizedUserGroups),
        [GROUP_SPECIAL_USABLE_GROUP_KEY]: safeStringify(parsedSpecialGroups),
      });

      setUserUsableGroups(normalizedUserGroups);
      setSpecialUsableGroups(parsedSpecialGroups);

      if (groupRes.data?.success) {
        const options = Array.isArray(groupRes.data?.data)
          ? groupRes.data.data.map((item) => {
              if (typeof item === 'string') {
                return {
                  label: item,
                  value: item,
                };
              }
              const value =
                item?.name || item?.group || item?.value || String(item);
              return {
                label: value,
                value,
              };
            })
          : [];
        setGroupOptions(options);
      } else {
        setGroupOptions([]);
      }
    } catch (error) {
      showError(t('加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddGroupModal = () => {
    setEditingGroupKey('');
    setGroupFormValue({ key: '', description: '' });
    setGroupModalVisible(true);
  };

  const openEditGroupModal = (row) => {
    setEditingGroupKey(row.groupKey);
    setGroupFormValue({
      key: row.groupKey,
      description: row.description,
    });
    setGroupModalVisible(true);
  };

  const confirmGroupModal = () => {
    const groupKey = String(groupFormValue.key || '').trim();
    const description = String(groupFormValue.description || '').trim();

    if (!groupKey) {
      showWarning(t('请填写分组标识'));
      return;
    }

    const next = { ...userUsableGroups };
    if (
      editingGroupKey &&
      editingGroupKey !== groupKey &&
      Object.prototype.hasOwnProperty.call(next, groupKey)
    ) {
      showWarning(t('分组标识已存在'));
      return;
    }

    if (editingGroupKey && editingGroupKey !== groupKey) {
      delete next[editingGroupKey];
    }

    next[groupKey] = description;
    updateUserUsableGroups(next);
    setGroupModalVisible(false);
  };

  const deleteGroup = (groupKey) => {
    const next = { ...userUsableGroups };
    delete next[groupKey];
    updateUserUsableGroups(next);
  };

  const openAddUserRuleModal = () => {
    setNewUserGroupName('');
    setUserRuleModalVisible(true);
  };

  const confirmAddUserRuleModal = () => {
    const userGroupName = String(newUserGroupName || '').trim();
    if (!userGroupName) {
      showWarning(t('请填写用户分组名称'));
      return;
    }

    if (Object.prototype.hasOwnProperty.call(specialUsableGroups, userGroupName)) {
      showWarning(t('该用户分组规则已存在'));
      return;
    }

    updateSpecialUsableGroups({
      ...specialUsableGroups,
      [userGroupName]: {},
    });
    setUserRuleModalVisible(false);
  };

  const openAddRuleModal = (userGroupName) => {
    setRuleTargetUserGroup(userGroupName);
    setRuleFormValue({
      operation: 'add',
      targetGroup: '',
      description: '',
    });
    setRuleModalVisible(true);
  };

  const confirmAddRuleModal = () => {
    const targetGroup = String(ruleFormValue.targetGroup || '').trim();
    const description = String(ruleFormValue.description || '').trim();

    if (!ruleTargetUserGroup) {
      showWarning(t('用户分组不能为空'));
      return;
    }

    if (!targetGroup) {
      showWarning(t('请填写目标分组'));
      return;
    }

    const operationPrefix = ruleFormValue.operation === 'remove' ? '-:' : '+:';
    const ruleKey = `${operationPrefix}${targetGroup}`;

    const nextRules = {
      ...(specialUsableGroups[ruleTargetUserGroup] || {}),
      [ruleKey]: description,
    };

    updateSpecialUsableGroups({
      ...specialUsableGroups,
      [ruleTargetUserGroup]: nextRules,
    });

    setRuleModalVisible(false);
  };

  const deleteRule = (userGroupName, ruleKey) => {
    const nextRules = {
      ...(specialUsableGroups[userGroupName] || {}),
    };
    delete nextRules[ruleKey];

    updateSpecialUsableGroups({
      ...specialUsableGroups,
      [userGroupName]: nextRules,
    });
  };

  const deleteUserGroupRules = (userGroupName) => {
    const next = { ...specialUsableGroups };
    delete next[userGroupName];
    updateSpecialUsableGroups(next);
  };

  const handleSave = async () => {
    let submitInputs = {
      ...inputs,
    };

    if (!advancedMode) {
      submitInputs = {
        [USER_USABLE_GROUPS_KEY]: safeStringify(userUsableGroups),
        [GROUP_SPECIAL_USABLE_GROUP_KEY]: safeStringify(specialUsableGroups),
      };
    } else {
      const parsedUserGroups = parseJsonObject(
        inputs[USER_USABLE_GROUPS_KEY],
        t,
        t('用户可选分组'),
      );
      const parsedSpecialGroups = parseSpecialGroupObject(
        inputs[GROUP_SPECIAL_USABLE_GROUP_KEY],
        t,
      );

      if (parsedUserGroups === null || parsedSpecialGroups === null) {
        return;
      }

      const normalizedUserGroups = normalizeObject(parsedUserGroups);

      submitInputs = {
        [USER_USABLE_GROUPS_KEY]: safeStringify(normalizedUserGroups),
        [GROUP_SPECIAL_USABLE_GROUP_KEY]: safeStringify(parsedSpecialGroups),
      };

      setUserUsableGroups(normalizedUserGroups);
      setSpecialUsableGroups(parsedSpecialGroups);
      setInputs(submitInputs);
    }

    const updateArray = compareObjects(submitInputs, originInputs);
    if (!updateArray.length) {
      showWarning(t('你似乎并没有修改什么'));
      return;
    }

    setSaving(true);
    try {
      const requestQueue = updateArray.map((item) =>
        API.put('/api/option/', {
          key: item.key,
          value: submitInputs[item.key],
        }),
      );

      const res = await Promise.all(requestQueue);

      if (res.includes(undefined)) {
        showError(
          requestQueue.length > 1 ? t('部分保存失败，请重试') : t('保存失败'),
        );
        return;
      }

      for (let i = 0; i < res.length; i++) {
        if (!res[i].data?.success) {
          showError(res[i].data?.message || t('保存失败'));
          return;
        }
      }

      setOriginInputs(submitInputs);
      showSuccess(t('保存成功'));
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMode = () => {
    if (!advancedMode) {
      setAdvancedMode(true);
      return;
    }

    const parsedUserGroups = parseJsonObject(
      inputs[USER_USABLE_GROUPS_KEY],
      t,
      t('用户可选分组'),
    );
    const parsedSpecialGroups = parseSpecialGroupObject(
      inputs[GROUP_SPECIAL_USABLE_GROUP_KEY],
      t,
    );

    if (parsedUserGroups === null || parsedSpecialGroups === null) {
      return;
    }

    const normalizedUserGroups = normalizeObject(parsedUserGroups);
    setUserUsableGroups(normalizedUserGroups);
    setSpecialUsableGroups(parsedSpecialGroups);
    setInputs({
      [USER_USABLE_GROUPS_KEY]: safeStringify(normalizedUserGroups),
      [GROUP_SPECIAL_USABLE_GROUP_KEY]: safeStringify(parsedSpecialGroups),
    });
    setAdvancedMode(false);
  };

  const userUsableColumns = [
    {
      title: t('分组标识'),
      dataIndex: 'groupKey',
      render: (text) => (
        <Typography.Text
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          {text}
        </Typography.Text>
      ),
    },
    {
      title: t('分组描述'),
      dataIndex: 'description',
      render: (text) => text || '-',
    },
    {
      title: t('操作'),
      width: 180,
      render: (_, row) => (
        <Space>
          <Button size='small' onClick={() => openEditGroupModal(row)}>
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('确定删除该分组吗？')}
            onConfirm={() => deleteGroup(row.groupKey)}
          >
            <Button size='small' type='danger'>
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading || saving}>
      <Space vertical align='start' style={{ width: '100%' }} spacing='loose'>
        <Card
          title={t('分组管理')}
          style={{ width: '100%' }}
          headerExtraContent={
            <Button onClick={handleToggleMode}>
              {advancedMode
                ? t('返回可视化编辑')
                : t('切换到高级模式（JSON编辑）')}
            </Button>
          }
        >
          <Typography.Text type='secondary'>
            {t('可视化编辑用户可选分组与分组特殊可用分组规则，保存后立即生效。')}
          </Typography.Text>
        </Card>

        <Card title={t('用户可选分组')} style={{ width: '100%' }}>
          {advancedMode ? (
            <Form>
              <Form.TextArea
                field={USER_USABLE_GROUPS_KEY}
                label={t('用户可选分组 JSON')}
                autosize={{ minRows: 8, maxRows: 16 }}
                value={inputs[USER_USABLE_GROUPS_KEY]}
                onChange={(value) =>
                  setInputs((prev) => ({
                    ...prev,
                    [USER_USABLE_GROUPS_KEY]: value,
                  }))
                }
              />
            </Form>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <Button icon={<IconPlus />} type='primary' onClick={openAddGroupModal}>
                  {t('添加分组')}
                </Button>
              </div>
              <Table
                columns={userUsableColumns}
                dataSource={userUsableTableData}
                rowKey='key'
                pagination={false}
                size='small'
                scroll={{ x: 'max-content' }}
              />
            </>
          )}
        </Card>

        <Card title={t('分组特殊可用分组规则')} style={{ width: '100%' }}>
          {advancedMode ? (
            <Form>
              <Form.TextArea
                field={GROUP_SPECIAL_USABLE_GROUP_KEY}
                label={t('分组特殊可用分组 JSON')}
                autosize={{ minRows: 10, maxRows: 20 }}
                value={inputs[GROUP_SPECIAL_USABLE_GROUP_KEY]}
                onChange={(value) =>
                  setInputs((prev) => ({
                    ...prev,
                    [GROUP_SPECIAL_USABLE_GROUP_KEY]: value,
                  }))
                }
              />
            </Form>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <Button icon={<IconPlus />} type='primary' onClick={openAddUserRuleModal}>
                  {t('添加用户分组规则')}
                </Button>
              </div>

              <Collapse keepDOM>
                {Object.entries(specialUsableGroups).map(([groupName, rules]) => {
                  const tableData = Object.entries(rules || {}).map(([ruleKey, desc]) => {
                    let operation = 'add';
                    let targetGroup = ruleKey;

                    if (ruleKey.startsWith('-:')) {
                      operation = 'remove';
                      targetGroup = ruleKey.substring(2);
                    } else if (ruleKey.startsWith('+:')) {
                      operation = 'add';
                      targetGroup = ruleKey.substring(2);
                    }

                    return {
                      key: `${groupName}-${ruleKey}`,
                      ruleKey,
                      operation,
                      targetGroup,
                      description: desc,
                    };
                  });

                  return (
                    <Collapse.Panel
                      itemKey={groupName}
                      key={groupName}
                      header={
                        <Space>
                          <Typography.Text strong>
                            {t('{{groupName}} 用户分组规则', { groupName })}
                          </Typography.Text>
                          <Tag color='blue' size='small'>
                            {t('{{count}} 条规则', { count: tableData.length })}
                          </Tag>
                        </Space>
                      }
                      extra={
                        <Space>
                          <Button size='small' onClick={() => openAddRuleModal(groupName)}>
                            {t('添加规则')}
                          </Button>
                          <Popconfirm
                            title={t('确定删除整个用户分组规则吗？')}
                            onConfirm={() => deleteUserGroupRules(groupName)}
                          >
                            <Button size='small' type='danger'>
                              {t('删除分组规则')}
                            </Button>
                          </Popconfirm>
                        </Space>
                      }
                    >
                      <Table
                        size='small'
                        pagination={false}
                        rowKey='key'
                        dataSource={tableData}
                        columns={[
                          {
                            title: t('操作类型'),
                            dataIndex: 'operation',
                            render: (operation) =>
                              operation === 'remove' ? (
                                <Tag color='red'>{t('移除')}</Tag>
                              ) : (
                                <Tag color='green'>{t('添加')}</Tag>
                              ),
                          },
                          {
                            title: t('目标分组'),
                            dataIndex: 'targetGroup',
                          },
                          {
                            title: t('描述'),
                            dataIndex: 'description',
                            render: (text) => text || '-',
                          },
                          {
                            title: t('操作'),
                            width: 100,
                            render: (_, row) => (
                              <Popconfirm
                                title={t('确定删除该规则吗？')}
                                onConfirm={() => deleteRule(groupName, row.ruleKey)}
                              >
                                <Button size='small' type='danger'>
                                  {t('删除')}
                                </Button>
                              </Popconfirm>
                            ),
                          },
                        ]}
                        scroll={{ x: 'max-content' }}
                      />
                    </Collapse.Panel>
                  );
                })}
              </Collapse>
            </>
          )}
        </Card>

        <Card title={t('预览最终分组')} style={{ width: '100%' }}>
          <Space vertical align='start' style={{ width: '100%' }}>
            <Select
              style={{ width: 320, maxWidth: '100%' }}
              value={previewGroup}
              onChange={(value) => setPreviewGroup(value || '')}
              placeholder={t('选择用户分组')}
              optionList={groupOptions}
              filter
              clearable
            />

            <div>
              <Typography.Text strong>{t('最终可用分组')}</Typography.Text>
              <div style={{ marginTop: 8 }}>
                {Object.keys(previewResult).length === 0 ? (
                  <Typography.Text type='tertiary'>
                    {previewGroup
                      ? t('暂无可用分组')
                      : t('请选择一个用户分组进行预览')}
                  </Typography.Text>
                ) : (
                  Object.entries(previewResult).map(([groupKey, desc]) => (
                    <Tag key={groupKey} color='blue' style={{ marginBottom: 8 }}>
                      {groupKey}
                      {desc ? ` · ${desc}` : ''}
                    </Tag>
                  ))
                )}
              </div>
            </div>
          </Space>
        </Card>

        <div>
          <Button type='primary' onClick={handleSave} loading={saving}>
            {t('保存设置')}
          </Button>
        </div>
      </Space>

      <Modal
        title={editingGroupKey ? t('编辑分组') : t('添加分组')}
        visible={groupModalVisible}
        onCancel={() => setGroupModalVisible(false)}
        onOk={confirmGroupModal}
      >
        <Form>
          <Form.Input
            field='key'
            label={t('分组标识')}
            value={groupFormValue.key}
            onChange={(value) =>
              setGroupFormValue((prev) => ({
                ...prev,
                key: value,
              }))
            }
          />
          <Form.Input
            field='description'
            label={t('分组描述')}
            value={groupFormValue.description}
            onChange={(value) =>
              setGroupFormValue((prev) => ({
                ...prev,
                description: value,
              }))
            }
          />
        </Form>
      </Modal>

      <Modal
        title={t('添加用户分组规则')}
        visible={userRuleModalVisible}
        onCancel={() => setUserRuleModalVisible(false)}
        onOk={confirmAddUserRuleModal}
      >
        <Form>
          <Form.Input
            field='userGroupName'
            label={t('用户分组名称')}
            value={newUserGroupName}
            onChange={(value) => setNewUserGroupName(value)}
          />
        </Form>
      </Modal>

      <Modal
        title={t('添加规则')}
        visible={ruleModalVisible}
        onCancel={() => setRuleModalVisible(false)}
        onOk={confirmAddRuleModal}
      >
        <Form>
          <Form.Select
            field='operation'
            label={t('操作类型')}
            value={ruleFormValue.operation}
            onChange={(value) =>
              setRuleFormValue((prev) => ({
                ...prev,
                operation: value,
              }))
            }
            optionList={[
              {
                label: t('添加'),
                value: 'add',
              },
              {
                label: t('移除'),
                value: 'remove',
              },
            ]}
          />
          <Form.Input
            field='targetGroup'
            label={t('目标分组')}
            value={ruleFormValue.targetGroup}
            onChange={(value) =>
              setRuleFormValue((prev) => ({
                ...prev,
                targetGroup: value,
              }))
            }
          />
          <Form.Input
            field='description'
            label={t('描述')}
            value={ruleFormValue.description}
            onChange={(value) =>
              setRuleFormValue((prev) => ({
                ...prev,
                description: value,
              }))
            }
          />
        </Form>
      </Modal>
    </Spin>
  );
}
