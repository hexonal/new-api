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
import { timestamp2string } from '../../../helpers';
import { useCallbackLogsData } from '../../../hooks/callback-logs/useCallbackLogsData';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';

export default function CallbackLogsPage() {
  const data = useCallbackLogsData();
  const totalPages = Math.max(
    1,
    Math.ceil(Number(data.eventCount || 0) / Math.max(1, Number(data.pageSize || 1))),
  );

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border border-border bg-card/70 p-3'>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
          <select
            className='h-10 rounded-lg border border-input bg-background px-3 text-sm'
            value={data.filters.status}
            onChange={(event) =>
              data.setFilters((prev) => ({ ...prev, status: event.target.value }))
            }
          >
            <option value=''>{data.t('全部状态')}</option>
            <option value='pending'>{data.t('待处理')}</option>
            <option value='processing'>{data.t('处理中')}</option>
            <option value='retry_wait'>{data.t('重试等待')}</option>
            <option value='succeeded'>{data.t('成功')}</option>
            <option value='dead'>{data.t('失败')}</option>
            <option value='cancelled'>{data.t('已取消')}</option>
          </select>
          <select
            className='h-10 rounded-lg border border-input bg-background px-3 text-sm'
            value={data.filters.source}
            onChange={(event) =>
              data.setFilters((prev) => ({ ...prev, source: event.target.value }))
            }
          >
            <option value=''>{data.t('全部来源')}</option>
            <option value='consume'>{data.t('消费回调')}</option>
            <option value='operator'>{data.t('运营回调')}</option>
            <option value='feishu'>{data.t('飞书通知')}</option>
            <option value='user_points_guard'>{data.t('积分预扣校验')}</option>
          </select>
          <div className='flex items-center justify-end gap-2'>
            <Button
              size='sm'
              variant='outline'
              onClick={() => data.loadEvents(1, data.pageSize)}
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
      </div>

      <div className='rounded-xl border border-border bg-card/70'>
        <Table>
          <Thead>
            <Tr>
              <Th>{data.t('创建时间')}</Th>
              <Th>{data.t('来源')}</Th>
              <Th>{data.t('状态')}</Th>
              <Th>{data.t('事件类型')}</Th>
              <Th>{data.t('Request ID')}</Th>
              <Th>{data.t('用户名')}</Th>
              <Th>{data.t('Retry')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(data.events || []).map((event) => (
              <Tr key={event.key}>
                <Td className='text-xs'>
                  {event.created_at ? timestamp2string(event.created_at) : '-'}
                </Td>
                <Td className='text-xs'>{event.source || '-'}</Td>
                <Td>
                  <Badge
                    variant={
                      event.status === 'dead'
                        ? 'destructive'
                        : event.status === 'succeeded'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {event.status || '-'}
                  </Badge>
                </Td>
                <Td className='text-xs'>{event.event_type || '-'}</Td>
                <Td className='font-mono text-xs'>{event.request_id || '-'}</Td>
                <Td className='text-xs'>{event.username || '-'}</Td>
                <Td>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => data.retryEvent(event.id)}
                  >
                    {data.t('Retry')}
                  </Button>
                </Td>
              </Tr>
            ))}
            {!data.loading && (data.events || []).length === 0 && (
              <Tr>
                <Td colSpan={7} className='py-8 text-center text-muted-foreground'>
                  {data.t('暂无数据')}
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </div>

      <div className='flex items-center justify-between text-sm text-muted-foreground'>
        <span>
          {data.t('共')} {data.eventCount || 0} {data.t('条')}
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
