import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API, isAdmin, showError } from '../../helpers';
import { GRANULARITY_OPTIONS, METRIC_COST } from '../../constants/key-cost.constants';
import { getDefaultDateRange } from '../../helpers/key-cost';

/**
 * Primary data-fetching hook for the Key Cost Analysis dashboard.
 *
 * Follows the same initialisation-guard pattern as useDashboardData
 * (useRef to prevent StrictMode double-fetch).
 */
export const useKeyCostData = () => {
  const { t } = useTranslation();
  const initialized = useRef(false);
  const isAdminUser = isAdmin();

  // ========== Token list ==========
  const [tokens, setTokens] = useState([]);
  const [selectedTokenId, setSelectedTokenId] = useState(null); // null = all

  // ========== Granularity ==========
  const [granularity, setGranularity] = useState('day');
  const granularityOptions = useMemo(
    () =>
      GRANULARITY_OPTIONS.map((opt) => ({
        ...opt,
        label: t(opt.label),
      })),
    [t],
  );

  // ========== Date range ==========
  const [dateRange, setDateRange] = useState(getDefaultDateRange);

  // ========== Data ==========
  const [summaryData, setSummaryData] = useState([]);
  const [loading, setLoading] = useState(false);

  // ========== Chart tab ==========
  const [activeChartTab, setActiveChartTab] = useState(METRIC_COST);

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

  // ========== Fetch summary data ==========
  const fetchSummary = useCallback(async () => {
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

      if (selectedTokenId !== null && selectedTokenId !== undefined) {
        params.token_id = selectedTokenId;
      }

      const res = await API.get(basePath, { params });
      const { success, message, data } = res.data;
      if (success) {
        setSummaryData(data || []);
      } else {
        showError(message);
      }
    } catch (err) {
      console.error('Failed to fetch token summary', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, granularity, selectedTokenId, isAdminUser]);

  // ========== Initial load ==========
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      fetchTokens();
      fetchSummary();
    }
  }, [fetchTokens, fetchSummary]);

  // Re-fetch when filters change (skip first render which is handled above)
  const filtersChanged = useRef(false);
  useEffect(() => {
    if (filtersChanged.current) {
      fetchSummary();
    } else {
      filtersChanged.current = true;
    }
  }, [granularity, selectedTokenId, dateRange]);

  return {
    // Token list
    tokens,
    selectedTokenId,
    setSelectedTokenId,

    // Granularity
    granularity,
    setGranularity,
    granularityOptions,

    // Date range
    dateRange,
    setDateRange,

    // Data
    summaryData,
    loading,
    refresh: fetchSummary,

    // Chart tab
    activeChartTab,
    setActiveChartTab,

    // Flags
    isAdminUser,

    // i18n
    t,
  };
};
