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
import { Copy, RotateCcw } from 'lucide-react';
import { Button } from '../../../primitives/button';
import { Table, Tbody, Td, Th, Thead, Tr } from '../../../primitives/table';
import {
  canRetryCallbackEvent,
  formatCallbackTimestamp,
  formatRelativeTime,
  formatRetryProgress,
  getRetryDisabledReason,
  getCallbackSourceMeta,
  getCallbackStatusMeta,
} from './callback-log-utils';

function CopyCell({ value, maskedValue, onCopy }) {
  const rawValue = String(value || '').trim();
  const displayValue = rawValue || String(maskedValue || '').trim() || '-';
  const copyValue = rawValue || displayValue;

  return (
    <div className='flex items-center gap-2 font-mono text-[11px] text-on-surface-variant'>
      <span className='truncate'>{displayValue}</span>
      {copyValue !== '-' ? (
        <button
          type='button'
          className='text-on-surface-variant transition-colors hover:text-primary'
          onClick={() => onCopy(copyValue)}
        >
          <Copy className='h-3.5 w-3.5' />
        </button>
      ) : null}
    </div>
  );
}

function StatusBadge({ status, t }) {
  const meta = getCallbackStatusMeta(status);
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${meta.badgeClassName}`}
    >
      {t(meta.labelKey)}
    </span>
  );
}

function SourceBadge({ source, t }) {
  const meta = getCallbackSourceMeta(source);
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-bold uppercase ${meta.className}`}
    >
      {t(meta.labelKey)}
    </span>
  );
}

function HttpBadge({ value }) {
  const numeric = Number(value);
  const className = Number.isFinite(numeric)
    ? numeric >= 500
      ? 'bg-rose-50 text-rose-600'
      : numeric >= 400
        ? 'bg-amber-50 text-amber-700'
        : numeric >= 200
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-slate-50 text-slate-500'
    : 'bg-slate-50 text-slate-500';

  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold ${className}`}
    >
      {value || '-'}
    </span>
  );
}

export default function CallbackLogTable({
  events,
  loading,
  onCopy,
  onRetry,
  onOpenAttempts,
  t,
}) {
  const renderRow = (event) => {
    const canRetry = canRetryCallbackEvent(event);
    const retryReason = getRetryDisabledReason(event);

    return (
      <Tr
        key={event.key}
        className='border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
      >
        <Td className='px-4 py-4 text-xs text-on-surface-variant'>
          <div>{formatRelativeTime(event.created_at, '-')}</div>
          <div className='mt-1 whitespace-nowrap text-[11px] text-on-surface-variant/70'>
            {formatCallbackTimestamp(event.created_at)}
          </div>
        </Td>
        <Td className='px-4 py-4'>
          <SourceBadge source={event.source} t={t} />
        </Td>
        <Td className='px-4 py-4'>
          <StatusBadge status={event.status} t={t} />
        </Td>
        <Td className='px-4 py-4'>
          <CopyCell value={event.request_id} onCopy={onCopy} />
        </Td>
        <Td className='px-4 py-4'>
          <CopyCell
            value={event.token_sk}
            maskedValue={event.token_sk_masked}
            onCopy={onCopy}
          />
        </Td>
        <Td className='min-w-[112px] px-4 py-4 text-xs text-on-surface'>
          <div>{event.username || '-'}</div>
          <div className='mt-1 text-[11px] text-on-surface-variant'>
            {event.user_id || '-'}
          </div>
        </Td>
        <Td className='px-4 py-4 text-xs text-on-surface-variant'>
          <button
            type='button'
            className='rounded-md px-2 py-1 text-left transition-colors hover:bg-primary/5 hover:text-primary'
            onClick={() => onOpenAttempts(event)}
          >
            {formatRetryProgress(event)}
          </button>
        </Td>
        <Td className='px-4 py-4'>
          <HttpBadge value={event.last_http_status} />
        </Td>
        <Td className='px-4 py-4 text-xs text-on-surface-variant'>
          <div className='truncate'>
            {event.last_error ||
              event.last_response_body ||
              event.response_body ||
              '-'}
          </div>
          <div className='mt-1 truncate text-[11px] text-on-surface-variant/70'>
            {event.event_type || '-'}
          </div>
        </Td>
        <Td className='px-4 py-4'>
          <div className='flex justify-end gap-2'>
            <Button
              size='sm'
              variant='outline'
              className='border-outline-variant bg-white text-primary hover:bg-primary/5'
              onClick={() => onOpenAttempts(event)}
            >
              {t('详情')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={!canRetry}
              title={retryReason || undefined}
              className='border-outline-variant bg-white text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-45'
              onClick={() => onRetry(event)}
            >
              <RotateCcw className='mr-1.5 h-3.5 w-3.5' />
              {t('Retry')}
            </Button>
          </div>
        </Td>
      </Tr>
    );
  };

  return (
    <section className='overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm'>
      <div className='overflow-x-auto'>
        <Table className='min-w-full table-fixed'>
          <Thead className='bg-surface-container-low'>
            <Tr className='border-outline-variant hover:bg-surface-container-low'>
              <Th className='w-[170px] whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider'>
                {t('创建时间')}
              </Th>
              <Th className='w-[120px] whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider'>
                {t('来源')}
              </Th>
              <Th className='w-[110px] whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider'>
                {t('状态')}
              </Th>
              <Th className='w-[210px] whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider'>
                {t('Request ID')}
              </Th>
              <Th className='w-[150px] whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider'>
                {t('目标 SK')}
              </Th>
              <Th className='w-[120px] whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider'>
                {t('用户')}
              </Th>
              <Th className='w-[88px] whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider'>
                {t('Retry')}
              </Th>
              <Th className='w-[88px] whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider'>
                {t('HTTP')}
              </Th>
              <Th className='w-[180px] whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider'>
                {t('Response')}
              </Th>
              <Th className='w-[156px] whitespace-nowrap px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider'>
                {t('操作')}
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              <Tr className='border-outline-variant hover:bg-surface-container-lowest'>
                <Td
                  colSpan={10}
                  className='px-4 py-10 text-center text-sm text-on-surface-variant'
                >
                  {t('加载中...')}
                </Td>
              </Tr>
            ) : null}

            {!loading && events.length === 0 ? (
              <Tr className='border-outline-variant hover:bg-surface-container-lowest'>
                <Td
                  colSpan={10}
                  className='px-4 py-10 text-center text-sm text-on-surface-variant'
                >
                  {t('暂无数据')}
                </Td>
              </Tr>
            ) : null}

            {!loading ? events.map(renderRow) : null}
          </Tbody>
        </Table>
      </div>
    </section>
  );
}
