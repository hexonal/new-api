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

export const CALLBACK_STATUS_META = {
  pending: {
    labelKey: '待处理',
    badgeClassName: 'bg-slate-100 text-slate-700',
    progressClassName: 'bg-slate-400',
  },
  processing: {
    labelKey: '处理中',
    badgeClassName: 'bg-sky-100 text-sky-700',
    progressClassName: 'bg-sky-500',
  },
  retry_wait: {
    labelKey: '重试等待',
    badgeClassName: 'bg-amber-100 text-amber-700',
    progressClassName: 'bg-amber-500',
  },
  succeeded: {
    labelKey: '成功',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
    progressClassName: 'bg-emerald-500',
  },
  dead: {
    labelKey: '失败',
    badgeClassName: 'bg-rose-100 text-rose-700',
    progressClassName: 'bg-rose-500',
  },
  cancelled: {
    labelKey: '已取消',
    badgeClassName: 'bg-slate-100 text-slate-600',
    progressClassName: 'bg-slate-400',
  },
};

export const CALLBACK_SOURCE_META = {
  consume: {
    labelKey: '消费回调',
    className: 'bg-indigo-50 text-indigo-600',
  },
  operator: {
    labelKey: '运营回调',
    className: 'bg-violet-50 text-violet-600',
  },
  feishu: {
    labelKey: '飞书通知',
    className: 'bg-orange-50 text-orange-600',
  },
  user_points_guard: {
    labelKey: '积分预扣校验',
    className: 'bg-cyan-50 text-cyan-700',
  },
};

const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 3600;
const DAY_IN_SECONDS = 86400;

/**
 * 将秒级时间戳格式化为标准日期时间。
 * @param {number} timestamp - 秒级时间戳。
 * @returns {string}
 */
function timestampToString(timestamp) {
  const date = new Date(timestamp * 1000);
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  const second = `${date.getSeconds()}`.padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * 规范化时间戳。
 * @param {number|string} value - 原始时间值。
 * @returns {number | null}
 */
export function normalizeTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  if (numeric > 9999999999) {
    return Math.floor(numeric / 1000);
  }
  return Math.floor(numeric);
}

/**
 * 格式化绝对时间。
 * @param {number|string} value - 原始时间值。
 * @returns {string}
 */
export function formatCallbackTimestamp(value) {
  const normalized = normalizeTimestamp(value);
  if (!normalized) {
    return '-';
  }
  return timestampToString(normalized);
}

/**
 * 导出回调日志为 CSV。
 * @param {Array<Record<string, unknown>>} events - 回调日志列表。
 */
