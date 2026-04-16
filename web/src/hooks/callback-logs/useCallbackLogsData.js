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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, showWarning } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';

const DEFAULT_FILTERS = {
  status: '',
  source: '',
  request_id: '',
  username: '',
};

/**
 * 判断当前事件是否应禁止手动重试。
 * @param {Record<string, unknown> | null | undefined} event - 回调事件。
 * @returns {boolean}
 */
function isRetryBlocked(event) {
  if (!event) {
    return false;
  }

  const status = String(event.status || '').trim();
  if (status === 'succeeded' || status === 'cancelled') {
    return true;
  }

  const httpStatus = Number(event.last_http_status);
  return Number.isFinite(httpStatus) && httpStatus >= 200 && httpStatus < 300;
}

export const useCallbackLogsData = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [eventCount, setEventCount] = useState(0);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showAttemptsDialog, setShowAttemptsDialog] = useState(false);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

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

  const buildQueryParams = (page, size) => {
    const params = {
      p: page,
      page_size: size,
    };

    Object.entries(filters).forEach(([key, value]) => {
      const normalizedValue = String(value || '').trim();
      if (normalizedValue) {
        params[key] = normalizedValue;
      }
    });

    return params;
  };

  const loadEvents = async (page = 1, size = pageSize) => {
    setLoading(true);
    try {
      const params = buildQueryParams(page, size);
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

  const retryEvent = async (eventOrId) => {
    const event = eventOrId && typeof eventOrId === 'object' ? eventOrId : null;
    const eventId = event?.id || eventOrId;
    if (!eventId) {
      return;
    }
    if (isRetryBlocked(event)) {
      showWarning(t('HTTP 200-299 的成功回调禁止重试'));
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

  const openAttemptsDialog = async (event) => {
    setSelectedEvent(event || null);
    setAttempts([]);
    setShowAttemptsDialog(true);
    setAttemptsLoading(true);

    try {
      const res = await API.get(`/api/callback/events/${event.id}/attempts`);
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('获取重试明细失败'));
        return;
      }

      const items = Array.isArray(data) ? data : [];
      setAttempts(
        items.map((item) => ({
          ...item,
          key: `${item.id}`,
        })),
      );
    } catch (error) {
      if (error?.response?.status === 404) {
        showWarning(t('重试明细暂不可用，服务可能刚更新，请稍后重试'));
        return;
      }
      showError(error?.message || t('获取重试明细失败'));
    } finally {
      setAttemptsLoading(false);
    }
  };

  const closeAttemptsDialog = () => {
    setShowAttemptsDialog(false);
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
    showAttemptsDialog,
    attemptsLoading,
    attempts,
    selectedEvent,
    openAttemptsDialog,
    closeAttemptsDialog,
    DEFAULT_FILTERS,
    t,
  };
};
