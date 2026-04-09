/*
Copyright (C) 2025 QuantumNous
*/

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, showWarning } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';

export const useCallbackLogsData = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [eventCount, setEventCount] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    source: '',
  });

  const syncPageData = (payload, page, size) => {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    setEvents(
      items.map((item) => ({
        ...item,
        key: `${item.id}`,
      })),
    );
    setEventCount(payload?.total || 0);
    setActivePage(payload?.page || page);
    setPageSize(payload?.page_size || size);
  };

  const loadEvents = async (page = 1, size = pageSize) => {
    setLoading(true);
    try {
      const params = {
        p: page,
        page_size: size,
      };
      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.source) {
        params.source = filters.source;
      }
      const res = await API.get('/api/callback/events', { params });
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('获取回调日志失败'));
        return;
      }
      syncPageData(data, page, size);
    } catch (error) {
      showError(error?.message || t('获取回调日志失败'));
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    loadEvents(page, pageSize).then();
  };

  const handlePageSizeChange = (size) => {
    localStorage.setItem('callback-events-page-size', `${size}`);
    loadEvents(1, size).then();
  };

  const refresh = async () => {
    await loadEvents(activePage, pageSize);
  };

  const retryEvent = async (eventId) => {
    if (!eventId) {
      return;
    }
    try {
      const res = await API.post(`/api/callback/events/${eventId}/retry`);
      const { success, message } = res.data;
      if (!success) {
        showError(message || t('重试触发失败'));
        return;
      }
      showSuccess(t('已触发重试'));
      await refresh();
    } catch (error) {
      if (error?.response?.status === 404) {
        showWarning(t('当前服务版本暂不支持手动重试'));
        return;
      }
      showError(error?.message || t('重试触发失败'));
    }
  };

  useEffect(() => {
    const localPageSize = parseInt(
      localStorage.getItem('callback-events-page-size') || '',
      10,
    );
    const initialPageSize =
      Number.isInteger(localPageSize) && localPageSize > 0
        ? localPageSize
        : ITEMS_PER_PAGE;
    setPageSize(initialPageSize);
    loadEvents(1, initialPageSize).then();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    events,
    loading,
    activePage,
    pageSize,
    eventCount,
    filters,
    setFilters,
    loadEvents,
    handlePageChange,
    handlePageSizeChange,
    refresh,
    retryEvent,
    t,
  };
};
