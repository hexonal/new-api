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
import {
  IconChevronDown,
  IconCopy,
  IconDownload,
} from '@douyinfe/semi-icons';
import {
  copy,
  getLogOther,
  renderNumber,
  renderQuota,
  showError,
  showSuccess,
  timestamp2string,
} from '../../../helpers';
import { useLogsData as useUsageLogsData } from '../../../hooks/usage-logs/useUsageLogsData';
import UserInfoModal from '../../../components/table/usage-logs/modals/UserInfoModal';
import ChannelAffinityUsageCacheModal from '../../../components/table/usage-logs/modals/ChannelAffinityUsageCacheModal';

const STATUS_FILTER_OPTIONS = [
  { value: '0', label: '全部' },
  { value: '1', label: '充值' },
  { value: '2', label: '消费' },
  { value: '3', label: '管理' },
  { value: '4', label: '系统' },
  { value: '5', label: '错误' },
  { value: '6', label: '退款' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DETAIL_PREVIEW_KEYS = [
  '日志详情',
  '其他详情',
  '计费过程',
  '请求路径',
  '请求转换',
  '计费模式',
  'request id',
  '任务id',
];

const padTimePart = (value) => String(value).padStart(2, '0');

const formatDateTimeLocal = (date) => {
  const y = date.getFullYear();
  const m = padTimePart(date.getMonth() + 1);
  const d = padTimePart(date.getDate());
  const h = padTimePart(date.getHours());
  const min = padTimePart(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
};

const normalizeDateTimeFieldValue = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const normalized = text.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized.slice(0, 16);
  }

  return formatDateTimeLocal(parsed);
};

const toQueryDateTimeValue = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const normalized = text.replace('T', ' ');
  return normalized.length === 16 ? `${normalized}:00` : normalized;
};

const buildInitialFilters = (formInitValues) => {
  const dateRange = Array.isArray(formInitValues?.dateRange)
    ? formInitValues.dateRange
    : [];

  return {
    username: String(formInitValues?.username || ''),
    token_name: String(formInitValues?.token_name || ''),
    model_name: String(formInitValues?.model_name || ''),
    channel: String(formInitValues?.channel || ''),
    group: String(formInitValues?.group || ''),
    pricing_group: String(formInitValues?.pricing_group || ''),
    request_id: String(formInitValues?.request_id || ''),
    logType: String(formInitValues?.logType ?? '0'),
    from: normalizeDateTimeFieldValue(dateRange[0]),
    to: normalizeDateTimeFieldValue(dateRange[1]),
  };
};

const isSameDay = (d1, d2) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const formatRelativeTime = (createdAt) => {
  const seconds = Number(createdAt);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '-';
  }

  const createdDate = new Date(seconds * 1000);
  const now = new Date();
  const delta = Math.max(
    0,
    Math.floor((now.getTime() - createdDate.getTime()) / 1000),
  );

  if (delta < 60) {
    return `${delta}s ago`;
  }
  if (delta < 3600) {
    return `${Math.floor(delta / 60)} min ago`;
  }
  if (delta < 86400 && isSameDay(createdDate, now)) {
    return `${Math.floor(delta / 3600)} hour ago`;
  }

  return timestamp2string(seconds);
};

const resolveLatencySeconds = (log) => {
  const parsed = Number(log?.use_time);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed > 1000 ? parsed / 1000 : parsed;
};

const getLatencyToneClass = (latency) => {
  if (!Number.isFinite(latency)) {
    return 'text-gray-400';
  }
  if (latency <= 2) {
    return 'text-emerald-600';
  }
  if (latency <= 5) {
    return 'text-amber-600';
  }
  return 'text-error';
};

const resolveStatusMeta = (log) => {
  const isError = Number(log?.type) === 5;
  if (isError) {
    return {
      label: 'Error',
      className: 'bg-error/10 text-error',
    };
  }
  return {
    label: 'Success',
    className: 'bg-emerald-100 text-emerald-700',
  };
};

const MODEL_ICON_CLASSES = [
  'bg-black',
  'bg-orange-500',
  'bg-blue-600',
  'bg-purple-600',
  'bg-cyan-600',
  'bg-emerald-600',
  'bg-rose-600',
  'bg-indigo-600',
];

