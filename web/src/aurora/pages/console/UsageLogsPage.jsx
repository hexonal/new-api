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
import { useLogsData as useUsageLogsData } from '../../../hooks/usage-logs/useUsageLogsData';
import { timestamp2string, renderQuota, renderNumber } from '../../../helpers';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';

const LOG_TYPE_OPTIONS = [
  { value: '0', label: '全部' },
  { value: '1', label: '充值' },
  { value: '2', label: '消费' },
  { value: '3', label: '管理' },
  { value: '4', label: '系统' },
  { value: '5', label: '错误' },
  { value: '6', label: '退款' },
];

const LOG_STATUS_VARIANT = {
  1: 'secondary',
  2: 'secondary',
  3: 'outline',
  4: 'outline',
  5: 'destructive',
  6: 'destructive',
};

const escapeCsvCell = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const normalized = String(value).replaceAll('"', '""');
  return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
};

export default function UsageLogsPage() {
  const { t } = useTranslation();
  const data = useUsageLogsData();
  const [expandedRows, setExpandedRows] = React.useState({});
  const [filters, setFilters] = React.useState({
    from: '',
    to: '',
    model_name: '',
    username: '',
    channel: '',
    logType: '0',
  });
  const [pageInput, setPageInput] = React.useState('1');

  React.useEffect(() => {
    data.setFormApi({
      getValues: () => {
        const dateRange =
          filters.from && filters.to
            ? [`${filters.from} 00:00:00`, `${filters.to} 23:59:59`]
            : undefined;
        return {
          model_name: filters.model_name,
          username: filters.username,
          channel: filters.channel,
          logType: filters.logType,
          dateRange,
        };
      },
    });
  }, [
    data.setFormApi,
    filters.channel,
    filters.from,
    filters.logType,
    filters.model_name,
    filters.to,
    filters.username,
  ]);

  React.useEffect(() => {
    setPageInput(String(data.activePage || 1));
  }, [data.activePage]);

  const channelOptions = React.useMemo(() => {
    const map = new Map();
    for (const log of data.logs || []) {
      const channelId = log.channel === null || log.channel === undefined ? '' : String(log.channel);
      if (!channelId) {
        continue;
      }
      const channelName = String(log.channel_name || '').trim();
      const label = channelName ? `${channelName} (${channelId})` : channelId;
      map.set(channelId, label);
    }
    if (filters.channel && !map.has(filters.channel)) {
      map.set(filters.channel, filters.channel);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [data.logs, filters.channel]);

  const handleExport = React.useCallback(() => {
    const rows = data.logs || [];
    const csvRows = [
      ['时间', '模型', '用户', '渠道', '状态', '用量', '费用'],
      ...rows.map((log) => {
        const timeText =
          log.timestamp2string ||
          (log.created_at ? timestamp2string(log.created_at) : '-');
        const channelText = log.channel_name || log.channel || '-';
        const statusOption = LOG_TYPE_OPTIONS.find(
          (item) => Number(item.value) === Number(log.type),
        );
        return [
          timeText,
          log.model_name || '-',
          log.username || '-',
          channelText,
          statusOption ? t(statusOption.label) : t('未知'),
          `${renderNumber(log.prompt_tokens || 0)} / ${renderNumber(log.completion_tokens || 0)}`,
          renderQuota(log.quota || 0, 6),
        ];
      }),
    ];
    const csvText = csvRows
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
    link.href = url;
    link.setAttribute('download', `usage-logs-${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data.logs, t]);

  const statusLabelByType = React.useCallback(
    (type) => {
      const option = LOG_TYPE_OPTIONS.find((item) => Number(item.value) === Number(type));
      return option ? t(option.label) : t('未知');
    },
    [t],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(Number(data.logCount || 0) / Math.max(1, Number(data.pageSize || 1))),
  );

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border border-border bg-card/70 p-3'>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6'>
          <Input
            type='date'
            value={filters.from}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, from: event.target.value }))
            }
          />
          <Input
            type='date'
            value={filters.to}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, to: event.target.value }))
            }
          />
          <Input
            placeholder={t('模型')}
            value={filters.model_name}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, model_name: event.target.value }))
            }
          />
          <Input
            placeholder={t('用户')}
            value={filters.username}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, username: event.target.value }))
            }
          />
          <select
            className='h-10 rounded-lg border border-input bg-background px-3 text-sm'
            value={filters.channel}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, channel: event.target.value }))
            }
          >
            <option value=''>{t('全部渠道')}</option>
            {channelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className='h-10 rounded-lg border border-input bg-background px-3 text-sm'
            value={filters.logType}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, logType: event.target.value }))
            }
          >
            {LOG_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </div>
        <div className='mt-3 flex flex-wrap items-center justify-end gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={() => data.refresh()}
            loading={data.loading}
          >
            {t('查询')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={handleExport}
            disabled={data.loading || (data.logs || []).length === 0}
          >
            {t('导出')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => data.loadLogs(data.activePage, data.pageSize)}
            loading={data.loading}
          >
            {t('刷新')}
          </Button>
        </div>
      </div>

      <div className='rounded-xl border border-border bg-card/70'>
        <Table>
          <Thead>
            <Tr>
              <Th>{t('时间')}</Th>
              <Th>{t('模型')}</Th>
              <Th>{t('用户')}</Th>
              <Th>{t('渠道')}</Th>
              <Th>{t('状态')}</Th>
              <Th>{t('用量')}</Th>
              <Th>{t('费用')}</Th>
              <Th>{t('操作')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(data.logs || []).map((log) => {
              const expanded = !!expandedRows[log.key];
              const details = data.expandData?.[log.key] || [];
              return (
                <React.Fragment key={log.key}>
                  <Tr>
                    <Td className='text-xs'>
                      {log.timestamp2string ||
                        (log.created_at ? timestamp2string(log.created_at) : '-')}
                    </Td>
                    <Td className='text-xs'>{log.model_name || '-'}</Td>
                    <Td className='text-xs'>{log.username || '-'}</Td>
                    <Td className='text-xs'>{log.channel_name || log.channel || '-'}</Td>
                    <Td>
                      <Badge
                        variant={LOG_STATUS_VARIANT[Number(log.type)] || 'outline'}
                      >
                        {statusLabelByType(log.type)}
                      </Badge>
                    </Td>
                    <Td className='text-xs'>
                      {renderNumber(log.prompt_tokens || 0)} /{' '}
                      {renderNumber(log.completion_tokens || 0)}
                    </Td>
                    <Td className='text-xs'>{renderQuota(log.quota || 0, 6)}</Td>
                    <Td>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() =>
                          setExpandedRows((prev) => ({
                            ...prev,
                            [log.key]: !prev[log.key],
                          }))
                        }
                      >
                        {expanded ? t('收起') : t('展开')}
                      </Button>
                    </Td>
                  </Tr>
                  {expanded && (
                    <Tr>
                      <Td colSpan={8}>
                        <div className='rounded-lg border border-border bg-muted/40 p-3 text-xs'>
                          {details.length === 0 ? (
                            <span className='text-muted-foreground'>{t('暂无详情')}</span>
                          ) : (
                            details.map((item, index) => (
                              <div key={`${log.key}-${index}`} className='mb-1 break-all'>
                                <span className='text-muted-foreground'>{item.key}:</span>{' '}
                                <span>{item.value ?? '-'}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </Td>
                    </Tr>
                  )}
                </React.Fragment>
              );
            })}
            {!data.loading && (data.logs || []).length === 0 && (
              <Tr>
                <Td colSpan={8} className='py-8 text-center text-muted-foreground'>
                  {t('暂无数据')}
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </div>

      <div className='flex items-center justify-between text-sm text-muted-foreground'>
        <span>
          {t('共')} {data.logCount || 0} {t('条')}
        </span>
        <div className='flex items-center gap-2'>
          <select
            className='h-8 rounded-lg border border-input bg-background px-2 text-xs'
            value={String(data.pageSize)}
            onChange={(event) => data.handlePageSizeChange(Number(event.target.value))}
            disabled={data.loading}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / {t('页')}
              </option>
            ))}
          </select>
          <Button
            size='sm'
            variant='outline'
            disabled={data.activePage <= 1 || data.loading}
            onClick={() => data.handlePageChange(data.activePage - 1)}
          >
            {t('上一页')}
          </Button>
          <span>
            {data.activePage} / {totalPages}
          </span>
          <div className='flex items-center gap-1'>
            <Input
              type='number'
              min='1'
              max={String(totalPages)}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              className='h-8 w-20'
            />
            <Button
              size='sm'
              variant='outline'
              disabled={data.loading}
              onClick={() => {
                const nextPage = Math.min(
                  totalPages,
                  Math.max(1, Number.parseInt(pageInput, 10) || 1),
                );
                data.handlePageChange(nextPage);
              }}
            >
              {t('跳转')}
            </Button>
          </div>
          <Button
            size='sm'
            variant='outline'
            disabled={data.activePage >= totalPages || data.loading}
            onClick={() => data.handlePageChange(data.activePage + 1)}
          >
            {t('下一页')}
          </Button>
        </div>
      </div>
    </div>
  );
}
