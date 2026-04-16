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
import { TOP_N_MODELS } from '../constants/key-cost.constants';
import { getQuotaWithUnit, renderQuotaNumberWithDigit } from './render';

function normalizeChartCategory(value, fallback = 'unknown') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? fallback : value.toISOString();
  }
  try {
    const str = String(value);
    return str && str !== '[object Object]' ? str : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Return a default date range of [7 days ago, now].
 */
export function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return [start, end];
}

/**
 * Convert raw quota integer to a numeric value (respects quota_per_unit).
 * Re-exports logic from render.jsx's getQuotaWithUnit for consistency.
 */
export function quotaToNumeric(quota, digits = 4) {
  const parsedQuota = Number(quota);
  if (!Number.isFinite(parsedQuota)) return 0;
  return parseFloat(getQuotaWithUnit(parsedQuota, digits));
}

/**
 * Format a numeric quota value to display string with correct currency symbol.
 * Respects user's quota_display_type (USD/CNY/CUSTOM/TOKENS).
 * Re-exports logic from render.jsx's renderQuotaNumberWithDigit.
 */
export function formatQuotaDisplay(num, digits = 2) {
  if (typeof num !== 'number' || isNaN(num)) {
    return renderQuotaNumberWithDigit(0, digits);
  }
  return renderQuotaNumberWithDigit(num, digits);
}

/**
 * Aggregate an array of TokenSummary records by model_name.
 */
export function aggregateByModel(data, topN = TOP_N_MODELS) {
  const map = new Map();
  for (const item of data) {
    const model = normalizeChartCategory(item.model_name, 'unknown');
    const quota = Number(item.total_quota ?? 0) || 0;
    const count = Number(item.request_count ?? 0) || 0;
    const promptTokens = Number(item.prompt_tokens ?? 0) || 0;
    const completionTokens = Number(item.completion_tokens ?? 0) || 0;
    if (!map.has(model)) {
      map.set(model, { model, quota: 0, count: 0, tokens: 0 });
    }
    const agg = map.get(model);
    agg.quota += quota;
    agg.count += count;
    agg.tokens += promptTokens + completionTokens;
  }

  const sorted = Array.from(map.values()).sort((a, b) => b.quota - a.quota);
  if (sorted.length <= topN) return sorted;

  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const other = rest.reduce(
    (acc, item) => {
      acc.quota += item.quota;
      acc.count += item.count;
      acc.tokens += item.tokens;
      return acc;
    },
    { model: 'Other', quota: 0, count: 0, tokens: 0 },
  );
  top.push(other);
  return top;
}

/**
 * Aggregate an array of TokenSummary records by time_bucket.
 */
export function aggregateByTimeBucket(data) {
  const totalMap = new Map();
  const modelMap = new Map();

  for (const item of data) {
    const tb = normalizeChartCategory(item.time_bucket, '');
    const model = normalizeChartCategory(item.model_name, 'unknown');
    const quota = Number(item.total_quota ?? 0) || 0;
    const count = Number(item.request_count ?? 0) || 0;
    const promptTokens = Number(item.prompt_tokens ?? 0) || 0;
    const completionTokens = Number(item.completion_tokens ?? 0) || 0;

    if (!totalMap.has(tb)) {
      totalMap.set(tb, { time_bucket: tb, quota: 0, count: 0, tokens: 0 });
    }
    const tot = totalMap.get(tb);
    tot.quota += quota;
    tot.count += count;
    tot.tokens += promptTokens + completionTokens;

    if (!modelMap.has(model)) {
      modelMap.set(model, new Map());
    }
    const mBuckets = modelMap.get(model);
    if (!mBuckets.has(tb)) {
      mBuckets.set(tb, { time_bucket: tb, quota: 0, count: 0, tokens: 0 });
    }
    const mAgg = mBuckets.get(tb);
    mAgg.quota += quota;
    mAgg.count += count;
    mAgg.tokens += promptTokens + completionTokens;
  }

  const totals = Array.from(totalMap.values()).sort((a, b) =>
    a.time_bucket.localeCompare(b.time_bucket),
  );

  const byModel = new Map();
  for (const [model, bucketsMap] of modelMap) {
    byModel.set(
      model,
      Array.from(bucketsMap.values()).sort((a, b) =>
        a.time_bucket.localeCompare(b.time_bucket),
      ),
    );
  }

  return { totals, byModel };
}