const hashString = (value) => {
  const input = String(value || '');
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const getModelIconClass = (modelName) =>
  MODEL_ICON_CLASSES[hashString(modelName) % MODEL_ICON_CLASSES.length];

const getModelInitial = (modelName) => {
  const text = String(modelName || '').trim();
  if (!text) {
    return '-';
  }
  return text.charAt(0).toUpperCase();
};

const getDetailRecordValue = (details, keywords) => {
  const lowered = keywords.map((item) => String(item).toLowerCase());
  const matched = details.find((item) => {
    const key = String(item?.key || '').toLowerCase();
    return lowered.some((target) => key.includes(target));
  });
  return matched ? matched.value : null;
};

const renderDetailValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (React.isValidElement(value)) {
    return value;
  }
  return String(value);
};

const toPlainText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
};

const normalizePreviewText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const getCopyableText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '';
};

const buildDetailPreviewLines = (details, requestId) => {
  const previewLines = [];

  if (requestId && requestId !== '-') {
    previewLines.push(`Request ID: ${requestId}`);
  }

  for (const item of details) {
    const key = String(item?.key || '').trim();
    const loweredKey = key.toLowerCase();
    if (!DETAIL_PREVIEW_KEYS.some((candidate) => loweredKey.includes(candidate))) {
      continue;
    }

    const value = normalizePreviewText(toPlainText(item?.value));
    if (!value) {
      continue;
    }

    const line = `${key}: ${value}`;
    if (!previewLines.includes(line)) {
      previewLines.push(line);
    }
    if (previewLines.length >= 3) {
      break;
    }
  }

  return previewLines;
};

const buildPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 1) {
    return [1];
  }
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([
    1,
    totalPages,
    currentPage,
    currentPage - 1,
    currentPage + 1,
  ]);
  const sorted = Array.from(pages)
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);

  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push('ellipsis');
    }
    result.push(sorted[i]);
  }
  return result;
};

const escapeCsvCell = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const normalized = String(value).replaceAll('"', '""');
  return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
};

const isUsageDisplayType = (type) =>
  [0, 2, 5, 6].includes(Number.parseInt(type, 10));

const getShortLabel = (value, fallback = '-') => {
  const text = String(value || '').trim();
  if (!text) {
    return fallback;
  }
  return text.slice(0, 2);
};

const getLogTypeMeta = (type, t) => {
  switch (Number(type)) {
    case 1:
      return {
        label: t('充值'),
        className: 'bg-cyan-100 text-cyan-700',
      };
    case 2:
      return {
        label: t('消费'),
        className: 'bg-emerald-100 text-emerald-700',
      };
    case 3:
      return {
        label: t('管理'),
        className: 'bg-orange-100 text-orange-700',
      };
    case 4:
      return {
        label: t('系统'),
        className: 'bg-violet-100 text-violet-700',
      };
    case 5:
      return {
        label: t('错误'),
        className: 'bg-rose-100 text-rose-700',
      };
    case 6:
      return {
        label: t('退款'),
        className: 'bg-teal-100 text-teal-700',
      };
    default:
      return {
        label: t('未知'),
        className: 'bg-gray-100 text-gray-600',
      };
  }
};

const getPromptCacheSummary = (other, t) => {
  if (!other || typeof other !== 'object') {
    return '';
  }
  const cacheReadTokens = Number(other.cache_tokens || 0);
  const cacheCreationTokens = Number(other.cache_creation_tokens || 0);
  const cacheCreationTokens5m = Number(other.cache_creation_tokens_5m || 0);
  const cacheCreationTokens1h = Number(other.cache_creation_tokens_1h || 0);
  const cacheWriteTokens =
    cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0
      ? cacheCreationTokens5m + cacheCreationTokens1h
      : cacheCreationTokens;

  if (cacheReadTokens > 0 && cacheWriteTokens > 0) {
    return `${t('缓存读')} ${renderNumber(cacheReadTokens)} · ${t('写')} ${renderNumber(cacheWriteTokens)}`;
  }
  if (cacheReadTokens > 0) {
    return `${t('缓存读')} ${renderNumber(cacheReadTokens)}`;
  }
  if (cacheWriteTokens > 0) {
    return `${t('缓存写')} ${renderNumber(cacheWriteTokens)}`;
  }
  return '';
};

