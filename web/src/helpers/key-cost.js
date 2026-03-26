import { TOP_N_MODELS } from '../constants/key-cost.constants';

/**
 * Convert raw quota integer to a numeric USD value.
 * Uses the same `quota_per_unit` value stored by the app in localStorage,
 * consistent with `renderQuota` in helpers/render.jsx.
 *
 * @param {number} quota - Raw quota integer from the API.
 * @param {number} [digits=4] - Decimal places to keep.
 * @returns {number} USD equivalent (numeric, not formatted string).
 */
export function formatQuotaToUSD(quota, digits = 4) {
  if (typeof quota !== 'number' || isNaN(quota)) return 0;
  let quotaPerUnit = parseFloat(localStorage.getItem('quota_per_unit'));
  if (!quotaPerUnit || isNaN(quotaPerUnit)) {
    // Fallback: the default used across the codebase is 500000
    quotaPerUnit = 500000;
  }
  return parseFloat((quota / quotaPerUnit).toFixed(digits));
}

/**
 * Format a USD numeric value into a display string with the currency symbol.
 * Respects the user's quota_display_type setting (USD / CNY / CUSTOM / TOKENS).
 * For simple utility usage we default to "$X.XX".
 *
 * @param {number} usd - Dollar amount.
 * @param {number} [digits=2] - Decimal places.
 * @returns {string} Formatted string, e.g. "$1.23".
 */
export function formatUSDDisplay(usd, digits = 2) {
  if (typeof usd !== 'number' || isNaN(usd)) return '$0.00';
  return '$' + usd.toFixed(digits);
}

/**
 * Aggregate an array of TokenSummary records by token_id.
 * Each record is expected to have at least:
 *   { token_id, token_name, model_name, total_quota, request_count, prompt_tokens, completion_tokens, time_bucket }
 *
 * @param {Array} data - Raw TokenSummary array from the API.
 * @returns {Map<number, object>} Map keyed by token_id with summed values.
 */
export function aggregateByToken(data) {
  const map = new Map();
  for (const item of data) {
    const id = item.token_id;
    if (!map.has(id)) {
      map.set(id, {
        token_id: id,
        token_name: item.token_name || '',
        total_quota: 0,
        request_count: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
      });
    }
    const agg = map.get(id);
    agg.total_quota += item.total_quota || 0;
    agg.request_count += item.request_count || 0;
    agg.prompt_tokens += item.prompt_tokens || 0;
    agg.completion_tokens += item.completion_tokens || 0;
  }
  return map;
}

/**
 * Aggregate an array of TokenSummary records by model_name.
 * Useful for pie charts and ranking bars.
 *
 * @param {Array} data - Raw TokenSummary array.
 * @param {number} [topN=TOP_N_MODELS] - Keep top N models, rest grouped as "Other".
 * @returns {Array<{model: string, quota: number, count: number, tokens: number}>}
 */
export function aggregateByModel(data, topN = TOP_N_MODELS) {
  const map = new Map();
  for (const item of data) {
    const model = item.model_name || 'unknown';
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
 * Groups all models into per-bucket totals AND per-bucket-per-model breakdowns.
 *
 * @param {Array} data - Raw TokenSummary array.
 * @returns {{ totals: Array, byModel: Map<string, Array> }}
 *   - totals: array of { time_bucket, quota, count, tokens } sorted by time_bucket.
 *   - byModel: Map<model_name, Array<{ time_bucket, quota, count, tokens }>> for multi-line charts.
 */
export function aggregateByTimeBucket(data) {
  const totalMap = new Map();
  const modelMap = new Map(); // model -> Map<time_bucket, agg>

  for (const item of data) {
    const tb = item.time_bucket || '';
    const model = item.model_name || 'unknown';

    // Totals
    if (!totalMap.has(tb)) {
      totalMap.set(tb, { time_bucket: tb, quota: 0, count: 0, tokens: 0 });
    }
    const tot = totalMap.get(tb);
    tot.quota += item.total_quota || 0;
    tot.count += item.request_count || 0;
    tot.tokens += (item.prompt_tokens || 0) + (item.completion_tokens || 0);

    // By model
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

  // Convert inner maps to sorted arrays
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

/**
 * Calculate the percentage change between a current and a previous value.
 *
 * @param {number} current - Current period value.
 * @param {number} previous - Previous period value.
 * @returns {number|null} Percentage change (e.g. 12.5 for +12.5%), or null if previous is 0.
 */
export function calcChangePercent(current, previous) {
  if (typeof current !== 'number' || typeof previous !== 'number') return null;
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return parseFloat((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}
