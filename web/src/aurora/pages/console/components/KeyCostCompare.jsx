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

import React, { useMemo, useState } from 'react';
import { VChart } from '@visactor/react-vchart';
import {
  CHART_CONFIG,
  COMPARE_COLORS,
  METRIC_COST,
  METRIC_REQUESTS,
  METRIC_TOKENS,
} from '../../../../constants/key-cost.constants';
import { useKeyCompareData } from '../../../../hooks/key-cost/useKeyCompareData';
import { useKeyCompareCharts } from '../../../../hooks/key-cost/useKeyCompareCharts';
import {
  formatQuotaDisplay,
  quotaToNumeric,
} from '../../../../helpers/key-cost';
import { renderNumber } from '../../../../helpers';

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

const renderCompactNumber = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0';
  }
  if (numeric >= 1000000) {
    return `${(numeric / 1000000).toFixed(1)}M`;
  }
  if (numeric >= 1000) {
    return `${(numeric / 1000).toFixed(1)}k`;
  }
  return renderNumber(numeric);
};

const METRIC_TABS = [
  { value: METRIC_COST, label: 'Cost' },
  { value: METRIC_REQUESTS, label: 'Requests' },
  { value: METRIC_TOKENS, label: 'Tokens' },
];

const normalizeTokenIdKey = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const resolveTokenLabel = (token, fallback) => {
  const label = String(token?.name || '').trim();
  return label || fallback;
};

