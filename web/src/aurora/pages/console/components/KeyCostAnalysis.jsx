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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { VChart } from '@visactor/react-vchart';
import {
  CHART_CONFIG,
  METRIC_COST,
  METRIC_REQUESTS,
  METRIC_TOKENS,
} from '../../../../constants/key-cost.constants';
import { useKeyCostData } from '../../../../hooks/key-cost/useKeyCostData';
import { useKeyCostStats } from '../../../../hooks/key-cost/useKeyCostStats';
import { useKeyCostCharts } from '../../../../hooks/key-cost/useKeyCostCharts';
import { formatQuotaDisplay } from '../../../../helpers/key-cost';
import { renderNumber } from '../../../../helpers';

const PAGE_SIZE = 10;

const MODEL_COLORS = ['#4a4bd7', '#00687b', '#6e3bd8', '#9ca3af', '#14b8a6'];
const DEFAULT_MODEL_ROWS = [
  {
    key: 'placeholder-gpt-5.4',
    modelName: 'gpt-5.4',
    requestCount: 8,
    promptTokens: 1200,
    completionTokens: 800,
    totalTokens: 2000,
    costValue: 62,
    costText: '$0.00',
    percentage: 62,
  },
  {
    key: 'placeholder-minimax',
    modelName: 'MiniMax-Text-01',
    requestCount: 4,
    promptTokens: 450,
    completionTokens: 300,
    totalTokens: 750,
    costValue: 23,
    costText: '$0.00',
    percentage: 23,
  },
  {
    key: 'placeholder-gpt-4.1',
    modelName: 'gpt-4.1',
    requestCount: 3,
    promptTokens: 200,
    completionTokens: 150,
    totalTokens: 350,
    costValue: 11,
    costText: '$0.00',
    percentage: 11,
  },
  {
    key: 'placeholder-kimi',
    modelName: 'kimi-for-coding',
    requestCount: 1,
    promptTokens: 52,
    completionTokens: 0,
    totalTokens: 52,
    costValue: 4,
    costText: '$0.00',
    percentage: 4,
  },
];

const MODEL_ICON_MAP = [
  {
    matcher: (name) => name.includes('gpt') || name.includes('o1'),
    icon: 'smart_toy',
    iconClass: 'text-primary',
    bgClass: 'bg-primary-container',
  },
  {
    matcher: (name) => name.includes('minimax') || name.includes('claude'),
    icon: 'cyclone',
    iconClass: 'text-tertiary',
    bgClass: 'bg-tertiary-container',
  },
  {
    matcher: (name) => name.includes('qwen') || name.includes('gemini'),
    icon: 'bolt',
    iconClass: 'text-secondary',
    bgClass: 'bg-secondary-container',
  },
  {
    matcher: (name) => name.includes('kimi') || name.includes('deepseek'),
    icon: 'code',
    iconClass: 'text-gray-500',
    bgClass: 'bg-gray-100',
  },
];

const getModelIcon = (modelName) => {
  const lower = String(modelName || '').toLowerCase();
  for (const item of MODEL_ICON_MAP) {
    if (item.matcher(lower)) {
      return item;
    }
  }
  return {
    icon: 'memory',
    iconClass: 'text-gray-500',
    bgClass: 'bg-gray-100',
  };
};

const formatDateInput = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return '';
  }
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDateLabel = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
};

const toCsvCell = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const normalized = String(value).replaceAll('"', '""');
  return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
};

const buildConicGradient = (rows) => {
  if (rows.length === 0) {
    return 'conic-gradient(#e5e7eb 0deg 360deg)';
  }

  const total = rows.reduce((sum, row) => sum + row.costValue, 0);
  if (total <= 0) {
    return 'conic-gradient(#e5e7eb 0deg 360deg)';
  }

  let offset = 0;
  const segments = rows.map((row, index) => {
    const degree = (row.costValue / total) * 360;
    const from = offset;
    const to = Math.min(360, offset + degree);
    offset = to;
    return `${MODEL_COLORS[index % MODEL_COLORS.length]} ${from}deg ${to}deg`;
  });

  if (offset < 360) {
    segments.push(`#e5e7eb ${offset}deg 360deg`);
  }

  return `conic-gradient(${segments.join(',')})`;
};

