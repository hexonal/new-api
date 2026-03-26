import { useMemo } from 'react';
import { renderNumber } from '../../helpers';
import {
  formatQuotaToUSD,
  formatUSDDisplay,
  aggregateByTimeBucket,
} from '../../helpers/key-cost';
import { COMPARE_COLORS } from '../../constants/key-cost.constants';

/**
 * Build VChart specs for the multi-Key comparison view.
 *
 * @param {Map<number, Array>} compareData - Map<token_id, TokenSummary[]>.
 * @param {string} activeMetric - 'cost' | 'requests' | 'tokens'.
 * @param {string} granularity - 'day' | 'week' | 'month'.
 * @param {Function} t - i18next translation function.
 * @param {Array} tokens - Full token list (to resolve token_name from id).
 * @returns {{ specMultiLine: object, compareStats: Array }}
 */
export const useKeyCompareCharts = (
  compareData,
  activeMetric,
  granularity,
  t,
  tokens = [],
) => {
  // Build a lookup map for token_id -> token_name
  const tokenNameMap = useMemo(() => {
    const map = new Map();
    for (const tok of tokens) {
      map.set(tok.id, tok.name || `Key #${tok.id}`);
    }
    return map;
  }, [tokens]);

  // ========== Metric config ==========
  const metricConfig = useMemo(
    () => ({
      cost: {
        label: t('成本'),
        yField: 'Value',
        formatter: (v) => formatUSDDisplay(v),
        extractor: (bucket) => formatQuotaToUSD(bucket.quota),
      },
      requests: {
        label: t('请求次数'),
        yField: 'Value',
        formatter: (v) => renderNumber(v),
        extractor: (bucket) => bucket.count,
      },
      tokens: {
        label: t('Token 消耗'),
        yField: 'Value',
        formatter: (v) => renderNumber(v),
        extractor: (bucket) => bucket.tokens,
      },
    }),
    [t],
  );

  const metric = metricConfig[activeMetric] || metricConfig.cost;

  // ========== Per-key aggregation ==========
  const perKeyAgg = useMemo(() => {
    const result = [];
    let colorIdx = 0;

    for (const [tokenId, records] of compareData) {
      const { totals } = aggregateByTimeBucket(records);
      const name =
        tokenNameMap.get(tokenId) || `Key #${tokenId}`;
      const color = COMPARE_COLORS[colorIdx % COMPARE_COLORS.length];
      colorIdx++;

      result.push({ tokenId, name, color, totals, records });
    }

    return result;
  }, [compareData, tokenNameMap]);

  // ========== Multi-line spec ==========
  const specMultiLine = useMemo(() => {
    const values = [];
    const colorSpec = {};

    for (const { name, color, totals } of perKeyAgg) {
      colorSpec[name] = color;
      for (const b of totals) {
        values.push({
          Time: b.time_bucket,
          Key: name,
          Value: metric.extractor(b),
        });
      }
    }

    return {
      type: 'line',
      data: [{ id: 'compareLineData', values }],
      xField: 'Time',
      yField: 'Value',
      seriesField: 'Key',
      legends: { visible: true },
      title: {
        visible: true,
        text: `${t('Key 对比')} - ${metric.label}`,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['Key'],
              value: (datum) => metric.formatter(datum['Value']),
            },
          ],
        },
      },
      point: { visible: true, size: 4 },
      line: { style: { lineWidth: 2 } },
      color: { specified: colorSpec },
    };
  }, [perKeyAgg, metric, t]);

  // ========== Per-key summary stats ==========
  const compareStats = useMemo(() => {
    return perKeyAgg.map(({ tokenId, name, color, records }) => {
      let totalQuota = 0;
      let totalRequests = 0;
      let totalTokens = 0;

      for (const item of records) {
        totalQuota += item.total_quota || 0;
        totalRequests += item.request_count || 0;
        totalTokens +=
          (item.prompt_tokens || 0) + (item.completion_tokens || 0);
      }

      return {
        tokenId,
        name,
        color,
        cost: formatUSDDisplay(formatQuotaToUSD(totalQuota)),
        requests: totalRequests,
        tokens: totalTokens,
        avgCost: formatUSDDisplay(
          totalRequests > 0
            ? formatQuotaToUSD(totalQuota / totalRequests)
            : 0,
          4,
        ),
      };
    });
  }, [perKeyAgg]);

  return {
    specMultiLine,
    compareStats,
  };
};