const KeyCostCompare = () => {
  const compare = useKeyCompareData();
  const [activeMetric, setActiveMetric] = useState(METRIC_COST);
  const [pendingTokenId, setPendingTokenId] = useState('');

  const activeDateRange = Array.isArray(compare.dateRange)
    ? compare.dateRange
    : [new Date(), new Date()];

  const tokenCandidates = useMemo(() => {
    const candidateMap = new Map();

    for (const token of compare.tokens || []) {
      const tokenId = normalizeTokenIdKey(token?.id);
      if (!tokenId) continue;
      candidateMap.set(tokenId, {
        tokenId,
        name: resolveTokenLabel(token, `Key #${tokenId}`),
        hasData: false,
        totalQuota: 0,
      });
    }

    for (const row of compare.rawData || []) {
      const tokenId = normalizeTokenIdKey(row?.token_id);
      if (!tokenId || tokenId === '0') continue;
      const name = String(row?.token_name || '').trim() || `Key #${tokenId}`;
      const quota = Number(row?.total_quota ?? 0) || 0;

      if (!candidateMap.has(tokenId)) {
        candidateMap.set(tokenId, {
          tokenId,
          name,
          hasData: true,
          totalQuota: quota,
        });
        continue;
      }

      const current = candidateMap.get(tokenId);
      candidateMap.set(tokenId, {
        ...current,
        name: current.name || name,
        hasData: true,
        totalQuota: (Number(current.totalQuota) || 0) + quota,
      });
    }

    return Array.from(candidateMap.values()).sort((a, b) => {
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
      if (a.totalQuota !== b.totalQuota) return b.totalQuota - a.totalQuota;
      return a.name.localeCompare(b.name);
    });
  }, [compare.rawData, compare.tokens]);

  const { specMultiLine, compareStats } = useKeyCompareCharts(
    compare.compareData,
    activeMetric,
    compare.granularity,
    compare.t,
    tokenCandidates.map((item) => ({ id: item.tokenId, name: item.name })),
  );

  const selectedMeta = useMemo(() => {
    const tokenMap = new Map(
      tokenCandidates.map((item) => [item.tokenId, item]),
    );
    return (compare.selectedTokenIds || []).map((tokenId, index) => {
      const normalizedId = normalizeTokenIdKey(tokenId);
      const token = tokenMap.get(normalizedId);
      return {
        tokenId: normalizedId,
        name: token?.name || `Key #${normalizedId}`,
        color: COMPARE_COLORS[index % COMPARE_COLORS.length],
        hasData: Boolean(token?.hasData),
      };
    });
  }, [compare.selectedTokenIds, tokenCandidates]);

  const suggestedTokens = useMemo(
    () => tokenCandidates.filter((item) => item.hasData).slice(0, 3),
    [tokenCandidates],
  );

  const hasSelection = selectedMeta.length > 0;
  const hasSelectedData = selectedMeta.some((item) => item.hasData);
  const hasCompareData = (compareStats || []).length > 0;

  const displayStats = useMemo(() => {
    return (compareStats || []).map((item, index) => ({
      tokenId: item.tokenId,
      name: item.name,
      color: COMPARE_COLORS[index % COMPARE_COLORS.length],
      costText: item.cost,
      requestsText: renderCompactNumber(item.requests),
      tokensText: renderCompactNumber(item.tokens),
      auxText: item.avgCost,
    }));
  }, [compareStats]);

  const detailRows = useMemo(() => {
    if (!hasSelection) {
      return [];
    }

    const modelMap = new Map();
    for (const keyMeta of selectedMeta) {
      const records = compare.compareData.get(keyMeta.tokenId) || [];
      for (const record of records) {
        const modelName = String(record.model_name || '').trim() || 'unknown';
        if (!modelMap.has(modelName)) {
          modelMap.set(modelName, {
            modelName,
            perKey: {},
            totalCost: 0,
          });
        }
        const row = modelMap.get(modelName);
        if (!row.perKey[keyMeta.tokenId]) {
          row.perKey[keyMeta.tokenId] = { quota: 0, tokens: 0 };
        }
        const quota = Number(record.total_quota || 0);
        const tokens =
          Number(record.prompt_tokens || 0) +
          Number(record.completion_tokens || 0);
        row.perKey[keyMeta.tokenId].quota += quota;
        row.perKey[keyMeta.tokenId].tokens += tokens;
        row.totalCost += quotaToNumeric(quota);
      }
    }

    return Array.from(modelMap.values())
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 12)
      .map((item) => ({
        modelName: item.modelName,
        values: selectedMeta.map((meta) => {
          const perKey = item.perKey[meta.tokenId];
          if (!perKey) {
            return {
              costText: '-',
              tokenText: '-',
            };
          }
          return {
            costText: formatQuotaDisplay(quotaToNumeric(perKey.quota)),
            tokenText: renderCompactNumber(perKey.tokens),
          };
        }),
      }));
  }, [compare.compareData, hasSelection, selectedMeta]);

  const selectedSet = useMemo(
    () =>
      new Set(
        (compare.selectedTokenIds || []).map((id) => normalizeTokenIdKey(id)),
      ),
    [compare.selectedTokenIds],
  );

  const availableTokens = useMemo(
    () => tokenCandidates.filter((item) => !selectedSet.has(item.tokenId)),
    [tokenCandidates, selectedSet],
  );

  const trendHasData =
    specMultiLine?.data?.[0]?.values && specMultiLine.data[0].values.length > 0;

  const handleAddToken = () => {
    if (!pendingTokenId) {
      return;
    }
    const tokenId = normalizeTokenIdKey(pendingTokenId);
    if (!tokenId || selectedSet.has(tokenId)) {
      return;
    }
    compare.setSelectedTokenIds([...(compare.selectedTokenIds || []), tokenId]);
    setPendingTokenId('');
  };

  const handleRemoveToken = (tokenId) => {
    compare.setSelectedTokenIds(
      (compare.selectedTokenIds || []).filter((id) => id !== tokenId),
    );
  };

  const handleDateChange = (index, value) => {
    const current = Array.isArray(compare.dateRange)
      ? compare.dateRange
      : [new Date(), new Date()];
    const next = [...current];
    const picked = new Date(`${value}T00:00:00`);
    if (Number.isNaN(picked.getTime())) {
      return;
    }
    next[index] = picked;
    compare.setDateRange(next);
  };

  return (
    <div className='w-full max-w-none space-y-8 p-2 text-on-surface'>
      <section className='rounded-xl border border-gray-200 bg-white p-6 shadow-sm'>
        <h2 className="mb-4 font-['Public_Sans'] text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
          Select Keys To Compare
        </h2>

        <div className='flex flex-wrap items-center gap-4 xl:flex-nowrap'>
          <div className='min-w-[240px] flex-1 rounded-lg border border-gray-200 bg-gray-50 p-2.5 sm:min-w-[300px]'>
            <div className='flex flex-wrap items-center gap-2'>
              {selectedMeta.map((item) => (
                <span
                  key={item.tokenId}
                  className='inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold'
                  style={{
                    color: item.color,
                    borderColor: `${item.color}66`,
                    backgroundColor: `${item.color}1a`,
                  }}
                >
                  {item.name}
                  <button
                    type='button'
                    className='leading-none'
                    onClick={() => handleRemoveToken(item.tokenId)}
                  >
                    ×
                  </button>
                </span>
              ))}

              {selectedMeta.length === 0 && (
                <span className='px-2 py-1 text-xs text-gray-400'>
                  {compare.t('请选择 Key 添加')}
                </span>
              )}

              {availableTokens.length > 0 ? (
                <>
                  <select
                    className='min-w-[160px] flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary'
                    value={pendingTokenId}
                    onChange={(event) => setPendingTokenId(event.target.value)}
                  >
                    <option value=''>+ {compare.t('添加 Key')}</option>
                    {availableTokens.map((token) => (
                      <option key={token.tokenId} value={token.tokenId}>
                        {token.name}
                        {token.hasData ? '' : ` (${compare.t('无近期数据')})`}
                      </option>
                    ))}
                  </select>
                  <button
                    type='button'
                    className='rounded bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100'
                    onClick={handleAddToken}
                  >
                    {compare.t('添加')}
                  </button>
                </>
              ) : (
                <span className='rounded bg-gray-100 px-2 py-1 text-xs text-gray-500'>
                  {compare.t('已达上限或无可选 Key')}
                </span>
              )}
            </div>
          </div>

          <div className='flex flex-wrap rounded-lg bg-gray-100 p-1'>
            {(compare.granularityOptions || []).map((item) => {
              const active = compare.granularity === item.value;
              return (
                <button
                  key={item.value}
                  type='button'
                  className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-white font-semibold text-primary shadow-sm'
                      : 'font-medium text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => compare.setGranularity(item.value)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className='flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5'>
            <span aria-hidden='true' className='text-sm text-gray-500'>
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
            className='w-full rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
            disabled={compare.loading}
            onClick={compare.refresh}
          >
            {compare.loading ? compare.t('对比中...') : compare.t('对比')}
          </button>
        </div>
      </section>

      {hasSelection ? (
        displayStats.length > 0 ? (
          <section className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
            {displayStats.map((item) => (
              <article
                key={item.tokenId}
                className='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'
                style={{ borderLeftWidth: 4, borderLeftColor: item.color }}
              >
                <div
                  className='border-b border-gray-100 px-4 py-3'
                  style={{ backgroundColor: `${item.color}10` }}
                >
                  <span
                    className='text-xs font-bold uppercase tracking-wide'
                    style={{ color: item.color }}
                  >
                    {item.name}
                  </span>
                </div>
                <div className='space-y-4 p-4'>
                  <div>
                    <p className='mb-0.5 text-[10px] font-bold uppercase text-gray-400'>
                      Total Spend
                    </p>
                    <p className='text-2xl font-black text-gray-900'>
                      {item.costText}
                    </p>
                  </div>
                  <div className='rounded bg-green-50 px-2 py-1.5'>
                    <p className='mb-0.5 text-[10px] font-bold uppercase text-gray-400'>
                      Total Requests
                    </p>
                    <p className='text-sm font-bold text-gray-900'>
                      {item.requestsText}
                    </p>
                  </div>
                  <div>
                    <p className='mb-0.5 text-[10px] font-bold uppercase text-gray-400'>
                      Total Tokens
                    </p>
                    <p className='text-sm font-bold text-gray-900'>
                      {item.tokensText}
                    </p>
                  </div>
                  <div>
                    <p className='mb-0.5 text-[10px] font-bold uppercase text-gray-400'>
                      Avg Cost/Req
                    </p>
                    <p className='text-sm font-bold text-gray-900'>
                      {item.auxText}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className='rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500'>
            {compare.t('当前筛选条件暂无统计数据')}
            {!hasSelectedData && suggestedTokens.length > 0 && (
              <div className='mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500'>
                <span>{compare.t('可尝试有数据的 Key')}:</span>
                {suggestedTokens.map((item) => (
                  <button
                    key={item.tokenId}
                    type='button'
                    className='rounded border border-gray-200 bg-white px-2 py-1 hover:bg-gray-50'
                    onClick={() => compare.setSelectedTokenIds([item.tokenId])}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      ) : (
        <section className='rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500'>
          {compare.t('请选择至少一个 Key 进行对比')}
        </section>
      )}

      <section className='rounded-xl border border-gray-200 bg-white p-6 shadow-sm'>
        <div className='mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <h3 className="font-['Public_Sans'] text-base font-bold text-gray-900">
            Cost Trends Comparison
          </h3>
          <div className='flex flex-wrap rounded-lg bg-gray-100 p-1'>
            {METRIC_TABS.map((item) => (
              <button
                key={item.value}
                type='button'
                className={`rounded-md px-4 py-1.5 text-xs font-bold ${
                  activeMetric === item.value
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveMetric(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className='mb-6 h-64 overflow-x-auto'>
          <div className='h-full min-w-[520px]'>
            {hasSelection && trendHasData ? (
              <VChart spec={specMultiLine} option={CHART_CONFIG} />
            ) : (
              <div className='flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400'>
                {hasSelection
                  ? compare.t('当前时间范围暂无数据')
                  : compare.t('请选择 Key 查看趋势')}
              </div>
            )}
          </div>
        </div>

        <div className='flex flex-wrap justify-center gap-6 border-t border-gray-100 pt-4 text-xs font-semibold'>
          {selectedMeta.map((item) => (
            <div
              key={`${item.tokenId}-legend`}
              className='flex items-center gap-2'
            >
              <span
                className='h-2.5 w-2.5 rounded-full'
                style={{ backgroundColor: item.color }}
              ></span>
              <span>{item.name}</span>
            </div>
          ))}
          {!hasSelection && (
            <span className='text-gray-400'>{compare.t('尚未选择 Key')}</span>
          )}
        </div>
      </section>

      <section className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
        <div className='border-b border-gray-100 p-6'>
          <h3 className="font-['Public_Sans'] text-base font-bold text-gray-900">
            Model Cost Breakdown by Key
          </h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[920px] text-left'>
            <thead className='border-b border-gray-100 bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500'>
                  Model
                </th>
                {selectedMeta.map((item) => (
                  <th
                    key={`${item.tokenId}-head`}
                    className='px-4 py-3 text-[11px] font-bold uppercase tracking-wider'
                    style={{ color: item.color }}
                  >
                    {item.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {detailRows.map((row, rowIndex) => (
                <tr
                  key={`${row.modelName}-${rowIndex}`}
                  className='transition-colors hover:bg-gray-50/70'
                >
                  <td className='px-6 py-4 text-sm font-semibold text-gray-800'>
                    {row.modelName}
                  </td>
                  {row.values.map((value, index) => (
                    <td
                      key={`${row.modelName}-${index}`}
                      className='px-4 py-4 text-sm text-gray-700'
                    >
                      <div className='font-semibold'>{value.costText}</div>
                      <div className='text-xs text-gray-400'>
                        {value.tokenText}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}

              {detailRows.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(2, selectedMeta.length + 1)}
                    className='px-6 py-14 text-center text-sm text-gray-400'
                  >
                    {hasSelection
                      ? compare.t('暂无数据')
                      : compare.t('请选择 Key 后查看明细')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className='flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4 text-sm text-gray-500 md:flex-row md:items-center md:justify-between'>
          <span>
            {formatDateLabel(activeDateRange[0])} -{' '}
            {formatDateLabel(activeDateRange[1])}
          </span>
          <span>
            {hasCompareData
              ? compare.t('基于当前筛选条件实时统计')
              : compare.t('当前筛选条件暂无统计结果')}
          </span>
        </div>
      </section>
    </div>
  );
};

export default KeyCostCompare;
