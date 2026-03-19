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
import { useTranslation } from 'react-i18next';
import { API, copy, showError, showSuccess } from '../../helpers';

const DEFAULT_PAGE_SIZE = 20;

const pickFirst = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const parseRawItems = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.Items)) {
      return value.Items;
    }
    if (Array.isArray(value.items)) {
      return value.items;
    }
  }
  return [];
};

const normalizeGroup = (group) => ({
  id: pickFirst(group?.Id, group?.id),
  name: pickFirst(group?.Name, group?.name, ''),
  title: pickFirst(group?.Title, group?.title, ''),
  description: pickFirst(group?.Description, group?.description, ''),
  groupType: pickFirst(group?.GroupType, group?.group_type, ''),
  projectName: pickFirst(group?.ProjectName, group?.project_name, ''),
  createTime: pickFirst(group?.CreateTime, group?.create_time, ''),
  updateTime: pickFirst(group?.UpdateTime, group?.update_time, ''),
});

const normalizeAsset = (asset) => ({
  id: pickFirst(asset?.Id, asset?.id),
  upstreamAssetId: pickFirst(
    asset?.Id,
    asset?.id,
    asset?.upstream_asset_id,
    asset?.upstreamAssetId,
  ),
  name: pickFirst(asset?.Name, asset?.name, ''),
  url: pickFirst(asset?.URL, asset?.url, ''),
  groupId: pickFirst(asset?.GroupId, asset?.group_id, asset?.groupId),
  status: pickFirst(asset?.Status, asset?.status, ''),
  assetType: pickFirst(asset?.AssetType, asset?.asset_type, ''),
  error: pickFirst(asset?.Error, asset?.error, null),
  projectName: pickFirst(asset?.ProjectName, asset?.project_name, ''),
  createTime: pickFirst(asset?.CreateTime, asset?.create_time, ''),
  updateTime: pickFirst(asset?.UpdateTime, asset?.update_time, ''),
  errorCode: pickFirst(asset?.error_code, asset?.ErrorCode, ''),
  errorMessage: pickFirst(asset?.error_message, asset?.ErrorMessage, ''),
  assetRef: pickFirst(asset?.asset_ref, asset?.AssetRef, ''),
  groupName: pickFirst(asset?.group_name, asset?.GroupName, ''),
  raw: asset,
});

const normalizeListData = (data, listKeys = [], normalizer = (item) => item) => {
  const rawItems = pickFirst(
    data?.Items,
    data?.items,
    data?.Result?.Items,
    data?.result?.items,
    ...listKeys.map((key) => data?.[key]),
  );
  const list = parseRawItems(rawItems).map((item) => normalizer(item));

  return {
    list,
    total: Number(
      pickFirst(
        data?.TotalCount,
        data?.totalCount,
        data?.total,
        data?.Count,
        data?.count,
        data?.Result?.TotalCount,
        data?.result?.totalCount,
        list.length,
      ),
    ),
    page: Number(
      pickFirst(
        data?.PageNumber,
        data?.pageNumber,
        data?.page_number,
        data?.page,
        data?.Result?.PageNumber,
        data?.result?.pageNumber,
        1,
      ),
    ),
    pageSize: Number(
      pickFirst(
        data?.PageSize,
        data?.pageSize,
        data?.page_size,
        data?.Result?.PageSize,
        data?.result?.pageSize,
        DEFAULT_PAGE_SIZE,
      ),
    ),
  };
};

const getAssetReference = (asset) => {
  const upstreamId = pickFirst(
    asset?.upstreamAssetId,
    asset?.upstream_asset_id,
    asset?.assetId,
    asset?.asset_id,
    asset?.Id,
    asset?.id,
  );
  return upstreamId ? `asset://${upstreamId}` : '';
};

const isProcessingAsset = (asset) =>
  String(asset?.status || '').toLowerCase() === 'processing';

