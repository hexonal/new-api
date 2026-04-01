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
  if (typeof quota !== 'number' || isNaN(quota)) return 0;
  return parseFloat(getQuotaWithUnit(quota, digits));
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
    if (!map.has(model)) {
      map.set(model, { model, quota: 0, count: 0, tokens: 0 });
    }
    const agg = map.get(model);
    agg.quota += item.total_quota || 0;
    agg.count += item.request_count || 0;
    agg.tokens += (item.prompt_tokens || 0) + (item.completion_tokens || 0);
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

    if (!totalMap.has(tb)) {
      totalMap.set(tb, { time_bucket: tb, quota: 0, count: 0, tokens: 0 });
    }
    const tot = totalMap.get(tb);
    tot.quota += item.total_quota || 0;
    tot.count += item.request_count || 0;
    tot.tokens += (item.prompt_tokens || 0) + (item.completion_tokens || 0);

    if (!modelMap.has(model)) {
      modelMap.set(model, new Map());
    }
    const mBuckets = modelMap.get(model);
    if (!mBuckets.has(tb)) {
      mBuckets.set(tb, { time_bucket: tb, quota: 0, count: 0, tokens: 0 });
    }
    const mAgg = mBuckets.get(tb);
    mAgg.quota += item.total_quota || 0;
    mAgg.count += item.request_count || 0;
    mAgg.tokens += (item.prompt_tokens || 0) + (item.completion_tokens || 0);
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
