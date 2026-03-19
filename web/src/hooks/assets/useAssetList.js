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

import { useState, useEffect, useCallback, useRef } from 'react';
import { listAssets } from '../../services/assetService';
import { showError } from '../../helpers';

/**
 * 素材列表数据加载 Hook
 *
 * @param {Object} options - 配置选项
 * @param {Object} options.initialFilters - 初始筛选条件
 * @param {number} options.pageSize - 每页数量（默认 10）
 * @param {string} options.sortBy - 排序字段（默认 'CreateTime'）
 * @param {string} options.sortOrder - 排序顺序（默认 'Desc'）
 *
 * @returns {Object} {
 *   assets: Array,
 *   loading: boolean,
 *   error: string | null,
 *   pagination: { page, total, pageSize, totalPages },
 *   filters: Object,
 *   updateFilters: (newFilters) => void,
 *   goToPage: (page) => void,
 *   refetch: () => Promise<void>
 * }
 */
export function useAssetList(options = {}) {
  const {
    initialFilters = {},
    pageSize = 10,
    sortBy = 'CreateTime',
    sortOrder = 'Desc',
  } = options;

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const initializedRef = useRef(false);

  // 加载数据
  const loadAssets = useCallback(
    async (currentPage = 1) => {
      setLoading(true);
      setError(null);

      try {
        const result = await listAssets(
          filters,
          currentPage,
          pageSize,
          sortBy,
          sortOrder,
        );

        if (result.success) {
          setAssets(result.data.assets || []);
          setTotal(result.data.total || 0);
          setPage(currentPage);
        } else {
          setError(result.message || '加载素材列表失败');
          showError(result.message || '加载素材列表失败');
        }
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.message || '加载失败';
        setError(errorMsg);
        showError(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [filters, pageSize, sortBy, sortOrder],
  );

  // 初始加载（只触发一次）
  useEffect(() => {
    loadAssets(1);
    initializedRef.current = true;
  }, []);

  // 更新筛选条件
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    setPage(1); // 重置到第一页
  }, []);

  // 跳转到指定页
  const goToPage = useCallback(
    (nextPage) => {
      if (nextPage >= 1 && nextPage <= Math.ceil(total / pageSize)) {
        loadAssets(nextPage);
      }
    },
    [loadAssets, total, pageSize],
  );

  // 刷新当前页
  const refetch = useCallback(async () => {
    await loadAssets(page);
  }, [loadAssets, page]);

  // 当筛选条件或分页配置变化时重新加载（跳过首屏，避免重复请求）
  useEffect(() => {
    if (!initializedRef.current) return;
    loadAssets(1);
  }, [filters, sortBy, sortOrder, pageSize]);

  return {
    assets,
    loading,
    error,
    pagination: {
      page,
      total,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    filters,
    updateFilters,
    goToPage,
    refetch,
  };
}

/**
 * 素材分组列表数据加载 Hook
 *
 * @param {Object} options - 配置选项
 * @param {Object} options.initialFilters - 初始筛选条件
 * @param {number} options.pageSize - 每页数量（默认 10）
 *
 * @returns {Object} {
 *   groups: Array,
 *   loading: boolean,
 *   error: string | null,
 *   pagination: { page, total, pageSize, totalPages },
 *   filters: Object,
 *   updateFilters: (newFilters) => void,
 *   goToPage: (page) => void,
 *   refetch: () => Promise<void>
 * }
 */
export function useAssetGroupList(options = {}) {
  const { initialFilters = {}, pageSize = 10 } = options;
  const { listAssetGroups } = require('../../services/assetService');

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const initializedRef = useRef(false);

  const loadGroups = useCallback(
    async (currentPage = 1) => {
      setLoading(true);
      setError(null);

      try {
        const result = await listAssetGroups(filters, currentPage, pageSize);

        if (result.success) {
          setGroups(result.data.groups || []);
          setTotal(result.data.total || 0);
          setPage(currentPage);
        } else {
          setError(result.message || '加载分组列表失败');
          showError(result.message || '加载分组列表失败');
        }
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.message || '加载失败';
        setError(errorMsg);
        showError(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [filters, pageSize],
  );

  useEffect(() => {
    loadGroups(1);
    initializedRef.current = true;
  }, []);

  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const goToPage = useCallback(
    (nextPage) => {
      if (nextPage >= 1 && nextPage <= Math.ceil(total / pageSize)) {
        loadGroups(nextPage);
      }
    },
    [loadGroups, total, pageSize],
  );

  const refetch = useCallback(async () => {
    await loadGroups(page);
  }, [loadGroups, page]);

  useEffect(() => {
    if (!initializedRef.current) return;
    loadGroups(1);
  }, [filters, pageSize]);

  return {
    groups,
    loading,
    error,
    pagination: {
      page,
      total,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    filters,
    updateFilters,
    goToPage,
    refetch,
  };
}