const getRetryText = (log) => {
  if (!(Number(log?.type) === 2 || Number(log?.type) === 5)) {
    return '-';
  }

  const other = getLogOther(log?.other);
  const useChannel = other?.admin_info?.use_channel;
  if (Array.isArray(useChannel) && useChannel.length > 0) {
    return `${useChannel.join(' -> ')}`;
  }
  return `${log?.channel || '-'}`;
};

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
        const latencySeconds = resolveLatencySeconds(log);

        return [
          formatRelativeTime(log?.created_at),
          log?.model_name || '-',
          log?.username || '-',
          `${renderNumber(log?.prompt_tokens || 0)} / ${renderNumber(log?.completion_tokens || 0)}`,
          renderQuota(log?.quota || 0, 6),
          Number.isFinite(latencySeconds)
            ? `${latencySeconds.toFixed(1)}s`
            : '-',
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

  const handleCopy = React.useCallback(async (text) => {
    const content = String(text || '').trim();
    if (!content) {
      return;
    }

    if (await copy(content)) {
      showSuccess(`${t('已复制：')}${content}`);
      return;
    }
    showError(t('无法复制到剪贴板，请手动复制'));
  }, [t]);

  const allColumns = React.useMemo(() => {
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
      {
        key: CHANNEL,
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
      },
      {
        key: CHANNEL_ID,
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
      },
      {
        key: USERNAME,
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
              className='flex min-w-0 items-center gap-2 whitespace-nowrap text-left'
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
      },
      {
        key: TOKEN,
        title: t('令牌'),
        width: 140,
        render: (log) =>
          isUsageDisplayType(log?.type) ? (
            <button
              type='button'
              className='rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface transition-colors hover:border-primary hover:text-primary'
              onClick={(event) =>
                data.copyText(event, String(log?.token_name || '-'))
              }
            >
              {log?.token_name || '-'}
            </button>
          ) : (
            <span className='text-on-surface-variant'>-</span>
          ),
      },
      {
        key: GROUP,
        title: t('分组'),
        width: 156,
        render: (log) => {
          const other = getLogOther(log?.other);
          const group = log?.group || other?.group || '';
          return group ? (
            <span className='inline-flex min-w-fit items-center whitespace-nowrap rounded-full bg-surface-container-high px-3 py-1 text-[13px] font-semibold leading-none text-on-surface'>
              {group}
            </span>
          ) : (
            <span className='text-on-surface-variant'>-</span>
          );
        },
      },
      {
        key: PRICING_GROUP,
        title: t('定价分组'),
        width: 168,
        render: (log) =>
          log?.pricing_group ? (
            <span className='inline-flex min-w-fit items-center whitespace-nowrap rounded-full border border-outline-variant bg-secondary-container px-3 py-1 text-[13px] font-semibold leading-none text-on-surface shadow-sm'>
              {log.pricing_group}
            </span>
          ) : (
            <span className='text-on-surface-variant'>-</span>
          ),
      },
      {
        key: TYPE,
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
      },
      {
        key: MODEL,
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
              onClick={(event) =>
                data.copyText(event, String(log?.model_name || '-'))
              }
            >
              {log?.model_name || '-'}
            </button>
          </div>
        ),
      },
      {
        key: USE_TIME,
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
      },
      {
        key: PROMPT,
        title: t('输入'),
        width: 138,
        render: (log) => {
          const other = getLogOther(log?.other);
          const cacheSummary = getPromptCacheSummary(other, t);
          return (
            <div className='font-mono text-xs'>
              <div className='text-secondary'>
                {renderNumber(log?.prompt_tokens || 0)}
              </div>
              {cacheSummary ? (
                <div className='mt-1 whitespace-nowrap text-[11px] text-on-surface-variant'>
                  {cacheSummary}
                </div>
              ) : null}
            </div>
          );
        },
      },
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
      {
        key: COST,
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
                <div className='text-xs text-on-surface-variant'>
                  {t('未扣费')}
                </div>
              </div>
            );
          }
          return (
            <span className='font-mono text-xs text-on-surface'>
              {renderQuota(log?.quota || 0, 6)}
            </span>
          );
        },
      },
      {
        key: IP,
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
      },
      {
        key: RETRY,
        title: t('重试'),
        width: 184,
        render: (log) => (
          <div className='text-xs text-on-surface-variant'>{getRetryText(log)}</div>
        ),
      },
      {
        key: DETAILS,
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
      },
    ];
  }, [
    data.COLUMN_KEYS,
    data.expandData,
    data.isAdminUser,
    data.openChannelAffinityUsageCacheModal,
    data.showUserInfoFunc,
    data.copyText,
    t,
  ]);

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
      {data.showColumnSelector ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm'>
          <div className='w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]'>
            <div className='flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5'>
              <div>
                <div className='text-lg font-semibold text-slate-900'>
                  {t('列设置')}
                </div>
                <div className='mt-1 text-sm text-slate-600'>
                  {t('选择使用日志主表中需要展示的列')}
                </div>
              </div>
              <button
                type='button'
                className='rounded-xl border border-slate-300 bg-white p-2 text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900'
                onClick={() => data.setShowColumnSelector(false)}
                aria-label={t('关闭')}
              >
                <span className='block text-base leading-none'>×</span>
              </button>
            </div>

            <div className='space-y-6 bg-white px-6 py-5'>
              <div className='flex items-center justify-between gap-4'>
                <label className='flex items-center gap-3 text-sm font-semibold text-slate-900'>
                  <input
                    type='checkbox'
                    className='h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30'
                    checked={allSelectableChecked}
                    ref={(node) => {
                      if (node) {
                        node.indeterminate = someSelectableChecked;
                      }
                    }}
                    onChange={(event) =>
                      data.handleSelectAll(event.target.checked)
                    }
                  />
                  <span>{t('全选')}</span>
                </label>
                <div className='text-xs font-medium text-slate-500'>
                  {t('已选择 {{count}} 列', { count: visibleColumns.length })}
                </div>
              </div>

              <div className='grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3'>
                {selectableColumns.map((column) => (
                  <label
                    key={`selector-${column.key}`}
                    className='flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-white'
                  >
                    <input
                      type='checkbox'
                      className='h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30'
                      checked={Boolean(data.visibleColumns?.[column.key])}
                      onChange={(event) =>
                        data.handleColumnVisibilityChange(
                          column.key,
                          event.target.checked,
                        )
                      }
                    />
                    <span className='text-sm font-semibold text-slate-900'>
                      {typeof column.title === 'string'
                        ? column.title
                        : t(String(column.key))}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className='flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-5'>
              <button
                type='button'
                className='rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50'
                onClick={data.initDefaultColumns}
              >
                {t('重置')}
              </button>
              <button
                type='button'
                className='rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50'
                onClick={() => data.setShowColumnSelector(false)}
              >
                {t('取消')}
              </button>
              <button
                type='button'
                className='rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(79,70,229,0.22)] transition-colors hover:bg-primary/90'
                onClick={() => data.setShowColumnSelector(false)}
              >
                {t('确定')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className='flex flex-1 min-h-full min-w-0 w-full flex-col gap-6'>
        <header>
          <h1 className='text-3xl font-bold text-on-surface'>Usage Logs</h1>
          <p className='mt-1 text-on-surface-variant'>
            Monitor API request history and token usage across your organization.
          </p>
        </header>

        <section className='rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm'>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
            <label className='flex min-w-0 flex-col gap-1 xl:col-span-2'>
              <span className='text-xs font-medium text-on-surface-variant'>
                {t('开始时间')}
              </span>
              <input
                type='datetime-local'
                className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                value={filters.from}
                onChange={(event) => updateFilter('from', event.target.value)}
              />
            </label>

            <label className='flex min-w-0 flex-col gap-1'>
              <span className='text-xs font-medium text-on-surface-variant'>
                {t('结束时间')}
              </span>
              <input
                type='datetime-local'
                className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                value={filters.to}
                onChange={(event) => updateFilter('to', event.target.value)}
              />
            </label>

            <label className='flex min-w-0 flex-col gap-1'>
              <span className='text-xs font-medium text-on-surface-variant'>
                {t('令牌名称')}
              </span>
              <input
                className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                placeholder={t('令牌名称')}
                value={filters.token_name}
                onChange={(event) =>
                  updateFilter('token_name', event.target.value)
                }
              />
            </label>

            <label className='flex min-w-0 flex-col gap-1'>
              <span className='text-xs font-medium text-on-surface-variant'>
                {t('模型名称')}
              </span>
              <input
                className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                placeholder={t('模型名称')}
                value={filters.model_name}
                onChange={(event) =>
                  updateFilter('model_name', event.target.value)
                }
              />
            </label>

            {(data.isAdminUser || data.showGroupForNonAdmin) && (
              <label className='flex min-w-0 flex-col gap-1'>
                <span className='text-xs font-medium text-on-surface-variant'>
                  {t('分组')}
                </span>
                <input
                  className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                  placeholder={t('分组')}
                  value={filters.group}
                  onChange={(event) =>
                    updateFilter('group', event.target.value)
                  }
                />
              </label>
            )}

            {(data.isAdminUser || data.showPricingGroupForNonAdmin) && (
              <label className='flex min-w-0 flex-col gap-1'>
                <span className='text-xs font-medium text-on-surface-variant'>
                  {t('定价分组')}
                </span>
                <input
                  className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                  placeholder={t('定价分组')}
                  value={filters.pricing_group}
                  onChange={(event) =>
                    updateFilter('pricing_group', event.target.value)
                  }
                />
              </label>
            )}

            <label className='flex min-w-0 flex-col gap-1'>
              <span className='text-xs font-medium text-on-surface-variant'>
                {t('Request ID')}
              </span>
              <input
                className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                placeholder={t('Request ID')}
                value={filters.request_id}
                onChange={(event) =>
                  updateFilter('request_id', event.target.value)
                }
              />
            </label>

            {data.isAdminUser && (
              <label className='flex min-w-0 flex-col gap-1'>
                <span className='text-xs font-medium text-on-surface-variant'>
                  {t('渠道 ID')}
                </span>
                <input
                  className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                  placeholder={t('渠道 ID')}
                  value={filters.channel}
                  onChange={(event) =>
                    updateFilter('channel', event.target.value)
                  }
                />
              </label>
            )}

            {data.isAdminUser && (
              <label className='flex min-w-0 flex-col gap-1'>
                <span className='text-xs font-medium text-on-surface-variant'>
                  {t('用户名称')}
                </span>
                <input
                  className='w-full min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                  placeholder={t('用户名称')}
                  value={filters.username}
                  onChange={(event) =>
                    updateFilter('username', event.target.value)
                  }
                />
              </label>
            )}
          </div>

          <div className='mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
            <label className='flex min-w-[160px] flex-col gap-1'>
              <span className='text-xs font-medium text-on-surface-variant'>
                {t('日志类型')}
              </span>
              <select
                className='rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                value={filters.logType}
                onChange={(event) => handleLogTypeChange(event.target.value)}
              >
                {STATUS_FILTER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.label)}
                  </option>
                ))}
              </select>
            </label>

            <div className='flex flex-wrap items-center justify-end gap-2'>
              <button
                type='button'
                className='rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container'
                onClick={handleSearch}
                disabled={data.loading}
              >
                {t('查询')}
              </button>

              <button
                type='button'
                className='rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container'
                onClick={handleReset}
                disabled={data.loading}
              >
                {t('重置')}
              </button>

              <button
                type='button'
                className='rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container'
                onClick={() => data.setShowColumnSelector(true)}
              >
                {t('列设置')}
              </button>

              <button
                type='button'
                className='flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60'
                onClick={handleExport}
                disabled={data.loading || (data.logs || []).length === 0}
              >
                <IconDownload size='small' />
                Export
              </button>
            </div>
          </div>
        </section>

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
                  const statusMeta = resolveStatusMeta(log);
                  const latencySeconds = resolveLatencySeconds(log);
                  const latencyClass = getLatencyToneClass(latencySeconds || NaN);
                  const details = data.expandData?.[log.key] || [];
                  const other = getLogOther(log?.other);

                  const requestId =
                    log?.request_id ||
                    other?.request_id ||
                    other?.task_id ||
                    getDetailRecordValue(details, ['request id', '任务id']) ||
                    '-';
                  const channelInfo =
                    `${log?.channel_name || ''}${
                      log?.channel && log?.channel_name
                        ? ` (${log.channel})`
                        : log?.channel || ''
                    }` ||
                    getDetailRecordValue(details, ['渠道']) ||
                    '-';
                  const ipInfo =
                    log?.ip ||
                    getDetailRecordValue(details, ['ip', '地址']) ||
                    '-';

                  const billingProcess = getDetailRecordValue(details, [
                    '计费过程',
                    '日志详情',
                    '订阅结算',
                    '订阅说明',
                  ]);

                  const extraDetails = details.filter((item) => {
                    const key = String(item?.key || '').toLowerCase();
                    return ![
                      'request id',
                      '任务id',
                      '渠道信息',
                      '渠道',
                      'ip',
                      '输入 tokens',
                      '输出 tokens',
                      '计费过程',
                      '日志详情',
                      '订阅结算',
                      '订阅说明',
                    ].some((exclude) => key.includes(exclude));
                  });

                  const billingHint = [
                    toPlainText(billingProcess),
                    ...extraDetails
                      .slice(0, 8)
                      .map(
                        (item) =>
                          `${item?.key || ''}: ${toPlainText(item?.value)}`,
                      ),
                  ]
                    .filter(Boolean)
                    .join('\n');
                  const detailPreviewLines = buildDetailPreviewLines(
                    details,
                    requestId,
                  );
                  const requestPath =
                    getDetailRecordValue(details, ['请求路径', 'request path']) ||
                    '-';
                  const summaryCards = [
                    {
                      label: 'Request ID',
                      value: requestId,
                      tone: 'font-mono',
                    },
                    {
                      label: 'Model',
                      value: log?.model_name || '-',
                    },
                    {
                      label: 'User',
                      value: log?.username || '-',
                    },
                    {
                      label: 'Channel',
                      value: channelInfo,
                    },
                    {
                      label: 'IP Address',
                      value: ipInfo,
                    },
                    {
                      label: 'Request Path',
                      value: requestPath,
                      tone: 'font-mono',
                    },
                  ];
                  const detailRows = details.map((item, index) => {
                    const copyableText = getCopyableText(item?.value);
                    const displayValue = renderDetailValue(item?.value);

                    return {
                      key: item?.key || `detail-${index}`,
                      displayValue,
                      copyableText,
                    };
                  });

                  return (
                    <React.Fragment key={log.key}>
                      <tr
                        className={`cursor-pointer border-b border-outline-variant transition-colors hover:bg-surface-container ${
                          expanded ? 'bg-primary/5' : ''
                        }`}
                        onClick={() =>
                          setExpandedRows((prev) => ({
                            ...prev,
                            [log.key]: !prev[log.key],
                          }))
                        }
                      >
                        <td
                          className={`px-6 py-3 ${expanded ? 'text-primary' : 'text-gray-400'}`}
                        >
                          <button
                            type='button'
                            className={`inline-flex transition-colors ${
                              expanded
                                ? 'text-primary'
                                : 'text-gray-400 hover:text-primary'
                            }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedRows((prev) => ({
                                ...prev,
                                [log.key]: !prev[log.key],
                              }));
                            }}
                          >
                            <IconChevronDown
                              className={`transition-transform ${
                                expanded ? '' : '-rotate-90'
                              }`}
                              size='small'
                            />
                          </button>
                        </td>

                        {visibleColumns.map((column) => (
                          <td
                            key={`${log.key}-${column.key}`}
                            className={`px-4 py-3 align-top ${
                              column.key === data.COLUMN_KEYS.DETAILS
                                ? 'max-w-[320px]'
                                : ''
                            }`}
                            title={
                              column.key === data.COLUMN_KEYS.COST
                                ? billingHint || undefined
                                : undefined
                            }
                          >
                            {column.render(log, rowIndex)}
                          </td>
                        ))}

                        <td className='px-4 py-3 text-right'>
                          <button
                            type='button'
                            className='rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container'
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedRows((prev) => ({
                                ...prev,
                                [log.key]: !prev[log.key],
                              }));
                            }}
                          >
                            {expanded ? t('收起详情') : t('查看详情')}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className='border-b border-outline-variant bg-surface-container-lowest'>
                          <td className='px-16 py-6' colSpan={detailColSpan}>
                            <div className='space-y-5'>
                              <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
                                {summaryCards.map((card) => {
                                  const valueText = getCopyableText(card.value);
                                  return (
                                    <div key={`${log.key}-${card.label}`}>
                                      <div className='mb-2 text-[10px] font-bold uppercase text-gray-400'>
                                        {card.label}
                                      </div>
                                      <div
                                        className={`flex items-center justify-between rounded border border-gray-100 bg-gray-50 p-2 text-xs ${card.tone || ''}`}
                                      >
                                        <span className='min-w-0 break-all pr-2'>
                                          {renderDetailValue(card.value)}
                                        </span>
                                        {valueText ? (
                                          <button
                                            type='button'
                                            className='inline-flex shrink-0 text-gray-500 transition-colors hover:text-primary'
                                            onClick={() => handleCopy(valueText)}
                                            aria-label={`copy ${card.label.toLowerCase()}`}
                                          >
                                            <IconCopy size='small' />
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}

                                <div>
                                  <div className='mb-2 text-[10px] font-bold uppercase text-gray-400'>
                                    Token Breakdown
                                  </div>
                                  <div className='flex items-center gap-4 rounded border border-gray-100 bg-gray-50 p-2 text-xs'>
                                    <div>
                                      <span className='text-gray-400'>
                                        Prompt:
                                      </span>{' '}
                                      {renderNumber(log?.prompt_tokens || 0)}
                                    </div>
                                    <div>
                                      <span className='text-gray-400'>
                                        Completion:
                                      </span>{' '}
                                      {renderNumber(log?.completion_tokens || 0)}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <div className='mb-2 text-[10px] font-bold uppercase text-gray-400'>
                                    Preview
                                  </div>
                                  <div className='rounded border border-gray-100 bg-gray-50 p-2 text-xs text-on-surface-variant'>
                                    {detailPreviewLines.length > 0
                                      ? detailPreviewLines.join('\n')
                                      : '-'}
                                  </div>
                                </div>

                                <div>
                                  <div className='mb-2 text-[10px] font-bold uppercase text-gray-400'>
                                    Runtime
                                  </div>
                                  <div className='rounded border border-gray-100 bg-gray-50 p-2 text-xs'>
                                    <div
                                      className={`flex items-center gap-1 font-medium ${latencyClass}`}
                                    >
                                      <span className='h-1.5 w-1.5 rounded-full bg-current'></span>
                                      {Number.isFinite(latencySeconds)
                                        ? `${latencySeconds.toFixed(1)}s`
                                        : '-'}
                                    </div>
                                    <div className='mt-2'>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${statusMeta.className}`}
                                      >
                                        {statusMeta.label}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {details.length > 0 && (
                                <div className='usage-log-detail-panel rounded-lg border border-outline-variant bg-surface-container-low p-4'>
                                  <div className='mb-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant'>
                                    Full Details
                                  </div>
                                  <div className='usage-log-detail-list'>
                                    {detailRows.map((item) => (
                                      <div
                                        key={`${log.key}-${item.key}`}
                                        className='usage-log-detail-row'
                                      >
                                        <div className='usage-log-detail-key'>
                                          {item.key}
                                        </div>
                                        <div className='usage-log-detail-value'>
                                          {item.displayValue}
                                        </div>
                                        {item.copyableText ? (
                                          <button
                                            type='button'
                                            className='usage-log-detail-copy'
                                            aria-label={`copy ${item.key}`}
                                            onClick={() =>
                                              handleCopy(item.copyableText)
                                            }
                                          >
                                            <IconCopy size='small' />
                                          </button>
                                        ) : (
                                          <span className='usage-log-detail-copy-placeholder' />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
