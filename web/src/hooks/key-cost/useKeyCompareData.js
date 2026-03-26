import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { API, isAdmin, showError } from '../../helpers';
import { MAX_COMPARE_KEYS } from '../../constants/key-cost.constants';

/**
 * Data-fetching hook for the multi-Key comparison view.
 *
 * Fetches all token summaries (no token_id filter) then groups them
 * client-side by token_id for comparison charts.
 */
export const useKeyCompareData = () => {
  const { t } = useTranslation();
  const isAdminUser = isAdmin();
  const initialized = useRef(false);

  // ========== Selected keys for comparison ==========
  const [selectedTokenIds, setSelectedTokenIds] = useState([]);

  // ========== Granularity & date range ==========
  const [granularity, setGranularity] = useState('day');

  const getDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return [start, end];
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange);

  // ========== Raw data & grouped ==========
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * compareData: Map<token_id, Array<TokenSummary>>
   * Built from rawData filtered to selectedTokenIds.
   */
  const [compareData, setCompareData] = useState(new Map());

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

  // ========== Group raw data by selected token ids ==========
  useEffect(() => {
    if (selectedTokenIds.length === 0) {
      setCompareData(new Map());
      return;
    }

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

    setCompareData(grouped);
  }, [rawData, selectedTokenIds]);

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
      fetchAllSummaries();
    }
  }, [fetchAllSummaries]);

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
    // Selection
    selectedTokenIds,
    setSelectedTokenIds: handleSetSelectedTokenIds,

    // Filters
    granularity,
    setGranularity,
    dateRange,
    setDateRange,

    // Data
    compareData,
    rawData,
    loading,

    // Misc
    t,
  };
};
