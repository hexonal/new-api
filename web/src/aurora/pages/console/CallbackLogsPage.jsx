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

import React from 'react';
import { copy, showError, showSuccess } from '../../../helpers';
import { useCallbackLogsData } from '../../../hooks/callback-logs/useCallbackLogsData';
import CallbackLogAttemptsDialog from './callback-logs/CallbackLogAttemptsDialog';
import CallbackLogFilters from './callback-logs/CallbackLogFilters';
import CallbackLogPageHeader from './callback-logs/CallbackLogPageHeader';
import CallbackLogPagination from './callback-logs/CallbackLogPagination';
import CallbackLogStats from './callback-logs/CallbackLogStats';
import CallbackLogTable from './callback-logs/CallbackLogTable';
import {
  buildCallbackStats,
  buildPaginationItems,
  exportCallbackEvents,
} from './callback-logs/callback-log-utils';

export default function CallbackLogsPage() {
  const data = useCallbackLogsData();
  const totalPages = Math.max(
    1,
    Math.ceil(
      Number(data.eventCount || 0) / Math.max(1, Number(data.pageSize || 1)),
    ),
  );
  const stats = React.useMemo(
    () => buildCallbackStats(data.events),
    [data.events],
  );
  const paginationItems = React.useMemo(
    () => buildPaginationItems(data.activePage, totalPages),
    [data.activePage, totalPages],
  );

  const handleCopy = React.useCallback(
    async (text) => {
      const content = String(text || '').trim();
      if (!content) {
        return;
      }
      if (await copy(content)) {
        showSuccess(`${data.t('已复制：')}${content}`);
        return;
      }
      showError(data.t('无法复制到剪贴板，请手动复制'));
    },
    [data, data.t],
  );

  const handleSearch = React.useCallback(() => {
    data.loadEvents(1, data.pageSize);
  }, [data]);

  const handleReset = React.useCallback(() => {
    data.setFilters(data.DEFAULT_FILTERS);
    window.setTimeout(() => {
      data.loadEvents(1, data.pageSize);
    }, 0);
  }, [data]);

  const handleExport = React.useCallback(() => {
    exportCallbackEvents(data.events);
  }, [data.events]);

  return (
    <div className='space-y-6'>
      <CallbackLogPageHeader
        loading={data.loading}
        onExport={handleExport}
        onRefresh={data.refresh}
        t={data.t}
      />

      <CallbackLogFilters
        filters={data.filters}
        setFilters={data.setFilters}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={data.loading}
        t={data.t}
      />

      <CallbackLogTable
        events={data.events || []}
        loading={data.loading}
        onCopy={handleCopy}
        onRetry={data.retryEvent}
        onOpenAttempts={data.openAttemptsDialog}
        t={data.t}
      />

      <CallbackLogPagination
        activePage={data.activePage}
        eventCount={data.eventCount}
        loading={data.loading}
        onPageChange={data.handlePageChange}
        pageSize={data.pageSize}
        paginationItems={paginationItems}
        t={data.t}
        totalPages={totalPages}
      />

      <CallbackLogStats stats={stats} t={data.t} />

      <CallbackLogAttemptsDialog
        open={data.showAttemptsDialog}
        onOpenChange={data.closeAttemptsDialog}
        event={data.selectedEvent}
        attempts={data.attempts}
        attemptsLoading={data.attemptsLoading}
        t={data.t}
      />
    </div>
  );
}
