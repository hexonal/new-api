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
import {
  formatQuotaDisplay,
  quotaToNumeric,
} from '../../../../helpers/key-cost';
import { renderNumber } from '../../../../helpers';

const PAGE_SIZE = 10;

const MODEL_COLORS = ['#4a4bd7', '#00687b', '#6e3bd8', '#9ca3af', '#14b8a6'];

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

const getModelBadgeText = (modelName) => {
  const normalized = String(modelName || '').trim();
  if (!normalized) {
    return 'AI';
  }
  const letterMatch = normalized.match(/[a-z0-9]/i);
  if (!letterMatch) {
    return 'AI';
  }
  return letterMatch[0].toUpperCase();
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
  const [openMenuRowKey, setOpenMenuRowKey] = useState(null);
  const [activeModelFilter, setActiveModelFilter] = useState('');

  const trendSpec =
    data.activeChartTab === METRIC_REQUESTS
      ? charts.specRequestLine
      : data.activeChartTab === METRIC_TOKENS
        ? charts.specTokenLine
        : charts.specCostLine;

  const trendHasData = trendSpec?.data?.[0]?.values?.length > 0;

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
        const costQuota = Number.isFinite(row.costQuota) ? row.costQuota : 0;
        const costValue = quotaToNumeric(costQuota);
        const percentage =
          totalQuota > 0 ? Math.round((costQuota / totalQuota) * 100) : 0;
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

  const filteredModelRows = useMemo(() => {
    if (!activeModelFilter) {
      return modelRows;
    }
    return modelRows.filter((row) => row.modelName === activeModelFilter);
  }, [activeModelFilter, modelRows]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredModelRows.length / PAGE_SIZE),
  );

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredModelRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredModelRows]);

  const hasRealData = modelRows.length > 0;
  const distributionRows = modelRows.slice(0, 4);
  const rankingMax =
    distributionRows.length > 0
      ? Math.max(...distributionRows.map((item) => item.costValue), 0)
      : 0;

  const donutGradient = useMemo(
    () => buildConicGradient(distributionRows),
    [distributionRows],
  );

  const tokenOptions = useMemo(() => {
    const options = [{ value: '', label: data.t('全部 Key') }];
    for (const token of data.tokens || []) {
      options.push({
        value: String(token.id),
        label: token.name ? `${token.name}` : `Key #${token.id}`,
      });
    }
    return options;
  }, [data.t, data.tokens]);

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
      [
        'Model Name',
        'Requests',
        'Prompt Tokens',
        'Completion Tokens',
        'Cost',
        'Percentage',
      ],
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
  const tableRows = pagedRows;

  useEffect(() => {
    setCurrentPage(1);
  }, [
    data.selectedTokenId,
    data.granularity,
    data.dateRange,
    filteredModelRows.length,
  ]);

  useEffect(() => {
    if (
      activeModelFilter &&
      !modelRows.some((row) => row.modelName === activeModelFilter)
    ) {
      setActiveModelFilter('');
    }
  }, [activeModelFilter, modelRows]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-model-menu-root="true"]')
      ) {
        return;
      }
      setOpenMenuRowKey(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleCopyModelName = useCallback(async (name) => {
    try {
      await navigator.clipboard.writeText(name);
    } catch (error) {
      // ignore clipboard permission failures
    } finally {
      setOpenMenuRowKey(null);
    }
  }, []);

  return (
    <div className='w-full max-w-none space-y-8 p-2 text-on-surface'>
      <div className='flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between'>
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
          className='flex self-start items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 xl:self-auto'
          onClick={handleExport}
          disabled={!hasRealData}
        >
          <span aria-hidden='true' className='text-base leading-none'>
            ↓
          </span>
          Export CSV
        </button>
      </div>

      <section className='flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 xl:flex-row xl:items-center xl:justify-between'>
        <div className='flex w-full flex-wrap items-center gap-3 xl:w-auto xl:flex-nowrap'>
          <div className='relative'>
            <select
              className='w-full min-w-0 appearance-none rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 pr-10 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:min-w-[220px]'
              value={
                data.selectedTokenId === null
                  ? ''
                  : String(data.selectedTokenId)
              }
              onChange={handleTokenChange}
            >
              {tokenOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden='true'
              className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400'
            >
              ▾
            </span>
          </div>

          <div className='flex flex-wrap rounded-lg bg-gray-100 p-1'>
            {(data.granularityOptions || []).map((item) => {
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

        <div className='flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end'>
          <div className='flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2'>
            <span aria-hidden='true' className='text-sm text-gray-400'>
              📅
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
          <button
            type='button'
            className='rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60'
            onClick={data.refresh}
            disabled={data.loading}
          >
            {data.loading ? data.t('刷新中...') : data.t('刷新')}
          </button>
        </div>
      </section>

      {hasRealData ? (
        <section className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {(statsData || []).map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className='group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6'
            >
              <div className='mb-4 flex items-start justify-between'>
                <p className='text-sm font-medium text-gray-500'>
                  {item.title}
                </p>
              </div>
              <p className="font-['Public_Sans'] break-all text-xl font-black text-on-surface sm:text-3xl">
                {item.value}
              </p>
              <div className='absolute bottom-0 left-0 h-1 w-full translate-y-full bg-primary transition-transform group-hover:translate-y-0'></div>
            </article>
          ))}
        </section>
      ) : (
        <section className='rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500'>
          {data.t('当前筛选条件暂无统计数据')}
        </section>
      )}

      <section className='overflow-hidden rounded-xl border border-gray-200 bg-white'>
        <div className='flex flex-col gap-2 border-b border-gray-100 px-6 py-4 xl:flex-row xl:items-center xl:justify-between'>
          <div className='flex flex-wrap gap-4'>
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
            {formatDateLabel(activeDateRange[0])} -{' '}
            {formatDateLabel(activeDateRange[1])}
          </div>
        </div>

        <div className='h-[280px] overflow-x-auto p-4 md:h-[320px] xl:h-[400px]'>
          <div className='h-full min-w-[520px]'>
            {trendHasData ? (
              <VChart spec={trendSpec} option={CHART_CONFIG} />
            ) : (
              <div className='flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400'>
                {data.t('当前筛选条件暂无数据')}
              </div>
            )}
          </div>
        </div>

        {distributionRows.length > 0 ? (
          <div className='flex flex-wrap justify-center gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 md:gap-4'>
            {distributionRows.map((row, index) => (
              <div
                key={`${row.modelName}-${index}`}
                className='flex items-center gap-2'
              >
                <div
                  className='h-3 w-3 rounded-full'
                  style={{
                    backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length],
                  }}
                ></div>
                <span className='text-xs font-medium text-gray-600'>
                  {row.modelName}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className='border-t border-gray-100 bg-gray-50 px-6 py-4 text-center text-sm text-gray-400'>
            {data.t('暂无数据')}
          </div>
        )}
      </section>

      <section className='grid grid-cols-1 gap-6 xl:grid-cols-10'>
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
                        backgroundColor:
                          MODEL_COLORS[index % MODEL_COLORS.length],
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className='py-20 text-center text-sm text-gray-400'>
              暂无数据
            </div>
          )}
        </article>

        <article className='rounded-xl border border-gray-200 bg-white p-6 lg:col-span-6'>
          <h3 className="mb-6 font-['Public_Sans'] text-lg font-bold">
            Cost Ranking
          </h3>

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
                      <span className='text-sm font-semibold'>
                        {row.modelName}
                      </span>
                      <span className='text-sm font-bold'>{row.costText}</span>
                    </div>
                    <div className='h-3 w-full rounded-full bg-gray-50'>
                      <div
                        className='h-full rounded-full'
                        style={{
                          width: `${width}%`,
                          backgroundColor:
                            MODEL_COLORS[index % MODEL_COLORS.length],
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className='py-20 text-center text-sm text-gray-400'>
              暂无数据
            </div>
          )}
        </article>
      </section>

      <section className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
        <div className='flex items-center justify-between border-b border-gray-100 p-6'>
          <h3 className="font-['Public_Sans'] text-lg font-bold">
            Model Details
          </h3>
          <button
            type='button'
            className='p-1.5 text-gray-400 transition-colors hover:text-gray-600'
            aria-label='filter'
          >
            <span aria-hidden='true' className='text-base leading-none'>
              ≡
            </span>
          </button>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full min-w-[920px] text-left'>
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
                          className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ${iconMeta.bgClass}`}
                        >
                          <span
                            className={`text-xs font-bold uppercase leading-none ${iconMeta.iconClass}`}
                          >
                            {getModelBadgeText(row.modelName)}
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
                          <span
                            aria-hidden='true'
                            className='text-xs leading-none'
                          >
                            ↑
                          </span>
                          {renderNumber(row.promptTokens)}
                        </span>
                        <span className='flex items-center gap-1 text-gray-400'>
                          <span
                            aria-hidden='true'
                            className='text-xs leading-none'
                          >
                            ↓
                          </span>
                          {renderNumber(row.completionTokens)}
                        </span>
                      </div>
                    </td>

                    <td className='px-6 py-4 text-sm font-bold'>
                      {row.costText}
                    </td>

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
                      <div
                        className='relative inline-flex'
                        data-model-menu-root='true'
                      >
                        <button
                          type='button'
                          className='text-gray-400 transition-colors hover:text-gray-600'
                          aria-label='more'
                          onClick={() =>
                            setOpenMenuRowKey((prev) =>
                              prev === row.key ? null : row.key,
                            )
                          }
                        >
                          <span
                            aria-hidden='true'
                            className='block text-lg font-semibold leading-none'
                          >
                            ⋮
                          </span>
                        </button>
                        {openMenuRowKey === row.key && (
                          <div className='absolute right-0 top-6 z-20 min-w-[140px] overflow-hidden rounded-md border border-gray-200 bg-white text-left text-xs shadow-lg'>
                            <button
                              type='button'
                              className='block w-full px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50'
                              onClick={() => {
                                setActiveModelFilter(row.modelName);
                                setCurrentPage(1);
                                setOpenMenuRowKey(null);
                              }}
                            >
                              按该模型筛选
                            </button>
                            <button
                              type='button'
                              className='block w-full px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50'
                              onClick={() => handleCopyModelName(row.modelName)}
                            >
                              复制模型名
                            </button>
                          </div>
                        )}
                      </div>
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

        <div className='flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4 md:flex-row md:items-center md:justify-between'>
          <p className='text-sm text-gray-500'>
            Showing {tableRows.length} of {filteredModelRows.length} results
          </p>
          <div className='flex flex-wrap items-center gap-2'>
            {activeModelFilter && (
              <button
                type='button'
                className='rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50'
                onClick={() => setActiveModelFilter('')}
              >
                清除筛选: {activeModelFilter}
              </button>
            )}
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
