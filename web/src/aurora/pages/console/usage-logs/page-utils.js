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
import {
  getLogOther,
  renderNumber,
  timestamp2string,
} from '../../../../helpers';

export const STATUS_FILTER_OPTIONS = [
  { value: '0', label: '全部' },
  { value: '1', label: '充值' },
  { value: '2', label: '消费' },
  { value: '3', label: '管理' },
  { value: '4', label: '系统' },
  { value: '5', label: '错误' },
  { value: '6', label: '退款' },
];

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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

const padTimePart = (value) => String(value).padStart(2, '0');

const formatDateTimeLocal = (date) => {
  const year = date.getFullYear();
  const month = padTimePart(date.getMonth() + 1);
  const day = padTimePart(date.getDate());
  const hours = padTimePart(date.getHours());
  const minutes = padTimePart(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

const isSameDay = (d1, d2) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const hashString = (value) => {
  const input = String(value || '');
  let hash = 0;
  for (let index = 0; index < input.length; index++) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const toQueryDateTimeValue = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const normalized = text.replace('T', ' ');
  return normalized.length === 16 ? `${normalized}:00` : normalized;
};

export const buildInitialFilters = (formInitValues) => {
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

export const formatRelativeTime = (createdAt) => {
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

export const resolveLatencySeconds = (log) => {
  const parsed = Number(log?.use_time);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed > 1000 ? parsed / 1000 : parsed;
};

export const getLatencyToneClass = (latency) => {
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

export const resolveStatusMeta = (log) => {
  if (Number(log?.type) === 5) {
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

export const getModelIconClass = (modelName) =>
  MODEL_ICON_CLASSES[hashString(modelName) % MODEL_ICON_CLASSES.length];

export const getModelInitial = (modelName) => {
  const text = String(modelName || '').trim();
  if (!text) {
    return '-';
  }
  return text.charAt(0).toUpperCase();
};

export const getDetailRecordValue = (details, keywords) => {
  const lowered = keywords.map((item) => String(item).toLowerCase());
  const matched = details.find((item) => {
    const key = String(item?.key || '').toLowerCase();
    return lowered.some((target) => key.includes(target));
  });
  return matched ? matched.value : null;
};

export const renderDetailValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (React.isValidElement(value)) {
    return value;
  }
  return String(value);
};

export const toPlainText = (value) => {
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

export const normalizePreviewText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

export const getCopyableText = (value) => {
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

export const buildDetailPreviewLines = (details, requestId) => {
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

export const buildPaginationItems = (currentPage, totalPages) => {
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
  for (let index = 0; index < sorted.length; index++) {
    if (index > 0 && sorted[index] - sorted[index - 1] > 1) {
      result.push('ellipsis');
    }
    result.push(sorted[index]);
  }
  return result;
};

export const escapeCsvCell = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const normalized = String(value).replaceAll('"', '""');
  return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
};

export const isUsageDisplayType = (type) =>
  [0, 2, 5, 6].includes(Number.parseInt(type, 10));

export const getShortLabel = (value, fallback = '-') => {
  const text = String(value || '').trim();
  if (!text) {
    return fallback;
  }
  return text.slice(0, 2);
};

export const getLogTypeMeta = (type, t) => {
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

export const getPromptCacheSummary = (other, t) => {
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

export const getRetryText = (log) => {
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
