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
import { Columns3, RefreshCw, Search } from 'lucide-react';
import { useMjLogsData } from '../../../hooks/mj-logs/useMjLogsData';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import MjLogsTable from '../../../components/table/mj-logs/MjLogsTable';
import ColumnSelectorModal from '../../../components/table/mj-logs/modals/ColumnSelectorModal';
import ContentModal from '../../../components/table/mj-logs/modals/ContentModal';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateByOffset = (offsetDays) => {
  const date = new Date(Date.now() - offsetDays * DAY_IN_MS);
  return formatDateInput(date);
};

const createDefaultFilters = () => ({
  channel_id: '',
  mj_id: '',
  from: getDateByOffset(30),
  to: getDateByOffset(0),
});

const createDateRange = (from, to) => {
  if (!from || !to) {
    return undefined;
  }
  return [`${from} 00:00:00`, `${to} 23:59:59`];
};

export default function MjLogsPage() {
  const data = useMjLogsData();
  const [filters, setFilters] = React.useState(createDefaultFilters);

  const totalPages = React.useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(
          Number(data.logCount || 0) / Math.max(1, Number(data.pageSize || 1)),
        ),
      ),
    [data.logCount, data.pageSize],
  );

  React.useEffect(() => {
    data.setFormApi({
      getValues: () => {
        const dateRange = createDateRange(filters.from, filters.to);
        return {
          channel_id: data.isAdminUser ? filters.channel_id : '',
          mj_id: filters.mj_id,
          dateRange,
        };
      },
    });
  }, [
    data.isAdminUser,
    data.setFormApi,
    filters.channel_id,
    filters.from,
    filters.mj_id,
    filters.to,
  ]);

  const queryFirstPage = React.useCallback(async () => {
    await data.loadLogs(1, data.pageSize);
  }, [data]);

  const refreshCurrentPage = React.useCallback(async () => {
    await data.refresh();
  }, [data]);

  const resetFilters = React.useCallback(() => {
    const defaults = createDefaultFilters();
    setFilters(defaults);
    window.setTimeout(() => {
      data.loadLogs(1, data.pageSize);
    }, 0);
  }, [data]);

  return (
    <>
      <ColumnSelectorModal {...data} />
      <ContentModal {...data} />

      <div className='space-y-5'>
        {(data.isAdminUser && data.showBanner) || !data.isAdminUser ? (
          <div className='flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4'>
            <span className='mt-0.5 text-lg text-indigo-500'>ⓘ</span>
            <p className='text-sm font-medium text-indigo-900'>
              {data.isAdminUser && data.showBanner
                ? data.t(
                    '当前未开启Midjourney回调，部分项目可能无法获得绘图结果，可在运营设置中开启。',
                  )
                : data.t(
                    'MJ logs are powered by the Midjourney relay. Configure in System Settings > MJ Settings.',
                  )}
            </p>
          </div>
        ) : null}

        <div className='rounded-xl border border-border bg-card p-5'>
          <h1 className='text-2xl font-bold tracking-tight text-foreground'>
            {data.t('Midjourney 任务记录')}
          </h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            {data.t('Track image generation tasks across your environment')}
          </p>
        </div>

        <div className='rounded-xl border border-border bg-card p-4 shadow-sm'>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
            <Input
              label={data.t('开始日期')}
              type='date'
              value={filters.from}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, from: event.target.value }))
              }
            />
            <Input
              label={data.t('结束日期')}
              type='date'
              value={filters.to}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, to: event.target.value }))
              }
            />
            <Input
              label={data.t('任务 ID')}
              placeholder={data.t('Task ID...')}
              value={filters.mj_id}
              icon={<Search className='h-4 w-4' />}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, mj_id: event.target.value }))
              }
            />
            {data.isAdminUser ? (
              <Input
                label={data.t('渠道 ID')}
                placeholder={data.t('Channel ID')}
                value={filters.channel_id}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    channel_id: event.target.value,
                  }))
                }
              />
            ) : null}
          </div>

          <div className='mt-4 flex flex-wrap items-center justify-end gap-2'>
            <Button size='sm' onClick={queryFirstPage} loading={data.loading}>
              {data.t('查询')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={resetFilters}
              disabled={data.loading}
            >
              {data.t('重置')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={refreshCurrentPage}
              loading={data.loading}
            >
              <RefreshCw className='mr-1 h-4 w-4' />
              {data.t('刷新')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => data.setShowColumnSelector(true)}
            >
              <Columns3 className='mr-1 h-4 w-4' />
              {data.t('列设置')}
            </Button>
          </div>
        </div>

        <div className='rounded-xl border border-border bg-card p-2 shadow-sm'>
          <MjLogsTable {...data} />
        </div>

        <div className='flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground'>
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
    </>
  );
}
