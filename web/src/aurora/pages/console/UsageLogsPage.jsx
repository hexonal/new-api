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
import { useTranslation } from 'react-i18next';
import { IconChevronDown } from '@douyinfe/semi-icons';
import { copy, getLogOther, renderNumber, renderQuota, showError, showSuccess } from '../../../helpers';
import { useLogsData as useUsageLogsData } from '../../../hooks/usage-logs/useUsageLogsData';
import UserInfoModal from '../../../components/table/usage-logs/modals/UserInfoModal';
import ChannelAffinityUsageCacheModal from '../../../components/table/usage-logs/modals/ChannelAffinityUsageCacheModal';
import UsageLogRow from './usage-logs/UsageLogRow';
import UsageLogsColumnSelector from './usage-logs/UsageLogsColumnSelector';
import UsageLogsFilters from './usage-logs/UsageLogsFilters';
import { buildUsageLogColumns } from './usage-logs/usage-log-columns';
import {
  buildInitialFilters,
  buildPaginationItems,
  escapeCsvCell,
  formatRelativeTime,
  PAGE_SIZE_OPTIONS,
  resolveStatusMeta,
  toQueryDateTimeValue,
} from './usage-logs/page-utils';

export default function UsageLogsPage() {
  const { t } = useTranslation();
  const data = useUsageLogsData();
  const initialFiltersRef = React.useRef(null);
  const filtersRef = React.useRef(null);
  const setFormApiRef = React.useRef(data.setFormApi);
  const refreshRef = React.useRef(data.refresh);

  if (!initialFiltersRef.current) {
    initialFiltersRef.current = buildInitialFilters(data.formInitValues);
  }

  const [expandedRows, setExpandedRows] = React.useState({});
  const [filters, setFilters] = React.useState(initialFiltersRef.current);

  filtersRef.current = filters;

  React.useEffect(() => {
    setFormApiRef.current = data.setFormApi;
    refreshRef.current = data.refresh;
  }, [data.refresh, data.setFormApi]);

  React.useEffect(() => {
    setFormApiRef.current({
      getValues: () => {
        const currentFilters = filtersRef.current;
        const dateRange =
          currentFilters?.from && currentFilters?.to
            ? [
                toQueryDateTimeValue(currentFilters.from),
                toQueryDateTimeValue(currentFilters.to),
              ]
            : undefined;

        return {
          username: currentFilters?.username || '',
          token_name: currentFilters?.token_name || '',
          group: currentFilters?.group || '',
          pricing_group: currentFilters?.pricing_group || '',
          request_id: currentFilters?.request_id || '',
          model_name: currentFilters?.model_name || '',
          channel: currentFilters?.channel || '',
          logType: currentFilters?.logType || '0',
          dateRange,
        };
      },
    });
  }, []);

  const updateFilter = React.useCallback((field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleSearch = React.useCallback(() => {
    refreshRef.current();
  }, []);

  const handleReset = React.useCallback(() => {
    const nextFilters = { ...initialFiltersRef.current };
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    data.setLogType(0);
    window.setTimeout(() => {
      refreshRef.current();
    }, 0);
  }, [data]);

  const handleLogTypeChange = React.useCallback(
    (value) => {
      updateFilter('logType', value);
      data.setLogType(Number.parseInt(value, 10) || 0);
      window.setTimeout(() => {
        refreshRef.current();
      }, 0);
    },
    [data, updateFilter],
  );

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

  const handleExport = React.useCallback(() => {
    const rows = data.logs || [];
    const csvRows = [
      [
        'Time',
        'Model',
        'User',
        'Tokens',
        'Cost',
        'Latency',
        'Status',
        'Request ID',
      ],
      ...rows.map((log) => {
        const other = getLogOther(log?.other);
        const requestId =
          log?.request_id || other?.request_id || other?.task_id || '-';
        const statusMeta = resolveStatusMeta(log);
        const latencyText = String(log?.use_time || '').trim();

        return [
          formatRelativeTime(log?.created_at),
          log?.model_name || '-',
          log?.username || '-',
          `${renderNumber(log?.prompt_tokens || 0)} / ${renderNumber(log?.completion_tokens || 0)}`,
          renderQuota(log?.quota || 0, 6),
          latencyText ? `${latencyText}s` : '-',
          statusMeta.label,
          requestId,
        ];
      }),
    ];

    const csvText = csvRows
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csvText}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
    link.href = url;
    link.setAttribute('download', `usage-logs-${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data.logs]);

  const handleCopy = React.useCallback(
    async (text) => {
      const content = String(text || '').trim();
      if (!content) {
        return;
      }

      if (await copy(content)) {
        showSuccess(`${t('已复制：')}${content}`);
        return;
      }
      showError(t('无法复制到剪贴板，请手动复制'));
    },
    [t],
  );

  const allColumns = React.useMemo(
    () => buildUsageLogColumns({ data, t }),
    [
      data.COLUMN_KEYS,
      data.copyText,
      data.expandData,
      data.isAdminUser,
      data.openChannelAffinityUsageCacheModal,
      data.showUserInfoFunc,
      t,
    ],
  );

  const visibleColumns = React.useMemo(
    () =>
      allColumns.filter((column) => data.visibleColumns?.[column.key] !== false),
    [allColumns, data.visibleColumns],
  );

  const selectableColumns = React.useMemo(() => {
    return allColumns.filter((column) => {
      if (data.isAdminUser) {
        return true;
      }
      return ![
        data.COLUMN_KEYS.CHANNEL,
        data.COLUMN_KEYS.CHANNEL_ID,
        data.COLUMN_KEYS.USERNAME,
        data.COLUMN_KEYS.RETRY,
        data.COLUMN_KEYS.GROUP,
        data.COLUMN_KEYS.PRICING_GROUP,
      ].includes(column.key);
    });
  }, [allColumns, data.COLUMN_KEYS, data.isAdminUser]);

  const allSelectableChecked = React.useMemo(
    () =>
      selectableColumns.length > 0 &&
      selectableColumns.every((column) => data.visibleColumns?.[column.key]),
    [data.visibleColumns, selectableColumns],
  );

  const someSelectableChecked = React.useMemo(
    () =>
      selectableColumns.some((column) => data.visibleColumns?.[column.key]) &&
      !allSelectableChecked,
    [allSelectableChecked, data.visibleColumns, selectableColumns],
  );

  const tableMinWidth = React.useMemo(() => {
    const baseWidth = visibleColumns.reduce((sum, column) => {
      if (column.key === data.COLUMN_KEYS.DETAILS) {
        return sum + 280;
      }
      if (column.key === data.COLUMN_KEYS.MODEL) {
        return sum + 180;
      }
      if (
        column.key === data.COLUMN_KEYS.CHANNEL ||
        column.key === data.COLUMN_KEYS.RETRY
      ) {
        return sum + 160;
      }
      return sum + 120;
    }, 140);

    return Math.max(baseWidth, 980);
  }, [data.COLUMN_KEYS, visibleColumns]);

  const detailColSpan = visibleColumns.length + 2;

  return (
    <>
      <UserInfoModal {...data} />
      <ChannelAffinityUsageCacheModal {...data} />
      <UsageLogsColumnSelector
        open={data.showColumnSelector}
        t={t}
        allSelectableChecked={allSelectableChecked}
        someSelectableChecked={someSelectableChecked}
        visibleColumnCount={visibleColumns.length}
        selectableColumns={selectableColumns}
        visibleColumns={data.visibleColumns}
        onSelectAll={data.handleSelectAll}
        onToggleColumn={data.handleColumnVisibilityChange}
        onReset={data.initDefaultColumns}
        onClose={() => data.setShowColumnSelector(false)}
      />

      <div className='flex min-h-full w-full min-w-0 flex-1 flex-col gap-6'>
        <header>
          <h1 className='text-3xl font-bold text-on-surface'>Usage Logs</h1>
          <p className='mt-1 text-on-surface-variant'>
            Monitor API request history and token usage across your organization.
          </p>
        </header>

        <UsageLogsFilters
          t={t}
          data={data}
          filters={filters}
          updateFilter={updateFilter}
          handleLogTypeChange={handleLogTypeChange}
          handleSearch={handleSearch}
          handleReset={handleReset}
          handleExport={handleExport}
        />

        <section className='flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm'>
          <div className='overflow-x-auto'>
            <table
              className='w-full border-collapse text-left'
              style={{ minWidth: `${tableMinWidth}px` }}
            >
              <thead>
                <tr className='border-b border-outline-variant bg-surface-container-low text-[11px] font-bold uppercase tracking-wider text-on-surface-variant'>
                  <th className='w-10 px-6 py-3'></th>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-4 py-3 ${
                        column.key === data.COLUMN_KEYS.DETAILS
                          ? 'min-w-[280px]'
                          : ''
                      }`}
                    >
                      {column.title}
                    </th>
                  ))}
                  <th className='px-4 py-3 text-right'>{t('操作')}</th>
                </tr>
              </thead>
              <tbody className='text-sm text-on-surface'>
                {(data.logs || []).map((log, rowIndex) => {
                  const expanded = Boolean(expandedRows[log.key]);
                  return (
                    <UsageLogRow
                      key={log.key}
                      log={log}
                      rowIndex={rowIndex}
                      expanded={expanded}
                      visibleColumns={visibleColumns}
                      detailColSpan={detailColSpan}
                      data={data}
                      t={t}
                      onToggle={() =>
                        setExpandedRows((prev) => ({
                          ...prev,
                          [log.key]: !prev[log.key],
                        }))
                      }
                      handleCopy={handleCopy}
                    />
                  );
                })}

                {!data.loading && (data.logs || []).length === 0 && (
                  <tr>
                    <td
                      className='px-4 py-10 text-center text-sm text-on-surface-variant'
                      colSpan={detailColSpan}
                    >
                      {t('暂无数据')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className='flex flex-col items-center justify-between gap-4 sm:flex-row'>
          <div className='flex items-center gap-2 text-sm text-on-surface-variant'>
            <span>Show</span>
            <select
              className='rounded-lg border border-outline-variant bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
              value={String(data.pageSize)}
              onChange={(event) =>
                data.handlePageSizeChange(Number(event.target.value))
              }
              disabled={data.loading}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
            <span>of {data.logCount || 0} logs</span>
          </div>

          <div className='flex items-center gap-1'>
            <button
              type='button'
              className='rounded-lg border border-outline-variant p-2 transition-colors hover:bg-surface-container disabled:opacity-50'
              onClick={() =>
                data.handlePageChange(Math.max(1, data.activePage - 1))
              }
              disabled={data.loading || data.activePage <= 1}
            >
              <IconChevronDown className='rotate-90' size='small' />
            </button>

            {paginationItems.map((item, index) => {
              if (item === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className='px-2 text-on-surface-variant'
                  >
                    ...
                  </span>
                );
              }

              const page = Number(item);
              const active = page === data.activePage;
              return (
                <button
                  key={`page-${page}`}
                  type='button'
                  className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary font-bold text-white'
                      : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container'
                  }`}
                  disabled={data.loading}
                  onClick={() => data.handlePageChange(page)}
                >
                  {page}
                </button>
              );
            })}

            <button
              type='button'
              className='rounded-lg border border-outline-variant p-2 transition-colors hover:bg-surface-container disabled:opacity-50'
              onClick={() =>
                data.handlePageChange(Math.min(totalPages, data.activePage + 1))
              }
              disabled={data.loading || data.activePage >= totalPages}
            >
              <IconChevronDown className='-rotate-90' size='small' />
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
