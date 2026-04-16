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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API, isAdmin, showError } from '../../helpers';
import {
  MAX_COMPARE_KEYS,
  GRANULARITY_OPTIONS,
} from '../../constants/key-cost.constants';
import { getDefaultDateRange } from '../../helpers/key-cost';

/**
 * Data-fetching hook for the multi-Key comparison view.
 *
 * Fetches its own token list and all token summaries (no token_id filter)
 * then groups them client-side by token_id for comparison charts.
 */
export const useKeyCompareData = () => {
  const { t } = useTranslation();
  const isAdminUser = isAdmin();
  const initialized = useRef(false);

  // ========== Token list ==========
  const [tokens, setTokens] = useState([]);

  // ========== Selected keys for comparison ==========
  const [selectedTokenIds, setSelectedTokenIds] = useState([]);

  // ========== Granularity & date range ==========
  const [granularity, setGranularity] = useState('day');
  const granularityOptions = useMemo(
    () =>
      GRANULARITY_OPTIONS.map((opt) => ({
        ...opt,
        label: t(opt.label),
      })),
    [t],
  );

  const [dateRange, setDateRange] = useState(getDefaultDateRange);

  // ========== Raw data & grouped ==========
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);

  // compareData is derived from rawData + selectedTokenIds — no need for separate state
  const compareData = useMemo(() => {
    if (selectedTokenIds.length === 0) return new Map();

    const idSet = new Set(selectedTokenIds);
    const grouped = new Map();

    for (const item of rawData) {
      const id = item.token_id;
      if (!idSet.has(id)) continue;
      if (!grouped.has(id)) {
        grouped.set(id, []);
      }
      grouped.get(id).push(item);
    }

    return grouped;
  }, [rawData, selectedTokenIds]);

  // ========== Fetch tokens ==========
  const fetchTokens = useCallback(async () => {
    try {
      const res = await API.get('/api/token/', {
        params: { p: 1, size: 100 },
      });
      const { success, message, data } = res.data;
      if (success) {
        setTokens(Array.isArray(data) ? data : (data?.items || []));
      } else {
        showError(message);
      }
    } catch (err) {
      console.error('Failed to fetch tokens', err);
    }
  }, []);

  // ========== Fetch all token summaries ==========
  const fetchAllSummaries = useCallback(async () => {
    setLoading(true);
    try {
      const [start, end] = dateRange;
      const startTs = Math.floor(start.getTime() / 1000);
      const endTs = Math.floor(end.getTime() / 1000);

      const basePath = isAdminUser
        ? '/api/log/token/summary'
        : '/api/log/self/token/summary';

      const params = {
        start_timestamp: startTs,
        end_timestamp: endTs,
        granularity,
      };

      const res = await API.get(basePath, { params });
      const { success, message, data } = res.data;
      if (success) {
        setRawData(data || []);
      } else {
        showError(message);
      }
    } catch (err) {
      console.error('Failed to fetch compare summaries', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, granularity, isAdminUser]);

  // ========== Guard: max compare keys ==========
  const handleSetSelectedTokenIds = useCallback((ids) => {
    if (Array.isArray(ids) && ids.length > MAX_COMPARE_KEYS) {
      ids = ids.slice(0, MAX_COMPARE_KEYS);
    }
    setSelectedTokenIds(ids || []);
  }, []);

  // ========== Initial fetch ==========
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      fetchTokens();
      fetchAllSummaries();
    }
  }, [fetchTokens, fetchAllSummaries]);

  // Re-fetch on filter changes
  const filtersChanged = useRef(false);
  useEffect(() => {
    if (filtersChanged.current) {
      fetchAllSummaries();
    } else {
      filtersChanged.current = true;
    }
  }, [granularity, dateRange]);

  return {
    // Token list
    tokens,

    // Selection
    selectedTokenIds,
    setSelectedTokenIds: handleSetSelectedTokenIds,

    // Filters
    granularity,
    setGranularity,
    granularityOptions,
    dateRange,
    setDateRange,

    // Data
    compareData,
    rawData,
    loading,
    refresh: fetchAllSummaries,

    // Misc
    t,
  };
};