const buildFilters = ({ selectedGroup, statusFilter, searchKeyword }) => {
  const filters = {};
  if (selectedGroup) {
    filters.group_ids = [selectedGroup];
  }
  if (statusFilter) {
    filters.statuses = [statusFilter];
  }
  if (searchKeyword?.trim()) {
    filters.name = searchKeyword.trim();
  }
  return filters;
};

export default function useAssetsData() {
  const { t } = useTranslation();

  const [assets, setAssets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');

  const [uploadVisible, setUploadVisible] = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentAsset, setCurrentAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const stateRef = useRef({
    activePage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    selectedGroup: null,
    statusFilter: null,
    searchKeyword: '',
  });
  const initializedRef = useRef(false);

  useEffect(() => {
    stateRef.current = {
      activePage,
      pageSize,
      selectedGroup,
      statusFilter,
      searchKeyword,
    };
  }, [activePage, pageSize, selectedGroup, statusFilter, searchKeyword]);

  const fetchGroups = useCallback(async () => {
    const res = await API.post('/v1/assets/group/list', {
      filters: {},
      page_number: 1,
      page_size: 200,
    });
    const { success, message, data } = res.data || {};
    if (!success) {
      showError(message || t('获取素材分组失败'));
      return;
    }
    const { list } = normalizeListData(data, ['groups'], normalizeGroup);
    setGroups(list);
  }, [t]);

  const fetchQuota = useCallback(async () => {
    setQuotaLoading(true);
    try {
      const res = await API.post('/v1/assets/quota', {});
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || t('获取素材配额失败'));
        return;
      }
      setQuota(data || {});
    } finally {
      setQuotaLoading(false);
    }
  }, [t]);

  const fetchAssets = useCallback(
    async (pageArg, sizeArg, options = {}) => {
      const { silent = false, filters } = options;
      const currentState = stateRef.current;
      const page = pageArg ?? currentState.activePage;
      const size = sizeArg ?? currentState.pageSize;
      const requestFilters =
        filters ||
        buildFilters({
          selectedGroup: currentState.selectedGroup,
          statusFilter: currentState.statusFilter,
          searchKeyword: currentState.searchKeyword,
        });

      if (!silent) {
        setLoading(true);
      }
      try {
        const res = await API.post('/v1/assets/list', {
          filters: requestFilters,
          page_number: page,
          page_size: size,
          sort_by: 'created_at',
          sort_order: 'desc',
        });
        const { success, message, data } = res.data || {};
        if (!success) {
          showError(message || t('获取素材列表失败'));
          return false;
        }

        const normalized = normalizeListData(data, ['assets'], normalizeAsset);
        setAssets(normalized.list);
        setTotal(normalized.total);
        setActivePage(page);
        setPageSize(size);
        return true;
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [t],
  );

  const refresh = useCallback(async () => {
    await fetchAssets();
  }, [fetchAssets]);

  const handlePageChange = useCallback((page) => {
    setActivePage(page);
  }, []);

  const handlePageSizeChange = useCallback((size) => {
    setPageSize(size);
    setActivePage(1);
  }, []);

  const applyFilters = useCallback(async () => {
    if (activePage === 1) {
      await fetchAssets(1, pageSize);
      return;
    }
    setActivePage(1);
  }, [activePage, fetchAssets, pageSize]);

  const resetFilters = useCallback(async () => {
    setSelectedGroup(null);
    setStatusFilter(null);
    setSearchKeyword('');
    if (activePage === 1) {
      await fetchAssets(1, pageSize, { filters: {} });
      return;
    }
    setActivePage(1);
  }, [activePage, fetchAssets, pageSize]);

  const openAssetDetail = useCallback(
    async (asset) => {
      const assetID = pickFirst(asset?.id, asset?.Id);
      if (!assetID) {
        showError(t('素材 ID 不存在'));
        return;
      }
      setDetailVisible(true);
      setDetailLoading(true);
      try {
        const res = await API.post('/v1/assets/get', { id: assetID });
        const { success, message, data } = res.data || {};
        if (!success) {
          showError(message || t('获取素材详情失败'));
          return;
        }
        setCurrentAsset(normalizeAsset(data || asset));
      } finally {
        setDetailLoading(false);
      }
    },
    [t],
  );

  const closeAssetDetail = useCallback(() => {
    setDetailVisible(false);
    setCurrentAsset(null);
  }, []);

  const createGroup = useCallback(
    async ({ name, description }) => {
      setSubmitting(true);
      try {
        const res = await API.post('/v1/assets/group/create', {
          name,
          description: description || '',
        });
        const { success, message } = res.data || {};
        if (!success) {
          showError(message || t('创建分组失败'));
          return false;
        }
        showSuccess(t('创建分组成功'));
        setCreateGroupVisible(false);
        await fetchGroups();
        return true;
      } finally {
        setSubmitting(false);
      }
    },
    [fetchGroups, t],
  );

  const uploadAsset = useCallback(
    async ({ groupId, url, name }) => {
      setSubmitting(true);
      try {
        const res = await API.post('/v1/assets/create', {
          group_id: groupId,
          url,
          name: name || '',
        });
        const { success, message } = res.data || {};
        if (!success) {
          showError(message || t('上传素材失败'));
          return false;
        }
        showSuccess(t('上传素材成功'));
        setUploadVisible(false);
        await fetchAssets(1, pageSize);
        await fetchQuota();
        return true;
      } finally {
        setSubmitting(false);
      }
    },
    [fetchAssets, fetchQuota, pageSize, t],
  );

  const renameAsset = useCallback(
    async (id, name) => {
      const res = await API.post('/v1/assets/update', { id, name });
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || t('重命名失败'));
        return false;
      }
      showSuccess(t('重命名成功'));
      await fetchAssets(undefined, undefined, { silent: true });
      if (currentAsset?.id === id) {
        setCurrentAsset((prev) => ({ ...(prev || {}), name }));
      }
      return true;
    },
    [currentAsset?.id, fetchAssets, t],
  );

  const removeAsset = useCallback(
    async (id) => {
      const res = await API.post('/v1/assets/delete', { id });
      const { success, message } = res.data || {};
      if (!success) {
        showError(message || t('删除素材失败'));
        return false;
      }
      showSuccess(t('删除成功'));
      await fetchAssets();
      await fetchQuota();
      return true;
    },
    [fetchAssets, fetchQuota, t],
  );

  const copyReference = useCallback(
    async (asset) => {
      const ref = getAssetReference(asset);
      if (!ref) {
        showError(t('素材引用不可用'));
        return;
      }
      if (await copy(ref)) {
        showSuccess(t('已复制素材引用'));
      } else {
        showError(t('复制失败，请手动复制'));
      }
    },
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchGroups(),
          fetchQuota(),
          fetchAssets(1, stateRef.current.pageSize),
        ]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          initializedRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAssets, fetchGroups, fetchQuota]);

  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }
    fetchAssets();
  }, [activePage, pageSize, selectedGroup, statusFilter, searchKeyword, fetchAssets]);

  const hasProcessingAssets = useMemo(
    () => assets.some((asset) => isProcessingAsset(asset)),
    [assets],
  );

  useEffect(() => {
    if (!hasProcessingAssets) return undefined;
    const intervalId = window.setInterval(() => {
      fetchAssets(undefined, undefined, { silent: true });
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [fetchAssets, hasProcessingAssets]);

  return {
    t,
    assets,
    groups,
    quota,
    loading,
    quotaLoading,
    activePage,
    pageSize,
    total,
    selectedGroup,
    statusFilter,
    searchKeyword,
    uploadVisible,
    createGroupVisible,
    detailVisible,
    detailLoading,
    currentAsset,
    submitting,
    setSelectedGroup,
    setStatusFilter,
    setSearchKeyword,
    setUploadVisible,
    setCreateGroupVisible,
    applyFilters,
    resetFilters,
    refresh,
    handlePageChange,
    handlePageSizeChange,
    uploadAsset,
    createGroup,
    openAssetDetail,
    closeAssetDetail,
    copyReference,
    renameAsset,
    removeAsset,
    getAssetReference,
  };
}
