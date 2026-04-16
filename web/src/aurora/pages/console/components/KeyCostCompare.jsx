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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { VChart } from '@visactor/react-vchart';
import { CHART_CONFIG, COMPARE_COLORS } from '../../../../constants/key-cost.constants';
import { useKeyCompareData } from '../../../../hooks/key-cost/useKeyCompareData';
import { useKeyCompareCharts } from '../../../../hooks/key-cost/useKeyCompareCharts';
import { formatQuotaDisplay } from '../../../../helpers/key-cost';
import { renderNumber } from '../../../../helpers';

const PLACEHOLDER_KEYS = [
  { id: 'placeholder-main', name: 'Main Production', color: '#6366f1' },
  { id: 'placeholder-staging', name: 'Staging Alpha', color: '#14b8a6' },
  { id: 'placeholder-legacy', name: 'Legacy CRM', color: '#f59e0b' },
  { id: 'placeholder-bot', name: 'Customer Bot', color: '#ec4899' },
];

const PLACEHOLDER_STATS = [
  {
    tokenId: 'placeholder-main',
    name: 'Main Production',
    color: '#6366f1',
    costText: '$1,432.20',
    requestsText: '84.2k',
    tokensText: '428.1M',
    auxText: '842ms',
  },
  {
    tokenId: 'placeholder-staging',
    name: 'Staging Alpha',
    color: '#14b8a6',
    costText: '$42.80',
    requestsText: '3.1k',
    tokensText: '12.5M',
    auxText: '410ms',
  },
  {
    tokenId: 'placeholder-legacy',
    name: 'Legacy CRM',
    color: '#f59e0b',
    costText: '$512.15',
    requestsText: '22.4k',
    tokensText: '102.8M',
    auxText: '1240ms',
  },
  {
    tokenId: 'placeholder-bot',
    name: 'Customer Bot',
    color: '#ec4899',
    costText: '$980.50',
    requestsText: '61.9k',
    tokensText: '312.4M',
    auxText: '915ms',
  },
];

const PLACEHOLDER_BREAKDOWN_ROWS = [
  { modelName: 'gpt-4o', values: ['$842.50\n4.2k', '$21.40\n0.8k', '$0.00\n0', '$312.40\n15.6k'] },
  { modelName: 'claude-3.5-sonnet', values: ['$412.30\n3.1k', '$18.90\n1.4k', '$142.10\n10.1k', '$410.20\n32.2k'] },
  { modelName: 'gemini-1.5-pro', values: ['$122.10\n0.4k', '$5.20\n0.4k', '$34.50\n2.2k', '$212.40\n14.1k'] },
  { modelName: 'llama-3-70b', values: ['$55.30\n0.7k', '$6.30\n0.7k', '$29.55\n1.2k', '$45.50\n2.0k'] },
];

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

const buildStaticCompareChart = () => (
  <svg className='h-full w-full' preserveAspectRatio='none' viewBox='0 0 1000 280'>
    <path d='M0 210 C120 160, 240 180, 360 150 C480 120, 600 120, 720 170 C820 210, 920 180, 1000 130' fill='none' stroke='#6366f1' strokeWidth='4'></path>
    <path d='M0 240 C120 220, 240 230, 360 225 C480 220, 600 200, 720 185 C820 170, 920 160, 1000 150' fill='none' stroke='#14b8a6' strokeWidth='4'></path>
    <path d='M0 220 C120 210, 240 215, 360 230 C480 245, 600 245, 720 200 C820 165, 920 155, 1000 145' fill='none' stroke='#f59e0b' strokeWidth='4'></path>
    <path d='M0 200 C120 175, 240 155, 360 165 C480 178, 600 155, 720 150 C820 145, 920 175, 1000 120' fill='none' stroke='#ec4899' strokeWidth='4'></path>
  </svg>
);