export function exportCallbackEvents(events) {
  const rows = [
    [
      'Created Time',
      'Source',
      'Status',
      'Request ID',
      'Target SK',
      'User',
      'HTTP',
      'Response',
    ],
    ...(Array.isArray(events) ? events : []).map((event) => [
      formatCallbackTimestamp(event.created_at),
      event.source || '-',
      event.status || '-',
      event.request_id || '-',
      event.token_sk || event.token_sk_masked || '-',
      event.username || '-',
      event.last_http_status || '-',
      event.last_error ||
        event.last_response_body ||
        event.response_body ||
        '-',
    ]),
  ];

  const csvText = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','),
    )
    .join('\n');
  const blob = new Blob([`\uFEFF${csvText}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `callback-logs-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 格式化相对时间。
 * @param {number|string} value - 原始时间值。
 * @param {string} fallback - 回退文案。
 * @returns {string}
 */
export function formatRelativeTime(value, fallback = '-') {
  const normalized = normalizeTimestamp(value);
  if (!normalized) {
    return fallback;
  }

  const diff = Math.max(0, Math.floor(Date.now() / 1000) - normalized);
  if (diff < MINUTE_IN_SECONDS) {
    return 'Just now';
  }
  if (diff < HOUR_IN_SECONDS) {
    return `${Math.floor(diff / MINUTE_IN_SECONDS)} min ago`;
  }
  if (diff < DAY_IN_SECONDS) {
    return `${Math.floor(diff / HOUR_IN_SECONDS)} hour ago`;
  }
  return `${Math.floor(diff / DAY_IN_SECONDS)} day ago`;
}

/**
 * 计算重试进度文本。
 * @param {Record<string, unknown>} event - 日志记录。
 * @returns {string}
 */
export function formatRetryProgress(event) {
  const attemptCount = Number(event?.attempt_count || 0);
  const maxRetries = Number(event?.max_retries || 0);
  return `${attemptCount}/${Math.max(maxRetries + 1, 1)}`;
}

/**
 * 判断 HTTP 状态是否为成功态。
 * @param {number|string} value - HTTP 状态码。
 * @returns {boolean}
 */
export function isSuccessfulHttpStatus(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 200 && numeric < 300;
}

/**
 * 判断回调记录当前是否允许手动重试。
 * @param {Record<string, unknown>} event - 回调事件。
 * @returns {boolean}
 */
export function canRetryCallbackEvent(event) {
  if (!event?.id) {
    return false;
  }

  const status = String(event.status || '').trim();
  if (status === 'succeeded' || status === 'cancelled') {
    return false;
  }

  return !isSuccessfulHttpStatus(event.last_http_status);
}

/**
 * 返回手动重试被禁用的原因。
 * @param {Record<string, unknown>} event - 回调事件。
 * @returns {string}
 */
export function getRetryDisabledReason(event) {
  if (!event?.id) {
    return '无效的回调事件';
  }
  if (isSuccessfulHttpStatus(event?.last_http_status)) {
    return 'HTTP 200-299 的成功回调禁止重试';
  }

  const status = String(event?.status || '').trim();
  if (status === 'succeeded') {
    return '成功状态的回调禁止重试';
  }
  if (status === 'cancelled') {
    return '已取消的回调禁止重试';
  }
  return '';
}

/**
 * 格式化耗时。
 * @param {number|string} startedAt - 开始时间。
 * @param {number|string} finishedAt - 结束时间。
 * @returns {string}
 */
export function formatDuration(startedAt, finishedAt) {
  const start = normalizeTimestamp(startedAt);
  const end = normalizeTimestamp(finishedAt);
  if (!start || !end || end < start) {
    return '-';
  }
  return `${end - start}s`;
}

/**
 * 规范化 JSON 文本块。
 * @param {unknown} value - 原始内容。
 * @returns {string}
 */
export function formatJSONBlock(value) {
  if (value == null) {
    return '-';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '-';
    }
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * 计算页面统计卡。
 * @param {Array<Record<string, unknown>>} events - 当前页日志。
 * @returns {Array<{key:string,value:string,labelKey:string,delta:string,progress:number,progressClassName:string}>}
 */
export function buildCallbackStats(events) {
  const safeEvents = Array.isArray(events) ? events : [];
  const total = safeEvents.length;
  const successCount = safeEvents.filter(
    (item) => item.status === 'succeeded',
  ).length;
  const failedCount = safeEvents.filter(
    (item) => item.status === 'dead',
  ).length;
  const activeHooks = new Set(
    safeEvents
      .map((item) => String(item.callback_url || item.source || ''))
      .filter(Boolean),
  ).size;

  const latencyValues = safeEvents
    .map((item) =>
      Number(item.latency_ms || item.last_latency_ms || item.duration_ms || 0),
    )
    .filter((value) => Number.isFinite(value) && value > 0);

  const avgLatency = latencyValues.length
    ? Math.round(
        latencyValues.reduce((sum, value) => sum + value, 0) /
          latencyValues.length,
      )
    : 0;
  const successRate =
    total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0;

  return [
    {
      key: 'successRate',
      labelKey: '成功率',
      value: `${successRate}%`,
      delta: `${successCount}/${Math.max(total, 1)}`,
      progress: successRate,
      progressClassName: 'bg-emerald-500',
    },
    {
      key: 'failureCount',
      labelKey: '失败数',
      value: `${failedCount}`,
      delta: total ? `${Math.round((failedCount / total) * 100)}%` : '0%',
      progress: total
        ? Math.min(100, Math.round((failedCount / total) * 100))
        : 0,
      progressClassName: 'bg-rose-500',
    },
    {
      key: 'avgLatency',
      labelKey: '平均延迟',
      value: avgLatency ? `${avgLatency}ms` : '-',
      delta: latencyValues.length ? 'Measured' : 'No data',
      progress: avgLatency ? Math.min(100, Math.round(avgLatency / 10)) : 0,
      progressClassName: 'bg-indigo-500',
    },
    {
      key: 'activeHooks',
      labelKey: '活跃 Hook',
      value: `${activeHooks}`,
      delta: total ? `${total} logs` : 'No logs',
      progress: total ? Math.min(100, activeHooks * 10) : 0,
      progressClassName: 'bg-indigo-500',
    },
  ];
}

/**
 * 获取状态元信息。
 * @param {string} status - 状态值。
 * @returns {{labelKey:string,badgeClassName:string,progressClassName:string}}
 */
export function getCallbackStatusMeta(status) {
  return CALLBACK_STATUS_META[status] || CALLBACK_STATUS_META.pending;
}

/**
 * 获取来源元信息。
 * @param {string} source - 来源值。
 * @returns {{labelKey:string,className:string}}
 */
export function getCallbackSourceMeta(source) {
  return (
    CALLBACK_SOURCE_META[source] || {
      labelKey: source || '-',
      className: 'bg-slate-100 text-slate-700',
    }
  );
}

/**
 * 构建分页按钮序列。
 * @param {number} currentPage - 当前页。
 * @param {number} totalPages - 总页数。
 * @returns {Array<number|string>}
 */
export function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis-left', currentPage, 'ellipsis-right', totalPages];
}
