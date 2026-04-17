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

const INVALID_TEXT_VALUES = new Set(['nan', 'na', 'n/a', 'null', 'undefined']);

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const trimText = (value) => String(value ?? '').trim();

const toFiniteNumber = (value) => {
  const numericValue =
    typeof value === 'number' ? value : Number.parseFloat(trimText(value));
  return Number.isFinite(numericValue) ? numericValue : null;
};

/**
 * 统一清洗渠道页展示值，避免 NaN / NA 泄漏到 UI。
 * @param {unknown} value - 原始展示值
 * @param {string} [fallback='—'] - 兜底占位
 * @returns {string}
 */
export function sanitizeChannelMetricValue(value, fallback = '—') {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }

  const normalized = trimText(value);
  if (!normalized) {
    return fallback;
  }

  return INVALID_TEXT_VALUES.has(normalized.toLowerCase())
    ? fallback
    : normalized;
}

const buildHealthValue = (channels) => {
  const total = Array.isArray(channels) ? channels.length : 0;
  const enabled = (channels || []).filter(
    (channel) => Number(channel?.status) === 1,
  ).length;
  return `${enabled} / ${total}`;
};

const buildBalanceValue = (channels) => {
  const totalBalance = (channels || []).reduce((sum, channel) => {
    const balance = toFiniteNumber(channel?.balance);
    return balance === null ? sum : sum + balance;
  }, 0);

  return totalBalance > 0 ? USD_FORMATTER.format(totalBalance) : '—';
};

const buildLatencyValue = (channels, t) => {
  const finiteResponseTimes = (channels || [])
    .map((channel) => toFiniteNumber(channel?.response_time))
    .filter((value) => value !== null && value > 0);

  if (finiteResponseTimes.length === 0) {
    return '—';
  }

  const averageSeconds =
    finiteResponseTimes.reduce((sum, value) => sum + value, 0) /
    finiteResponseTimes.length /
    1000;
  return `${averageSeconds.toFixed(2)} ${t('秒')}`;
};

/**
 * 构建 Aurora 渠道页顶部统计卡片。
 * @param {{channels: unknown[], t: (value: string) => string}} params - 构建参数
 * @returns {{id: string, value: string}[]}
 */
export function buildChannelSummaryCards({ channels, t }) {
  return [
    {
      id: 'health',
      value: buildHealthValue(channels),
    },
    {
      id: 'balance',
      value: buildBalanceValue(channels),
    },
    {
      id: 'latency',
      value: buildLatencyValue(channels, t),
    },
  ];
}

const getMultiKeyDetail = (channelInfo) => {
  const total = Number(channelInfo?.multi_key_size);
  if (!Number.isFinite(total) || total <= 0) {
    return '';
  }

  const disabledCount = Object.keys(
    channelInfo?.multi_key_status_list || {},
  ).length;
  const enabledCount = Math.max(total - disabledCount, 0);
  return `${enabledCount}/${total}`;
};

/**
 * 保留旧版渠道状态语义，供 Aurora 页面渲染。
 * @param {{status: unknown, channel_info?: Record<string, unknown>, t: (value: string) => string}} channel - 渠道数据
 * @returns {{label: string, detail: string, tone: string}}
 */
export function buildChannelStatusMeta(channel) {
  const { status, channel_info: channelInfo, t } = channel;
  const statusValue = Number(status);
  const detail = channelInfo?.is_multi_key
    ? getMultiKeyDetail(channelInfo)
    : '';

  if (statusValue === 1) {
    return { label: t('已启用'), detail, tone: 'success' };
  }
  if (statusValue === 2) {
    return { label: t('已禁用'), detail, tone: 'danger' };
  }
  if (statusValue === 3) {
    return { label: t('自动禁用'), detail, tone: 'warning' };
  }
  return { label: t('未知状态'), detail, tone: 'muted' };
}

/**
 * 将渠道余额格式化为稳定展示值。
 * @param {unknown} value - 原始余额
 * @returns {string}
 */
export function formatChannelBalance(value) {
  const balance = toFiniteNumber(value);
  return balance === null ? '—' : USD_FORMATTER.format(balance);
}

/**
 * 将渠道延迟格式化为稳定展示值。
 * @param {unknown} value - 原始延迟，单位毫秒
 * @param {(value: string) => string} t - 国际化函数
 * @returns {string}
 */
export function formatChannelLatency(value, t) {
  const latency = toFiniteNumber(value);
  if (latency === null || latency <= 0) {
    return '—';
  }
  return `${(latency / 1000).toFixed(2)} ${t('秒')}`;
}

/**
 * 扁平化标签聚合与普通渠道行，供 Aurora 表格渲染。
 * @param {unknown[]} channels - hook 输出的渠道列表
 * @returns {Record<string, unknown>[]}
 */
export function flattenChannelRows(channels) {
  return (channels || []).flatMap((channel) => {
    if (!Array.isArray(channel?.children)) {
      return [{ ...channel, _depth: 0, _isTagGroup: false }];
    }

    const groupRow = {
      ...channel,
      _depth: 0,
      _isTagGroup: true,
    };
    const childRows = channel.children.map((child) => ({
      ...child,
      _depth: 1,
      _isTagGroup: false,
      _parentTag: channel.tag || '',
    }));
    return [groupRow, ...childRows];
  });
}
