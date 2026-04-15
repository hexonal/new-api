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
import { getLogOther, renderNumber, renderQuota } from '../../../../helpers';
import {
  buildDetailPreviewLines,
  formatRelativeTime,
  getDetailRecordValue,
  getLogTypeMeta,
  getModelIconClass,
  getModelInitial,
  getPromptCacheSummary,
  getRetryText,
  getShortLabel,
  isUsageDisplayType,
  normalizePreviewText,
  renderDetailValue,
  toPlainText,
} from './page-utils';

const buildChannelColumn = (data, t, key) => ({
  key,
  title: t('渠道'),
  width: 180,
  render: (log) => {
    if (!data.isAdminUser || !isUsageDisplayType(log?.type)) {
      return <span className='text-on-surface-variant'>-</span>;
    }
    const other = getLogOther(log?.other);
    const channelName = String(log?.channel_name || '').trim();
    const channelChain = Array.isArray(other?.admin_info?.use_channel)
      ? other.admin_info.use_channel.join(' -> ')
      : '';
    const affinity = other?.admin_info?.channel_affinity;
    const displayText =
      channelChain ||
      [channelName, log?.channel ? `#${log.channel}` : '']
        .filter(Boolean)
        .join(' ');

    return (
      <div className='flex min-w-0 items-center gap-2'>
        <span className='inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-surface-container-high px-2 text-[11px] font-semibold text-on-surface'>
          {getShortLabel(channelName, String(log?.channel || '-'))}
        </span>
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium text-on-surface'>
            {channelName || `#${log?.channel || '-'}`}
          </div>
          <div className='truncate text-xs text-on-surface-variant'>
            {displayText || '-'}
          </div>
        </div>
        {affinity ? (
          <button
            type='button'
            className='shrink-0 rounded-md border border-outline-variant px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/5'
            onClick={(event) => {
              event.stopPropagation();
              data.openChannelAffinityUsageCacheModal?.(affinity);
            }}
          >
            {t('缓存')}
          </button>
        ) : null}
      </div>
    );
  },
});

const buildChannelIdColumn = (data, t, key) => ({
  key,
  title: t('渠道 ID'),
  width: 112,
  render: (log) => (
    <button
      type='button'
      className='rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface transition-colors hover:border-primary hover:text-primary'
      onClick={(event) => data.copyText(event, String(log?.channel || '-'))}
    >
      #{log?.channel || '-'}
    </button>
  ),
});

const buildUsernameColumn = (data, t, key) => ({
  key,
  title: t('用户'),
  width: 168,
  render: (log) => {
    const username = String(log?.username || '').trim();
    if (!data.isAdminUser) {
      return <span className='text-on-surface-variant'>-</span>;
    }

    return (
      <button
        type='button'
        className='flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-container'
        onClick={(event) => {
          event.stopPropagation();
          data.showUserInfoFunc(log?.user_id);
        }}
      >
        <span className='inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary'>
          {username.slice(0, 1).toUpperCase() || '-'}
        </span>
        <span className='block truncate text-[13px] font-semibold leading-none text-on-surface'>
          {username || '-'}
        </span>
      </button>
    );
  },
});

const buildTokenColumn = (data, t, key) => ({
  key,
  title: t('令牌'),
  width: 140,
  render: (log) =>
    isUsageDisplayType(log?.type) ? (
      <button
        type='button'
        className='rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface transition-colors hover:border-primary hover:text-primary'
        onClick={(event) => data.copyText(event, String(log?.token_name || '-'))}
      >
        {log?.token_name || '-'}
      </button>
    ) : (
      <span className='text-on-surface-variant'>-</span>
    ),
});

const buildGroupColumn = (key, title, className, resolveValue) => ({
  key,
  title,
  width: 168,
  render: (log) => {
    const other = getLogOther(log?.other);
    const value = resolveValue(log, other);

    return value ? (
      <span className={className}>{value}</span>
    ) : (
      <span className='text-on-surface-variant'>-</span>
    );
  },
});

const buildTypeColumn = (t, key) => ({
  key,
  title: t('类型'),
  width: 100,
  render: (log) => {
    const meta = getLogTypeMeta(log?.type, t);
    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
      >
        {meta.label}
      </span>
    );
  },
});