const KeyCostCompare = () => {
  const compare = useKeyCompareData();
  const [activeMetric, setActiveMetric] = useState('cost');
  const [pendingTokenId, setPendingTokenId] = useState('');
  const autoSelectedRef = useRef(false);

  const { specMultiLine, compareStats } = useKeyCompareCharts(
    compare.compareData,
    activeMetric,
    compare.granularity,
    compare.t,
    compare.tokens,
  );

  useEffect(() => {
    if (autoSelectedRef.current) {
      return;
    }
    if ((compare.tokens || []).length === 0) {
      return;
    }
    if ((compare.selectedTokenIds || []).length > 0) {
      autoSelectedRef.current = true;
      return;
    }
    const initial = compare.tokens.slice(0, 4).map((token) => token.id);
    if (initial.length > 0) {
      compare.setSelectedTokenIds(initial);
      autoSelectedRef.current = true;
    }
  }, [compare]);

  const activeDateRange = Array.isArray(compare.dateRange)
    ? compare.dateRange
    : [new Date(), new Date()];

  const selectedMeta = useMemo(() => {
    const tokenMap = new Map((compare.tokens || []).map((token) => [token.id, token]));
    const selected = [];
    for (let index = 0; index < (compare.selectedTokenIds || []).length; index++) {
      const tokenId = compare.selectedTokenIds[index];
      const token = tokenMap.get(tokenId);
      selected.push({
        tokenId,
        name: token?.name || `Key #${tokenId}`,
        color: COMPARE_COLORS[index % COMPARE_COLORS.length],
      });
    }
    return selected;
  }, [compare.selectedTokenIds, compare.tokens]);

  const hasCompareData = (compareStats || []).length > 0;

  const displayStats = useMemo(() => {
    if (!hasCompareData) {
      return PLACEHOLDER_STATS;
    }
    return compareStats.map((item, index) => ({
      tokenId: item.tokenId,
      name: item.name,
      color: COMPARE_COLORS[index % COMPARE_COLORS.length],
      costText: item.cost,
      requestsText: renderCompactNumber(item.requests),
      tokensText: renderCompactNumber(item.tokens),
      auxText: item.avgCost,
    }));
  }, [compareStats, hasCompareData]);

  const detailRows = useMemo(() => {
    if (!hasCompareData || selectedMeta.length === 0) {
      return PLACEHOLDER_BREAKDOWN_ROWS;
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
        const tokens = Number(record.prompt_tokens || 0) + Number(record.completion_tokens || 0);
        row.perKey[keyMeta.tokenId].quota += quota;
        row.perKey[keyMeta.tokenId].tokens += tokens;
        row.totalCost += quota;
      }
    }

    return Array.from(modelMap.values())
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 8)
      .map((item) => ({
        modelName: item.modelName,
        values: selectedMeta.map((meta) => {
          const perKey = item.perKey[meta.tokenId] || { quota: 0, tokens: 0 };
          return `${formatQuotaDisplay(perKey.quota)}\n${renderCompactNumber(perKey.tokens)}`;
        }),
      }));
  }, [compare.compareData, hasCompareData, selectedMeta]);

  const selectedSet = useMemo(
    () => new Set(compare.selectedTokenIds || []),
    [compare.selectedTokenIds],
  );

  const availableTokens = useMemo(
    () => (compare.tokens || []).filter((item) => !selectedSet.has(item.id)),
    [compare.tokens, selectedSet],
  );

  const trendHasData =
    specMultiLine?.data?.[0]?.values && specMultiLine.data[0].values.length > 0;

  const handleAddToken = () => {
    if (!pendingTokenId) {
      return;
    }
    const tokenId = Number(pendingTokenId);
    if (!Number.isFinite(tokenId) || selectedSet.has(tokenId)) {
      return;
    }
    compare.setSelectedTokenIds([...(compare.selectedTokenIds || []), tokenId]);
    setPendingTokenId('');
  };

  const handleRemoveToken = (tokenId) => {
    compare.setSelectedTokenIds((compare.selectedTokenIds || []).filter((id) => id !== tokenId));
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

  const handleCompare = () => {
    compare.refresh();
  };

  return (
    <div className='mx-auto max-w-7xl space-y-8 p-2 text-on-surface'>
      <section className='rounded-xl border border-gray-200 bg-white p-6 shadow-sm'>
        <h2 className="mb-4 font-['Public_Sans'] text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
          Select Keys To Compare
        </h2>

        <div className='flex flex-wrap items-center gap-4'>
          <div className='min-w-[300px] flex-1 rounded-lg border border-gray-200 bg-gray-50 p-2.5'>
            <div className='flex flex-wrap items-center gap-2'>
              {(selectedMeta.length > 0 ? selectedMeta : PLACEHOLDER_KEYS).map((item) => (
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
                  {selectedMeta.length > 0 && (
                    <button
                      type='button'
                      className='leading-none'
                      onClick={() => handleRemoveToken(item.tokenId)}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}

              {selectedMeta.length > 0 && (
                <>
                  <select
                    className='min-w-[140px] flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary'
                    value={pendingTokenId}
                    onChange={(event) => setPendingTokenId(event.target.value)}
                  >
                    <option value=''>+ Add key...</option>
                    {availableTokens.map((token) => (
                      <option key={token.id} value={token.id}>
                        {token.name || `Key #${token.id}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type='button'
                    className='rounded bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100'
                    onClick={handleAddToken}
                  >
                    Add
                  </button>
                </>
              )}
            </div>
          </div>

          <div className='flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5'>
            <span className='material-symbols-outlined text-lg text-gray-500'>calendar_today</span>
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
            className='rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60'
            disabled={compare.loading}
            onClick={handleCompare}
          >
            {compare.loading ? 'Comparing...' : 'Compare'}
          </button>
        </div>
      </section>

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
              <span className='text-xs font-bold uppercase tracking-wide' style={{ color: item.color }}>
                {item.name}
              </span>
            </div>
            <div className='space-y-4 p-4'>
              <div>
                <p className='mb-0.5 text-[10px] font-bold uppercase text-gray-400'>Total Spend</p>
                <p className='text-2xl font-black text-gray-900'>{item.costText}</p>
              </div>
              <div className='rounded bg-green-50 px-2 py-1.5'>
                <p className='mb-0.5 text-[10px] font-bold uppercase text-gray-400'>Total Requests</p>
                <p className='text-sm font-bold text-gray-900'>{item.requestsText}</p>
              </div>
              <div>
                <p className='mb-0.5 text-[10px] font-bold uppercase text-gray-400'>Total Tokens</p>
                <p className='text-sm font-bold text-gray-900'>{item.tokensText}</p>
              </div>
              <div>
                <p className='mb-0.5 text-[10px] font-bold uppercase text-gray-400'>Avg Cost/Req</p>
                <p className='text-sm font-bold text-gray-900'>{item.auxText}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className='rounded-xl border border-gray-200 bg-white p-6 shadow-sm'>
        <div className='mb-8 flex items-center justify-between'>
          <h3 className="font-['Public_Sans'] text-base font-bold text-gray-900">Cost Trends Comparison</h3>
          <div className='flex rounded-lg bg-gray-100 p-1'>
            {[
              { value: 'cost', label: 'Cost' },
              { value: 'requests', label: 'Requests' },
              { value: 'tokens', label: 'Tokens' },
            ].map((item) => (
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

        <div className='mb-6 h-64'>
          {trendHasData ? (
            <VChart spec={specMultiLine} option={CHART_CONFIG} />
          ) : (
            <div className='h-full w-full'>{buildStaticCompareChart()}</div>
          )}
        </div>

        <div className='flex flex-wrap justify-center gap-6 border-t border-gray-100 pt-4 text-xs font-semibold'>
          {(selectedMeta.length > 0 ? selectedMeta : PLACEHOLDER_KEYS).map((item) => (
            <div key={`${item.tokenId}-legend`} className='flex items-center gap-2'>
              <span className='h-2.5 w-2.5 rounded-full' style={{ backgroundColor: item.color }}></span>
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
        <div className='border-b border-gray-100 p-6'>
          <h3 className="font-['Public_Sans'] text-base font-bold text-gray-900">Model Cost Breakdown by Key</h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[920px] text-left'>
            <thead className='border-b border-gray-100 bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500'>Model</th>
                {(selectedMeta.length > 0 ? selectedMeta : PLACEHOLDER_KEYS).map((item) => (
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
                <tr key={`${row.modelName}-${rowIndex}`} className='transition-colors hover:bg-gray-50/70'>
                  <td className='px-6 py-4 text-sm font-semibold text-gray-800'>{row.modelName}</td>
                  {row.values.map((value, index) => {
                    const [costText, tokenText] = String(value).split('\n');
                    return (
                      <td key={`${row.modelName}-${index}`} className='px-4 py-4 text-sm text-gray-700'>
                        <div className='font-semibold'>{costText || formatQuotaDisplay(0)}</div>
                        <div className='text-xs text-gray-400'>{tokenText || '0'}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {detailRows.length === 0 && (
                <tr>
                  <td
                    colSpan={(selectedMeta.length > 0 ? selectedMeta.length : PLACEHOLDER_KEYS.length) + 1}
                    className='px-6 py-14 text-center text-sm text-gray-400'
                  >
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className='flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4 text-sm text-gray-500'>
          <span>
            {formatDateLabel(activeDateRange[0])} - {formatDateLabel(activeDateRange[1])}
          </span>
          <span>{hasCompareData ? 'Real-time summary from selected keys' : 'Using layout placeholder data'}</span>
        </div>
      </section>
    </div>
  );
};

export default KeyCostCompare;