const KeyCostAnalysis = () => {
  const data = useKeyCostData();
  const { statsData } = useKeyCostStats(data.summaryData, data.t);
  const charts = useKeyCostCharts(data.summaryData, data.granularity, data.t);

  const [currentPage, setCurrentPage] = useState(1);

  const trendSpec =
    data.activeChartTab === METRIC_REQUESTS
      ? charts.specRequestLine
      : data.activeChartTab === METRIC_TOKENS
        ? charts.specTokenLine
        : charts.specCostLine;

  const trendHasData =
    trendSpec?.data?.[0]?.values && trendSpec.data[0].values.length > 0;
  const hasRealData = (data.summaryData || []).length > 0;

  const modelRows = useMemo(() => {
    const byModel = new Map();

    for (const item of data.summaryData || []) {
      const modelName = String(item?.model_name || '').trim() || 'unknown';
      if (!byModel.has(modelName)) {
        byModel.set(modelName, {
          modelName,
          requestCount: 0,
          promptTokens: 0,
          completionTokens: 0,
          costQuota: 0,
        });
      }
      const row = byModel.get(modelName);
      row.requestCount += Number(item?.request_count || 0);
      row.promptTokens += Number(item?.prompt_tokens || 0);
      row.completionTokens += Number(item?.completion_tokens || 0);
      row.costQuota += Number(item?.total_quota || 0);
    }

    const totalQuota = Array.from(byModel.values()).reduce(
      (sum, row) => sum + row.costQuota,
      0,
    );

    return Array.from(byModel.values())
      .map((row, index) => {
        const costValue = Number.isFinite(row.costQuota) ? row.costQuota : 0;
        const percentage =
          totalQuota > 0
            ? Math.round((costValue / totalQuota) * 100)
            : 0;
        return {
          key: `${row.modelName}-${index}`,
          modelName: row.modelName,
          requestCount: row.requestCount,
          promptTokens: row.promptTokens,
          completionTokens: row.completionTokens,
          totalTokens: row.promptTokens + row.completionTokens,
          costValue,
          costText: formatQuotaDisplay(costValue),
          percentage,
        };
      })
      .sort((a, b) => b.costValue - a.costValue);
  }, [data.summaryData]);

  const totalPages = Math.max(1, Math.ceil(modelRows.length / PAGE_SIZE));

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return modelRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, modelRows]);

  const displayRows = modelRows.length > 0 ? modelRows : DEFAULT_MODEL_ROWS;
  const distributionRows = displayRows.slice(0, 4);
  const rankingMax =
    distributionRows.length > 0
      ? Math.max(...distributionRows.map((item) => item.costValue), 0)
      : 0;

  const donutGradient = useMemo(
    () => buildConicGradient(distributionRows),
    [distributionRows],
  );

  const tokenOptions = useMemo(() => {
    const options = [{ value: '', label: 'All Keys' }];
    for (const token of data.tokens || []) {
      options.push({
        value: String(token.id),
        label: token.name ? `${token.name}` : `Key #${token.id}`,
      });
    }
    return options;
  }, [data.tokens]);

  const handleTokenChange = (event) => {
    const raw = event.target.value;
    if (!raw) {
      data.setSelectedTokenId(null);
      return;
    }
    const tokenId = Number(raw);
    data.setSelectedTokenId(Number.isFinite(tokenId) ? tokenId : null);
  };

  const handleDateChange = (index, value) => {
    const current = Array.isArray(data.dateRange)
      ? data.dateRange
      : [new Date(), new Date()];
    const next = [...current];
    const picked = new Date(`${value}T00:00:00`);
    if (Number.isNaN(picked.getTime())) {
      return;
    }
    next[index] = picked;
    data.setDateRange(next);
  };

  const handleExport = useCallback(() => {
    const rows = [
      ['Model Name', 'Requests', 'Prompt Tokens', 'Completion Tokens', 'Cost', 'Percentage'],
      ...modelRows.map((row) => [
        row.modelName,
        row.requestCount,
        row.promptTokens,
        row.completionTokens,
        row.costText,
        `${row.percentage}%`,
      ]),
    ];

    const csvText = rows
      .map((line) => line.map((cell) => toCsvCell(cell)).join(','))
      .join('\n');

    const blob = new Blob([`\uFEFF${csvText}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `key-cost-analysis-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [modelRows]);

  const activeDateRange = Array.isArray(data.dateRange)
    ? data.dateRange
    : [new Date(), new Date()];
  const tableRows = hasRealData ? pagedRows : DEFAULT_MODEL_ROWS;

  useEffect(() => {
    setCurrentPage(1);
  }, [data.selectedTokenId, data.granularity, data.dateRange, modelRows.length]);

  return (
    <div className='mx-auto max-w-[1200px] space-y-8 p-2 text-on-surface'>
      <div className='flex items-end justify-between'>
        <div>
          <h2 className="font-['Public_Sans'] text-3xl font-extrabold tracking-tight text-on-surface">
            Key Cost Analysis
          </h2>
          <p className='mt-1 text-sm font-medium text-on-surface-variant'>
            Track spending and usage per API key
          </p>
        </div>
        <button
          type='button'
          className='flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5'
          onClick={handleExport}
        >
          <span className='material-symbols-outlined text-lg'>download</span>
          Export CSV
        </button>
      </div>

      <section className='flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4'>
        <div className='flex items-center gap-4'>
          <div className='relative'>
            <select
              className='appearance-none rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 pr-10 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
              value={data.selectedTokenId === null ? '' : String(data.selectedTokenId)}
              onChange={handleTokenChange}
            >
              {tokenOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className='material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400'>
              expand_more
            </span>
          </div>

          <div className='flex rounded-lg bg-gray-100 p-1'>
            {[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ].map((item) => {
              const active = data.granularity === item.value;
              return (
                <button
                  key={item.value}
                  type='button'
                  className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-white font-semibold text-primary shadow-sm'
                      : 'font-medium text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => data.setGranularity(item.value)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2'>
            <span className='material-symbols-outlined text-lg text-gray-400'>
              calendar_today
            </span>
            <input
              type='date'
              className='border-none bg-transparent text-sm font-medium outline-none'
              value={formatDateInput(activeDateRange[0])}
              onChange={(event) => handleDateChange(0, event.target.value)}
            />
            <span className='text-sm text-gray-400'>-</span>
            <input
              type='date'
              className='border-none bg-transparent text-sm font-medium outline-none'
              value={formatDateInput(activeDateRange[1])}
              onChange={(event) => handleDateChange(1, event.target.value)}
            />
          </div>

        </div>
      </section>

      <section className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
        {(statsData || []).map((item, index) => (
          <article
            key={`${item.title}-${index}`}
            className='group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6'
          >
            <div className='mb-4 flex items-start justify-between'>
              <p className='text-sm font-medium text-gray-500'>{item.title}</p>
              {index === 0 && (
                <span className='inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600'>
                  <span className='material-symbols-outlined mr-0.5 text-xs'>
                    trending_up
                  </span>
                  +0.0%
                </span>
              )}
            </div>
            <p className="font-['Public_Sans'] text-3xl font-black text-on-surface">
              {item.value}
            </p>
            <div className='absolute bottom-0 left-0 h-1 w-full translate-y-full bg-primary transition-transform group-hover:translate-y-0'></div>
          </article>
        ))}
      </section>

      <section className='overflow-hidden rounded-xl border border-gray-200 bg-white'>
        <div className='flex items-center justify-between border-b border-gray-100 px-6 py-4'>
          <div className='flex gap-6'>
            <button
              type='button'
              className={`-mb-[17px] border-b-2 pb-4 text-sm ${
                data.activeChartTab === METRIC_COST
                  ? 'border-primary font-bold text-primary'
                  : 'border-transparent font-medium text-gray-500'
              }`}
              onClick={() => data.setActiveChartTab(METRIC_COST)}
            >
              Cost Trend
            </button>
            <button
              type='button'
              className={`-mb-[17px] border-b-2 pb-4 text-sm ${
                data.activeChartTab === METRIC_REQUESTS
                  ? 'border-primary font-bold text-primary'
                  : 'border-transparent font-medium text-gray-500'
              }`}
              onClick={() => data.setActiveChartTab(METRIC_REQUESTS)}
            >
              Request Trend
            </button>
            <button
              type='button'
              className={`-mb-[17px] border-b-2 pb-4 text-sm ${
                data.activeChartTab === METRIC_TOKENS
                  ? 'border-primary font-bold text-primary'
                  : 'border-transparent font-medium text-gray-500'
              }`}
              onClick={() => data.setActiveChartTab(METRIC_TOKENS)}
            >
              Token Trend
            </button>
          </div>
          <div className='text-xs font-medium text-gray-400'>
            {formatDateLabel(activeDateRange[0])} - {formatDateLabel(activeDateRange[1])}
          </div>
        </div>

        <div className='h-[400px] p-4'>
          {trendHasData ? (
            <VChart spec={trendSpec} option={CHART_CONFIG} />
          ) : (
            <div className='relative h-full overflow-hidden rounded-lg bg-white'>
              <svg
                className='h-full w-full'
                preserveAspectRatio='none'
                viewBox='0 0 1000 300'
              >
                <path
                  d='M0 250 Q 150 200 300 230 T 600 150 T 1000 100 L 1000 300 L 0 300 Z'
                  fill='rgba(74, 75, 215, 0.05)'
                ></path>
                <path
                  d='M0 250 Q 150 200 300 230 T 600 150 T 1000 100'
                  fill='none'
                  stroke='#4a4bd7'
                  strokeWidth='3'
                ></path>
                <path
                  d='M0 270 Q 200 260 400 280 T 800 220 T 1000 240'
                  fill='none'
                  stroke='#00687b'
                  strokeDasharray='4'
                  strokeWidth='2'
                ></path>
                <path
                  d='M0 290 Q 250 285 500 295 T 1000 280'
                  fill='none'
                  stroke='#6e3bd8'
                  strokeDasharray='2'
                  strokeWidth='2'
                ></path>
              </svg>
            </div>
          )}
        </div>

        <div className='flex flex-wrap justify-center gap-6 border-t border-gray-100 bg-gray-50 px-6 py-4'>
          {distributionRows.map((row, index) => (
            <div key={`${row.modelName}-${index}`} className='flex items-center gap-2'>
              <div
                className='h-3 w-3 rounded-full'
                style={{ backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length] }}
              ></div>
              <span className='text-xs font-medium text-gray-600'>
                {row.modelName}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className='grid grid-cols-1 gap-8 lg:grid-cols-10'>
        <article className='rounded-xl border border-gray-200 bg-white p-6 lg:col-span-4'>
          <h3 className="mb-6 font-['Public_Sans'] text-lg font-bold">
            Model Cost Distribution
          </h3>

          {distributionRows.length > 0 ? (
            <>
              <div className='relative flex items-center justify-center py-8'>
                <div
                  className='h-48 w-48 rounded-full border-[20px] border-transparent rotate-45'
                  style={{ background: donutGradient }}
                ></div>
                <div className='absolute flex flex-col items-center'>
                  <span className='text-2xl font-black'>100%</span>
                  <span className='text-[10px] font-bold uppercase tracking-widest text-gray-400'>
                    Total Cost
                  </span>
                </div>
              </div>

              {distributionRows.map((row, index) => (
                <div key={`${row.modelName}-share`} className='mt-4 space-y-2'>
                  <div className='flex justify-between text-xs'>
                    <span className='text-gray-500'>{row.modelName}</span>
                    <span className='font-bold'>{row.percentage}%</span>
                  </div>
                  <div className='h-1.5 w-full rounded-full bg-gray-100'>
                    <div
                      className='h-full rounded-full'
                      style={{
                        width: `${Math.max(0, Math.min(100, row.percentage))}%`,
                        backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length],
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className='py-20 text-center text-sm text-gray-400'>暂无数据</div>
          )}
        </article>

        <article className='rounded-xl border border-gray-200 bg-white p-6 lg:col-span-6'>
          <h3 className="mb-6 font-['Public_Sans'] text-lg font-bold">Cost Ranking</h3>

          {distributionRows.length > 0 ? (
            <div className='space-y-6'>
              {distributionRows.map((row, index) => {
                const width =
                  rankingMax > 0
                    ? Math.max(8, (row.costValue / rankingMax) * 100)
                    : 0;
                return (
                  <div key={`${row.modelName}-ranking`}>
                    <div className='mb-2 flex items-center justify-between'>
                      <span className='text-sm font-semibold'>{row.modelName}</span>
                      <span className='text-sm font-bold'>{row.costText}</span>
                    </div>
                    <div className='h-3 w-full rounded-full bg-gray-50'>
                      <div
                        className='h-full rounded-full'
                        style={{
                          width: `${width}%`,
                          backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length],
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className='py-20 text-center text-sm text-gray-400'>暂无数据</div>
          )}
        </article>
      </section>

      <section className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
        <div className='flex items-center justify-between border-b border-gray-100 p-6'>
          <h3 className="font-['Public_Sans'] text-lg font-bold">Model Details</h3>
          <button
            type='button'
            className='p-1.5 text-gray-400 transition-colors hover:text-gray-600'
            aria-label='filter'
          >
            <span className='material-symbols-outlined'>filter_list</span>
          </button>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-left'>
            <thead className='border-b border-gray-100 bg-gray-50'>
              <tr>
                <th className='px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-gray-500'>
                  Model Name
                </th>
                <th className='px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-gray-500'>
                  Requests
                </th>
                <th className='px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-gray-500'>
                  Tokens (In/Out)
                </th>
                <th className='px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-gray-500'>
                  Cost ($)
                </th>
                <th className='px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-gray-500'>
                  Percentage (%)
                </th>
                <th className='px-6 py-4'></th>
              </tr>
            </thead>

            <tbody className='divide-y divide-gray-50'>
              {tableRows.map((row, index) => {
                const iconMeta = getModelIcon(row.modelName);
                const rowColor = MODEL_COLORS[index % MODEL_COLORS.length];
                return (
                  <tr
                    key={row.key}
                    className='transition-colors hover:bg-gray-50/80'
                  >
                    <td className='px-6 py-4'>
                      <div className='flex items-center gap-3'>
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconMeta.bgClass}`}
                        >
                          <span
                            className={`material-symbols-outlined text-lg ${iconMeta.iconClass}`}
                          >
                            {iconMeta.icon}
                          </span>
                        </div>
                        <span className='text-sm font-semibold text-on-surface'>
                          {row.modelName}
                        </span>
                      </div>
                    </td>

                    <td className='px-6 py-4 text-sm text-gray-600'>
                      {renderNumber(row.requestCount)}
                    </td>

                    <td className='px-6 py-4'>
                      <div className='flex flex-col text-sm'>
                        <span className='flex items-center gap-1 text-gray-600'>
                          <span className='material-symbols-outlined text-xs'>
                            arrow_upward
                          </span>
                          {renderNumber(row.promptTokens)}
                        </span>
                        <span className='flex items-center gap-1 text-gray-400'>
                          <span className='material-symbols-outlined text-xs'>
                            arrow_downward
                          </span>
                          {renderNumber(row.completionTokens)}
                        </span>
                      </div>
                    </td>

                    <td className='px-6 py-4 text-sm font-bold'>{row.costText}</td>

                    <td className='px-6 py-4'>
                      <span
                        className='rounded-full px-2.5 py-1 text-xs font-bold'
                        style={{
                          color: rowColor,
                          backgroundColor: `${rowColor}1a`,
                        }}
                      >
                        {row.percentage}%
                      </span>
                    </td>

                    <td className='px-6 py-4 text-right'>
                      <button
                        type='button'
                        className='text-gray-400 transition-colors hover:text-gray-600'
                        aria-label='more'
                      >
                        <span className='material-symbols-outlined'>more_vert</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {tableRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className='px-6 py-16 text-center text-sm text-gray-400'
                  >
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className='flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4'>
          <p className='text-sm text-gray-500'>
            Showing {tableRows.length} of {hasRealData ? modelRows.length : DEFAULT_MODEL_ROWS.length} results
          </p>
          <div className='flex gap-2'>
            <button
              type='button'
              className='cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
              disabled={!hasRealData || currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Previous
            </button>
            <button
              type='button'
              className='cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
              disabled={!hasRealData || currentPage >= totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
            >
              Next
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default KeyCostAnalysis;