const buildModelColumn = (data, t, key) => ({
  key,
  title: t('模型'),
  width: 228,
  render: (log) => (
    <div className='flex min-w-0 items-center gap-2'>
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white ${getModelIconClass(log?.model_name)}`}
      >
        {getModelInitial(log?.model_name)}
      </div>
      <button
        type='button'
        className='truncate text-left font-medium text-on-surface hover:text-primary'
        onClick={(event) => data.copyText(event, String(log?.model_name || '-'))}
      >
        {log?.model_name || '-'}
      </button>
    </div>
  ),
});

const buildUseTimeColumn = (t, key) => ({
  key,
  title: t('用时/首字'),
  width: 138,
  render: (log) => {
    if (!(Number(log?.type) === 2 || Number(log?.type) === 5)) {
      return <span className='text-on-surface-variant'>-</span>;
    }
    const other = getLogOther(log?.other);
    const useTime = Number(log?.use_time || 0);
    const firstToken = Number(other?.frt || 0);
    const latencyText = useTime > 0 ? `${useTime}s` : '-';
    const firstTokenText =
      Number.isFinite(firstToken) && firstToken > 0
        ? `${(firstToken / 1000).toFixed(1)}s`
        : '';
    return (
      <div className='flex flex-wrap items-center gap-1.5'>
        <span className='rounded-full bg-surface-container-high px-2 py-1 text-xs font-medium text-on-surface'>
          {latencyText}
        </span>
        {log?.is_stream ? (
          <span className='rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary'>
            {t('流')}
          </span>
        ) : (
          <span className='rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700'>
            {t('非流')}
          </span>
        )}
        {firstTokenText ? (
          <span className='rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700'>
            {firstTokenText}
          </span>
        ) : null}
      </div>
    );
  },
});

const buildPromptColumn = (t, key) => ({
  key,
  title: t('输入'),
  width: 138,
  render: (log) => {
    const other = getLogOther(log?.other);
    const cacheSummary = getPromptCacheSummary(other, t);
    return (
      <div className='font-mono text-xs'>
        <div className='text-secondary'>{renderNumber(log?.prompt_tokens || 0)}</div>
        {cacheSummary ? (
          <div className='mt-1 whitespace-nowrap text-[11px] text-on-surface-variant'>
            {cacheSummary}
          </div>
        ) : null}
      </div>
    );
  },
});

const buildCostColumn = (t, key) => ({
  key,
  title: t('花费'),
  width: 136,
  render: (log) => {
    const other = getLogOther(log?.other);
    if (other?.billing_source === 'subscription') {
      return (
        <div className='space-y-1'>
          <span className='inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700'>
            {t('订阅抵扣')}
          </span>
          <div className='text-xs text-on-surface-variant'>
            {renderQuota(log?.quota || 0, 6)}
          </div>
        </div>
      );
    }
    if (
      other?.deferred_settle &&
      String(other?.terminal_charge_state || '').toLowerCase() === 'pending'
    ) {
      return (
        <div className='space-y-1'>
          <span className='inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700'>
            {t('待结算')}
          </span>
          <div className='text-xs text-on-surface-variant'>{t('未扣费')}</div>
        </div>
      );
    }
    return (
      <span className='font-mono text-xs text-on-surface'>
        {renderQuota(log?.quota || 0, 6)}
      </span>
    );
  },
});

const buildIpColumn = (data, key) => ({
  key,
  title: 'IP',
  width: 146,
  render: (log) =>
    log?.ip ? (
      <button
        type='button'
        className='rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface transition-colors hover:border-primary hover:text-primary'
        onClick={(event) => data.copyText(event, String(log.ip))}
      >
        {log.ip}
      </button>
    ) : (
      <span className='text-on-surface-variant'>-</span>
    ),
});

const buildDetailsColumn = (data, t, key) => ({
  key,
  title: t('详情'),
  width: 280,
  render: (log) => {
    const details = data.expandData?.[log.key] || [];
    const other = getLogOther(log?.other);
    const requestId =
      log?.request_id ||
      other?.request_id ||
      other?.task_id ||
      getDetailRecordValue(details, ['request id', '任务id']) ||
      '-';
    const previewLines = buildDetailPreviewLines(details, requestId);
    const summary =
      previewLines.length > 0
        ? previewLines
        : [
            normalizePreviewText(String(log?.content || '')),
            normalizePreviewText(
              toPlainText(getDetailRecordValue(details, ['计费过程'])),
            ),
          ].filter(Boolean);

    return summary.length > 0 ? (
      <div className='space-y-1 text-xs text-on-surface-variant'>
        {summary.slice(0, 3).map((line) => (
          <div
            key={`${log.key}-${line}`}
            className='overflow-hidden text-ellipsis whitespace-nowrap'
            title={line}
          >
            {line}
          </div>
        ))}
      </div>
    ) : (
      <span className='text-on-surface-variant'>-</span>
    );
  },
});

export const buildUsageLogColumns = ({ data, t }) => {
  const {
    TIME,
    CHANNEL,
    CHANNEL_ID,
    USERNAME,
    TOKEN,
    GROUP,
    PRICING_GROUP,
    TYPE,
    MODEL,
    USE_TIME,
    PROMPT,
    COMPLETION,
    COST,
    IP,
    RETRY,
    DETAILS,
  } = data.COLUMN_KEYS;

  return [
    {
      key: TIME,
      title: t('时间'),
      width: 168,
      render: (log) => (
        <span className='whitespace-nowrap text-on-surface-variant'>
          {formatRelativeTime(log?.created_at)}
        </span>
      ),
    },
    buildChannelColumn(data, t, CHANNEL),
    buildChannelIdColumn(data, t, CHANNEL_ID),
    buildUsernameColumn(data, t, USERNAME),
    buildTokenColumn(data, t, TOKEN),
    buildGroupColumn(
      GROUP,
      t('分组'),
      'inline-flex min-w-fit items-center whitespace-nowrap rounded-full bg-surface-container-high px-3 py-1 text-[13px] font-semibold leading-none text-on-surface',
      (log, other) => log?.group || other?.group || '',
    ),
    buildGroupColumn(
      PRICING_GROUP,
      t('定价分组'),
      'inline-flex min-w-fit items-center whitespace-nowrap rounded-full border border-outline-variant bg-secondary-container px-3 py-1 text-[13px] font-semibold leading-none text-on-surface shadow-sm',
      (log, other) => log?.pricing_group || other?.pricing_group || '',
    ),
    buildTypeColumn(t, TYPE),
    buildModelColumn(data, t, MODEL),
    buildUseTimeColumn(t, USE_TIME),
    buildPromptColumn(t, PROMPT),
    {
      key: COMPLETION,
      title: t('输出'),
      width: 112,
      render: (log) => (
        <span className='font-mono text-xs text-on-surface'>
          {renderNumber(log?.completion_tokens || 0)}
        </span>
      ),
    },
    buildCostColumn(t, COST),
    buildIpColumn(data, IP),
    {
      key: RETRY,
      title: t('重试'),
      width: 184,
      render: (log) => (
        <div className='text-xs text-on-surface-variant'>{getRetryText(log)}</div>
      ),
    },
    buildDetailsColumn(data, t, DETAILS),
  ];
};
