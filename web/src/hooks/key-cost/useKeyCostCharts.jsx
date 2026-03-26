import { useMemo } from 'react';
import { renderQuota, renderNumber, modelColorMap } from '../../helpers';
import {
  aggregateByModel,
  aggregateByTimeBucket,
  formatQuotaToUSD,
  formatUSDDisplay,
} from '../../helpers/key-cost';
import { TOP_N_MODELS } from '../../constants/key-cost.constants';

/**
 * Generate VChart specs for the Key Cost Analysis dashboard.
 *
 * Follows the same VChart spec structure used in useDashboardCharts.jsx:
 * each spec is a plain object with { type, data, xField, yField, ... }.
 *
 * @param {Array} summaryData - TokenSummary records.
 * @param {string} granularity - 'day' | 'week' | 'month'.
 * @param {Function} t - i18next translation function.
 * @returns {{ specCostLine, specRequestLine, specTokenLine, specPie, specRankBar }}
 */
export const useKeyCostCharts = (summaryData, granularity, t) => {
  // ========== Shared aggregations ==========
  const { totals, byModel } = useMemo(
    () => aggregateByTimeBucket(summaryData),
    [summaryData],
  );

  const modelAgg = useMemo(
    () => aggregateByModel(summaryData, TOP_N_MODELS),
    [summaryData],
  );

  // ========== Cost trend line (multi-model) ==========
  const specCostLine = useMemo(() => {
    const values = [];
    for (const [model, buckets] of byModel) {
      for (const b of buckets) {
        values.push({
          Time: b.time_bucket,
          Model: model,
          Cost: formatQuotaToUSD(b.quota),
        });
      }
    }

    const totalCost = totals.reduce((s, b) => s + b.quota, 0);

    return {
      type: 'line',
      data: [{ id: 'costLineData', values }],
      xField: 'Time',
      yField: 'Cost',
      seriesField: 'Model',
      legends: { visible: true, selectMode: 'single' },
      title: {
        visible: true,
        text: t('成本趋势'),
        subtext: `${t('总计')}: ${renderQuota(totalCost, 2)}`,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['Model'],
              value: (datum) => formatUSDDisplay(datum['Cost']),
            },
          ],
        },
      },
      point: { visible: true, size: 4 },
      line: { style: { lineWidth: 2 } },
      color: { specified: modelColorMap },
    };
  }, [byModel, totals, t]);

  // ========== Request trend line ==========
  const specRequestLine = useMemo(() => {
    const values = totals.map((b) => ({
      Time: b.time_bucket,
      Count: b.count,
    }));

    const totalCount = totals.reduce((s, b) => s + b.count, 0);

    return {
      type: 'line',
      data: [{ id: 'requestLineData', values }],
      xField: 'Time',
      yField: 'Count',
      title: {
        visible: true,
        text: t('请求趋势'),
        subtext: `${t('总计')}: ${renderNumber(totalCount)}`,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: () => t('请求次数'),
              value: (datum) => renderNumber(datum['Count']),
            },
          ],
        },
      },
      point: { visible: true, size: 4 },
      line: { style: { lineWidth: 2, stroke: '#3370FF' } },
    };
  }, [totals, t]);

  // ========== Token trend line ==========
  const specTokenLine = useMemo(() => {
    const values = totals.map((b) => ({
      Time: b.time_bucket,
      Tokens: b.tokens,
    }));

    const totalTokens = totals.reduce((s, b) => s + b.tokens, 0);

    return {
      type: 'line',
      data: [{ id: 'tokenLineData', values }],
      xField: 'Time',
      yField: 'Tokens',
      title: {
        visible: true,
        text: t('Token 趋势'),
        subtext: `${t('总计')}: ${renderNumber(totalTokens)}`,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: () => t('Token 消耗'),
              value: (datum) => renderNumber(datum['Tokens']),
            },
          ],
        },
      },
      point: { visible: true, size: 4 },
      line: { style: { lineWidth: 2, stroke: '#00B42A' } },
    };
  }, [totals, t]);

  // ========== Pie chart (model cost share) ==========
  const specPie = useMemo(() => {
    const values = modelAgg.map((m) => ({
      type: m.model,
      value: formatQuotaToUSD(m.quota),
    }));

    const totalCost = modelAgg.reduce((s, m) => s + m.quota, 0);

    return {
      type: 'pie',
      data: [{ id: 'pieData', values: values.length > 0 ? values : [{ type: 'N/A', value: 0 }] }],
      outerRadius: 0.8,
      innerRadius: 0.5,
      padAngle: 0.6,
      valueField: 'value',
      categoryField: 'type',
      pie: {
        style: { cornerRadius: 10 },
        state: {
          hover: { outerRadius: 0.85, stroke: '#000', lineWidth: 1 },
          selected: { outerRadius: 0.85, stroke: '#000', lineWidth: 1 },
        },
      },
      title: {
        visible: true,
        text: t('模型消耗占比'),
        subtext: `${t('总计')}: ${renderQuota(totalCost, 2)}`,
      },
      legends: { visible: true, orient: 'left' },
      label: { visible: true },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['type'],
              value: (datum) => formatUSDDisplay(datum['value']),
            },
          ],
        },
      },
      color: { specified: modelColorMap },
    };
  }, [modelAgg, t]);

  // ========== Rank bar (horizontal, by model cost) ==========
  const specRankBar = useMemo(() => {
    const values = modelAgg.map((m) => ({
      Model: m.model,
      Cost: formatQuotaToUSD(m.quota),
    }));

    return {
      type: 'bar',
      data: [{ id: 'rankData', values }],
      xField: 'Cost',
      yField: 'Model',
      direction: 'horizontal',
      seriesField: 'Model',
      title: {
        visible: true,
        text: t('模型成本排行'),
      },
      legends: { visible: false },
      bar: {
        state: {
          hover: { stroke: '#000', lineWidth: 1 },
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum) => datum['Model'],
              value: (datum) => formatUSDDisplay(datum['Cost']),
            },
          ],
        },
      },
      label: {
        visible: true,
        position: 'outside',
        formatter: (datum) => formatUSDDisplay(datum['Cost']),
      },
      color: { specified: modelColorMap },
    };
  }, [modelAgg, t]);

  return {
    specCostLine,
    specRequestLine,
    specTokenLine,
    specPie,
    specRankBar,
  };
};
