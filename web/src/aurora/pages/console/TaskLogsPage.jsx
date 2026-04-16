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
import { useTaskLogsData } from '../../../hooks/task-logs/useTaskLogsData';
import TaskLogColumnSelectorDialog from './task-logs/TaskLogColumnSelectorDialog';
import TaskLogPagination from './task-logs/TaskLogPagination';
import TaskLogQuickLookDialog from './task-logs/TaskLogQuickLookDialog';
import TaskLogsFilters from './task-logs/TaskLogsFilters';
import TaskLogsPageHeader from './task-logs/TaskLogsPageHeader';
import TaskLogsTable from './task-logs/TaskLogsTable';
import {
  buildPaginationItems,
  buildTaskLogDefaultFilters,
  getTaskListDetailAction,
  toTaskLogApiDateTime,
} from './task-logs/task-log-utils';

export default function TaskLogsPage() {
  const data = useTaskLogsData();
  const initialFiltersRef = React.useRef(buildTaskLogDefaultFilters());
  const [filters, setFilters] = React.useState(initialFiltersRef.current);
  const [quickLook, setQuickLook] = React.useState(null);
  const filtersRef = React.useRef(filters);

  filtersRef.current = filters;

  React.useEffect(() => {
    data.setFormApi({
      getValues: () => ({
        channel_id: filtersRef.current.channel_id,
        task_id: filtersRef.current.task_id,
        dateRange: [
          toTaskLogApiDateTime(filtersRef.current.from),
          toTaskLogApiDateTime(filtersRef.current.to),
        ],
      }),
    });
  }, [data.setFormApi]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      Number(data.logCount || 0) / Math.max(1, Number(data.pageSize || 1)),
    ),
  );
  const paginationItems = React.useMemo(
    () => buildPaginationItems(data.activePage, totalPages),
    [data.activePage, totalPages],
  );

  const handleSearch = React.useCallback(() => {
    data.loadLogs(1, data.pageSize);
  }, [data]);

  const handleReset = React.useCallback(() => {
    const nextFilters = buildTaskLogDefaultFilters();
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    window.setTimeout(() => {
      data.loadLogs(1, data.pageSize);
    }, 0);
  }, [data]);

  const handleTaskIdClick = React.useCallback(
    (log) => {
      setQuickLook({
        kind: 'content',
        title: data.t('任务记录'),
        value: log,
      });
    },
    [data.t],
  );

  const handleDetailAction = React.useCallback(
    (log) => {
      const action = getTaskListDetailAction(log);

      if (action.type === 'image' && action.payload) {
        window.open(action.payload, '_blank', 'noopener,noreferrer');
        return;
      }

      if (action.type === 'video') {
        setQuickLook({
          kind: 'video',
          title: data.t('视频预览'),
          value: action.payload,
        });
        return;
      }

      if (action.type === 'audio') {
        setQuickLook({
          kind: 'audio',
          title: data.t('音乐预览'),
          value: action.payload,
        });
        return;
      }

      if (action.type === 'text') {
        setQuickLook({
          kind: 'content',
          title: data.t('详情内容'),
          value: action.payload,
        });
      }
    },
    [data.t],
  );

  const handleCopy = React.useCallback(
    (text) => {
      data.copyText(text);
    },
    [data],
  );

  return (
    <div className='space-y-6'>
      <TaskLogsPageHeader t={data.t} />

      <TaskLogsFilters
        filters={filters}
        setFilters={setFilters}
        isAdminUser={data.isAdminUser}
        loading={data.loading}
        onSearch={handleSearch}
        onRefresh={data.refresh}
        onReset={handleReset}
        onOpenColumns={() => data.setShowColumnSelector(true)}
        t={data.t}
      />

      <TaskLogsTable
        logs={data.logs || []}
        loading={data.loading}
        visibleColumns={data.visibleColumns}
        isAdminUser={data.isAdminUser}
        onTaskIdClick={handleTaskIdClick}
        onDetailAction={handleDetailAction}
        onCopy={handleCopy}
        t={data.t}
      />

      <TaskLogPagination
        activePage={data.activePage}
        loading={data.loading}
        logCount={data.logCount}
        onPageChange={data.handlePageChange}
        pageSize={data.pageSize}
        paginationItems={paginationItems}
        t={data.t}
        totalPages={totalPages}
      />

      <TaskLogColumnSelectorDialog
        open={data.showColumnSelector}
        onOpenChange={data.setShowColumnSelector}
        visibleColumns={data.visibleColumns}
        handleColumnVisibilityChange={data.handleColumnVisibilityChange}
        handleSelectAll={data.handleSelectAll}
        initDefaultColumns={data.initDefaultColumns}
        isAdminUser={data.isAdminUser}
        t={data.t}
      />

      <TaskLogQuickLookDialog
        open={Boolean(quickLook)}
        onOpenChange={(open) => {
          if (!open) {
            setQuickLook(null);
          }
        }}
        quickLook={quickLook}
        onCopy={handleCopy}
        t={data.t}
      />
    </div>
  );
}
