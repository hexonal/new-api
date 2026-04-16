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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API, showError, showSuccess } from '../../../../helpers';

const SYSTEM_GROUP_NAME = 'default';

function normalizeDecimalString(value) {
  return String(value ?? '')
    .replace(/[，。]/g, '.')
    .trim();
}

function parseRatioValue(value) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const numeric = Number(normalizeDecimalString(value));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function stableJSONStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJSONStringify(item)).join(',')}]`;
  }
  if (!value || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  const keys = Object.keys(value).sort();
  const content = keys
    .map((key) => `${JSON.stringify(key)}:${stableJSONStringify(value[key])}`)
    .join(',');
  return `{${content}}`;
}

function parseJsonMap(rawValue) {
  if (!rawValue) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toArray(data) {
  return Array.isArray(data) ? data : [];
}

function collectGroupNames({
  remoteGroups,
  groupRatio,
  groupModelRatio,
  users,
  channels,
}) {
  const names = new Set([
    ...toArray(remoteGroups),
    ...Object.keys(groupRatio || {}),
    ...Object.keys(groupModelRatio || {}),
  ]);

  toArray(users).forEach((item) => {
    if (item?.group) {
      names.add(String(item.group));
    }
  });

  toArray(channels).forEach((item) => {
    String(item?.group || '')
      .split(',')
      .map((group) => group.trim())
      .filter(Boolean)
      .forEach((group) => names.add(group));
  });

  return Array.from(names).sort((left, right) => {
    if (left === SYSTEM_GROUP_NAME) {
      return -1;
    }
    if (right === SYSTEM_GROUP_NAME) {
      return 1;
    }
    return left.localeCompare(right);
  });
}

function buildMemberCounts(users) {
  return toArray(users).reduce((accumulator, item) => {
    const group = String(item?.group || '').trim();
    if (!group) {
      return accumulator;
    }
    accumulator[group] = (accumulator[group] || 0) + 1;
    return accumulator;
  }, {});
}

function buildChannelCounts(channels) {
  return toArray(channels).reduce((accumulator, item) => {
    String(item?.group || '')
      .split(',')
      .map((group) => group.trim())
      .filter(Boolean)
      .forEach((group) => {
        accumulator[group] = (accumulator[group] || 0) + 1;
      });
    return accumulator;
  }, {});
}

function getGroupDescription(groupName, memberCount, channelCount) {
  if (!groupName) {
    return '';
  }
  if (groupName === SYSTEM_GROUP_NAME) {
    return '系统默认分组，所有未显式分配的账户默认归属到此分组。';
  }
  return `当前分组关联 ${memberCount} 名成员，绑定 ${channelCount} 个通道。`;
}

function getFallbackNextGroup(groupNames, deletedGroup) {
  const filtered = groupNames.filter((item) => item !== deletedGroup);
  return filtered[0] || '';
}

function getOptionValue(items, key) {
  return toArray(items).find((item) => item.key === key)?.value || '';
}

/**
 * 管理 Aurora 分组管理页的数据、业务动作和派生状态。
 * @returns {object} 页面所需状态与操作集合
 */
export function useGroupManagementPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteGroups, setRemoteGroups] = useState([]);
  const [groupRatio, setGroupRatio] = useState({});
  const [groupModelRatio, setGroupModelRatio] = useState({});
  const [models, setModels] = useState([]);
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupBaseRatio, setNewGroupBaseRatio] = useState(1);
  const [editBaseRatio, setEditBaseRatio] = useState(1);
  const [editModelRatios, setEditModelRatios] = useState({});
  const [addModelName, setAddModelName] = useState('');
  const [addModelRatio, setAddModelRatio] = useState(1);
  const savingGuardRef = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, optionRes, pricingRes, usersRes, channelsRes] =
        await Promise.all([
          API.get('/api/group/'),
          API.get('/api/option/'),
          API.get('/api/pricing'),
          API.get('/api/user/?p=1&page_size=200'),
          API.get('/api/channel/?p=1&page_size=200'),
        ]);

      setRemoteGroups(
        toArray(groupsRes?.data?.data).map((item) => String(item)),
      );
      setGroupRatio(
        parseJsonMap(getOptionValue(optionRes?.data?.data, 'GroupRatio')),
      );
      setGroupModelRatio(
        parseJsonMap(getOptionValue(optionRes?.data?.data, 'GroupModelRatio')),
      );
      setModels(
        toArray(pricingRes?.data?.data)
          .map((item) =>
            typeof item === 'string'
              ? item
              : item?.model_name || item?.id || '',
          )
          .filter(Boolean)
          .sort(),
      );
      setUsers(toArray(usersRes?.data?.data?.items));
      setChannels(toArray(channelsRes?.data?.data?.items));
    } catch (error) {
      showError(
        error?.response?.data?.message || error?.message || '加载分组配置失败',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const groupNames = useMemo(
    () =>
      collectGroupNames({
        remoteGroups,
        groupRatio,
        groupModelRatio,
        users,
        channels,
      }),
    [remoteGroups, groupRatio, groupModelRatio, users, channels],
  );

  const memberCounts = useMemo(() => buildMemberCounts(users), [users]);
  const channelCounts = useMemo(() => buildChannelCounts(channels), [channels]);

  useEffect(() => {
    if (!selectedGroup && groupNames.length > 0) {
      setSelectedGroup(groupNames[0]);
    }
  }, [groupNames, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) {
      return;
    }
    setEditBaseRatio(Number(groupRatio[selectedGroup] ?? 1));
    setEditModelRatios({ ...(groupModelRatio[selectedGroup] || {}) });
    setAddModelName('');
    setAddModelRatio(1);
  }, [selectedGroup, groupRatio, groupModelRatio]);

  const filteredGroups = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return groupNames;
    }
    return groupNames.filter((item) => item.toLowerCase().includes(keyword));
  }, [groupNames, searchQuery]);

  const availableModelOptions = useMemo(() => {
    const selected = new Set(Object.keys(editModelRatios));
    return models.filter((item) => !selected.has(item));
  }, [models, editModelRatios]);

  const isSystemGroup = selectedGroup === SYSTEM_GROUP_NAME;

  const modelRatioEntries = useMemo(
    () =>
      Object.entries(editModelRatios)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([model, ratio]) => ({ model, ratio })),
    [editModelRatios],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedGroup || isSystemGroup) {
      return false;
    }
    const baseChanged =
      Number(groupRatio[selectedGroup] ?? 1) !== Number(editBaseRatio);
    const ratiosChanged =
      stableJSONStringify(groupModelRatio[selectedGroup] || {}) !==
      stableJSONStringify(editModelRatios);
    return baseChanged || ratiosChanged;
  }, [
    selectedGroup,
    groupRatio,
    groupModelRatio,
    editBaseRatio,
    editModelRatios,
    isSystemGroup,
  ]);

  const groupUsers = useMemo(
    () =>
      users.filter(
        (item) =>
          String(item?.group || '').trim() === String(selectedGroup || ''),
      ),
    [users, selectedGroup],
  );

  const groupChannels = useMemo(() => {
    return channels.filter((item) =>
      String(item?.group || '')
        .split(',')
        .map((group) => group.trim())
        .filter(Boolean)
        .includes(selectedGroup),
    );
  }, [channels, selectedGroup]);

  const handleBaseRatioChange = useCallback(
    (nextValue) => {
      if (isSystemGroup) {
        return;
      }
      setEditBaseRatio(nextValue);
    },
    [isSystemGroup],
  );

  const handleAddModelRatio = useCallback(() => {
    if (isSystemGroup) {
      return;
    }
    if (!addModelName) {
      showError('请选择模型');
      return;
    }
    const ratio = parseRatioValue(addModelRatio);
    if (ratio === undefined) {
      showError('请输入有效倍率');
      return;
    }
    setEditModelRatios((current) => ({
      ...current,
      [addModelName]: ratio,
    }));
    setAddModelName('');
    setAddModelRatio(1);
  }, [addModelName, addModelRatio, isSystemGroup]);

  const handleRemoveModelRatio = useCallback(
    (modelName) => {
      if (isSystemGroup) {
        return;
      }
      setEditModelRatios((current) => {
        const next = { ...current };
        delete next[modelName];
        return next;
      });
    },
    [isSystemGroup],
  );

  const handleModelRatioChange = useCallback(
    (modelName, nextValue) => {
      if (isSystemGroup) {
        return;
      }
      const ratio = parseRatioValue(nextValue);
      if (ratio === undefined) {
        return;
      }
      setEditModelRatios((current) => ({ ...current, [modelName]: ratio }));
    },
    [isSystemGroup],
  );

  const handleSave = useCallback(async () => {
    if (
      !selectedGroup ||
      isSystemGroup ||
      savingGuardRef.current ||
      !hasUnsavedChanges
    ) {
      return;
    }
    savingGuardRef.current = true;
    setSaving(true);
    try {
      const response = await API.put('/api/option/group_pricing', {
        group: selectedGroup,
        base_ratio: Number(editBaseRatio),
        model_ratios: editModelRatios,
      });
      if (!response?.data?.success) {
        throw new Error(response?.data?.message || '保存失败');
      }
      const payload = response.data.data || {};
      setGroupRatio(payload.group_ratio || {});
      setGroupModelRatio(payload.group_model_ratio || {});
      showSuccess('保存成功');
    } catch (error) {
      showError(error?.message || '保存失败');
    } finally {
      setSaving(false);
      savingGuardRef.current = false;
    }
  }, [
    selectedGroup,
    isSystemGroup,
    hasUnsavedChanges,
    editBaseRatio,
    editModelRatios,
  ]);

  const handleCreateGroup = useCallback(async () => {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) {
      showError('请输入分组名称');
      return;
    }
    if (groupNames.includes(trimmedName)) {
      showError('分组已存在');
      return;
    }
    setSaving(true);
    try {
      const response = await API.put('/api/option/group_pricing', {
        group: trimmedName,
        base_ratio: Number(newGroupBaseRatio),
        model_ratios: {},
      });
      if (!response?.data?.success) {
        throw new Error(response?.data?.message || '创建失败');
      }
      const payload = response.data.data || {};
      setGroupRatio(payload.group_ratio || {});
      setGroupModelRatio(payload.group_model_ratio || {});
      setCreateDialogOpen(false);
      setNewGroupName('');
      setNewGroupBaseRatio(1);
      setSelectedGroup(trimmedName);
      showSuccess('创建成功');
    } catch (error) {
      showError(error?.message || '创建失败');
    } finally {
      setSaving(false);
    }
  }, [newGroupName, groupNames, newGroupBaseRatio]);

  const handleDeleteGroup = useCallback(async () => {
    if (!selectedGroup || selectedGroup === SYSTEM_GROUP_NAME) {
      return;
    }
    setSaving(true);
    try {
      const response = await API.put('/api/option/group_pricing', {
        group: selectedGroup,
        delete: true,
      });
      if (!response?.data?.success) {
        throw new Error(response?.data?.message || '删除失败');
      }
      const payload = response.data.data || {};
      setGroupRatio(payload.group_ratio || {});
      setGroupModelRatio(payload.group_model_ratio || {});
      setSelectedGroup(getFallbackNextGroup(groupNames, selectedGroup));
      showSuccess('删除成功');
    } catch (error) {
      showError(error?.message || '删除失败');
    } finally {
      setSaving(false);
    }
  }, [groupNames, selectedGroup]);

  return {
    loading,
    saving,
    searchQuery,
    setSearchQuery,
    selectedGroup,
    setSelectedGroup,
    filteredGroups,
    memberCounts,
    channelCounts,
    groupNames,
    createDialogOpen,
    setCreateDialogOpen,
    newGroupName,
    setNewGroupName,
    newGroupBaseRatio,
    setNewGroupBaseRatio,
    editBaseRatio,
    handleBaseRatioChange,
    modelRatioEntries,
    addModelName,
    setAddModelName,
    addModelRatio,
    setAddModelRatio,
    availableModelOptions,
    handleAddModelRatio,
    handleRemoveModelRatio,
    handleModelRatioChange,
    handleSave,
    handleCreateGroup,
    handleDeleteGroup,
    hasUnsavedChanges,
    groupUsers,
    groupChannels,
    groupDescription: getGroupDescription(
      selectedGroup,
      memberCounts[selectedGroup] || 0,
      channelCounts[selectedGroup] || 0,
    ),
    isSystemGroup,
    loadData,
  };
}
