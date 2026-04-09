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
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Progress } from '../../primitives/progress';

export default function TaskLogsPage() {
  const data = useTaskLogsData();
  const [filters, setFilters] = React.useState({
    channel_id: '',
    task_id: '',
    from: '',
    to: '',
  });

  React.useEffect(() => {
    data.setFormApi({
      getValues: () => {
        const dateRange =
          filters.from && filters.to
            ? [`${filters.from} 00:00:00`, `${filters.to} 23:59:59`]
            : undefined;
        return {
          channel_id: filters.channel_id,
          task_id: filters.task_id,
          dateRange,
        };
      },
    });
  }, [
    data.setFormApi,
    filters.channel_id,
    filters.from,
    filters.task_id,
    filters.to,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(Number(data.logCount || 0) / Math.max(1, Number(data.pageSize || 1))),
  );

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border border-border bg-card/70 p-3'>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
          <Input
            placeholder={data.t('渠道 ID')}
            value={filters.channel_id}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, channel_id: event.target.value }))
            }
          />
          <Input
            placeholder={data.t('任务 ID')}
            value={filters.task_id}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, task_id: event.target.value }))
            }
          />
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
        </div>
        <div className='mt-3 flex items-center justify-end gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={() => data.loadLogs(1, data.pageSize)}
            loading={data.loading}
          >
            {data.t('查询')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => data.refresh()}
            loading={data.loading}
          >
            {data.t('刷新')}
          </Button>
        </div>
      </div>

      <div className='rounded-xl border border-border bg-card/70'>
        <Table>
          <Thead>
            <Tr>
              <Th>{data.t('提交时间')}</Th>
              <Th>{data.t('平台')}</Th>
              <Th>{data.t('类型')}</Th>
              <Th>{data.t('任务 ID')}</Th>
              <Th>{data.t('状态')}</Th>
              <Th>{data.t('进度')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(data.logs || []).map((log) => {
              const progress = Math.min(100, Math.max(0, Number(log.progress || 0)));
              return (
                <Tr key={log.key}>
                  <Td className='text-xs'>{log.timestamp2string || '-'}</Td>
                  <Td>
                    <Badge variant='secondary'>{log.platform || '-'}</Badge>
                  </Td>
                  <Td className='text-xs'>{log.type || '-'}</Td>
                  <Td className='font-mono text-xs'>{log.task_id || '-'}</Td>
                  <Td className='text-xs'>{log.task_status || log.status || '-'}</Td>
                  <Td className='w-48'>
                    <div className='space-y-1'>
                      <Progress value={progress} />
                      <div className='text-xs text-muted-foreground'>{progress}%</div>
                    </div>
                  </Td>
                </Tr>
              );
            })}
            {!data.loading && (data.logs || []).length === 0 && (
              <Tr>
                <Td colSpan={6} className='py-8 text-center text-muted-foreground'>
                  {data.t('暂无数据')}
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </div>

      <div className='flex items-center justify-between text-sm text-muted-foreground'>
        <span>
          {data.t('共')} {data.logCount || 0} {data.t('条')}
        </span>
        <div className='flex items-center gap-2'>
          <Button
            size='sm'
            variant='outline'
            disabled={data.activePage <= 1 || data.loading}
            onClick={() => data.handlePageChange(data.activePage - 1)}
          >
            {data.t('上一页')}
          </Button>
          <span>
            {data.activePage} / {totalPages}
          </span>
          <Button
            size='sm'
            variant='outline'
            disabled={data.activePage >= totalPages || data.loading}
            onClick={() => data.handlePageChange(data.activePage + 1)}
          >
            {data.t('下一页')}
          </Button>
        </div>
      </div>
    </div>
  );
}
