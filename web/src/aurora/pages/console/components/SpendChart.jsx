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

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { renderQuota } from '../../../../helpers';
import MeasuredChartFrame from './MeasuredChartFrame';
import {
  buildPieChartData,
  buildPieLabelAllowList,
  buildPieLegendItems,
  formatPieLabel,
  shouldRenderPieLabel,
} from './spend-chart-utils';
import {
  sanitizeDashboardMetricNumber,
} from '../dashboard/dashboard-value-guards.js';
import { SPEND_CHART_TABS } from './spend-chart-constants.js';

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#84cc16',
];

const formatTime = (value) => {
  if (!value) return '-';
  const d = new Date(Number(value) * 1000);
  if (isNaN(d.getTime())) return '-';
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
};

const SpendChart = ({
  title = '模型数据分析',
  data = [],
  pieData = [],
  modelColors = {},
  loading = false,
  activeTab: controlledActiveTab,
  onTabChange,
  showTabs = true,
  showTitle = true,
}) => {
  const { t } = useTranslation();
  const [internalActiveTab, setInternalActiveTab] = useState('distribution');
  const activeTab = controlledActiveTab || internalActiveTab;
  const setActiveTab = onTabChange || setInternalActiveTab;

  // Aggregate data for charts
  const modelMap = {};
  (data || []).forEach((item) => {
    const name = item.model_name || item.model || '未分类';
    if (!modelMap[name]) modelMap[name] = { quota: 0, count: 0 };
    modelMap[name].quota += sanitizeDashboardMetricNumber(item.quota);
    modelMap[name].count += sanitizeDashboardMetricNumber(item.count);
  });

  const distData = Object.entries(modelMap)
    .map(([name, v]) => ({ name, value: v.quota }))
    .sort((a, b) => b.value - a.value);

  const reqDistData = Object.entries(modelMap)
    .map(([name, v]) => ({ name, value: v.count }))
    .sort((a, b) => b.value - a.value);

  const distributionPieData = buildPieChartData(distData);
  const requestPieData = buildPieChartData(reqDistData);
  const distributionLegendItems = buildPieLegendItems(distributionPieData);
  const requestLegendItems = buildPieLegendItems(requestPieData);
  const distributionLabelAllowList =
    buildPieLabelAllowList(distributionPieData);
  const requestLabelAllowList = buildPieLabelAllowList(requestPieData);

  const trendData = (data || [])
    .slice()
    .sort((a, b) => a.created_at - b.created_at)
    .map((item) => ({
      time: item.created_at,
      quota: sanitizeDashboardMetricNumber(item.quota),
      count: sanitizeDashboardMetricNumber(item.count),
      model: item.model_name || '未分类',
    }));

  const renderPieLegend = (items) => (
    <div className='flex min-w-[180px] flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3'>
      {items.map((item, index) => (
        <div
          key={item.name}
          className='flex items-center justify-between gap-3 text-xs'
        >
          <div className='flex min-w-0 items-center gap-2'>
            <span
              className='h-2.5 w-2.5 flex-shrink-0 rounded-full'
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className='truncate text-foreground'>{item.name}</span>
          </div>
          <span className='flex-shrink-0 text-muted-foreground'>
            {item.percentText}
          </span>
        </div>
      ))}
    </div>
  );

  const renderDistribution = () => {
    const chartData =
      distributionPieData.length > 0
        ? distributionPieData
        : [{ name: t('无数据'), value: 1 }];

    return (
      <div className='flex h-full min-w-0 flex-col gap-4 lg:flex-row lg:items-center'>
        <MeasuredChartFrame className='flex-1' minHeight={280}>
          {({ width, height }) => (
            <PieChart width={width} height={height}>
              <Pie
                data={chartData}
                innerRadius={60}
                outerRadius={100}
                dataKey={(item) => item.value}
                label={({ name, percent }) =>
                  distributionLabelAllowList.has(name) &&
                  shouldRenderPieLabel(percent, 5)
                    ? formatPieLabel({ name, percent })
                    : ''
                }
                labelLine={{ strokeWidth: 1 }}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => renderQuota(val)} />
            </PieChart>
          )}
        </MeasuredChartFrame>
        {distributionLegendItems.length
          ? renderPieLegend(distributionLegendItems)
          : null}
      </div>
    );
  };

  const renderTrend = () => (
    <MeasuredChartFrame className='h-full' minHeight={280}>
      {({ width, height }) => (
        <LineChart
          width={width}
          height={height}
          data={trendData}
          margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray={[3, 3].join(String.fromCharCode(32))}
            stroke='hsl(var(--border))'
          />
          <XAxis
            dataKey={(item) => item.time}
            tickFormatter={formatTime}
            minTickGap={30}
            tick={{ fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            labelFormatter={formatTime}
            formatter={(val) => renderQuota(val)}
          />
          <Line
            type='monotone'
            dataKey={(item) => item.quota}
            stroke='#6366f1'
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      )}
    </MeasuredChartFrame>
  );

  const renderRequestDist = () => {
    const chartData =
      requestPieData.length > 0
        ? requestPieData
        : [{ name: t('无数据'), value: 1 }];

    return (
      <div className='flex h-full min-w-0 flex-col gap-4 lg:flex-row lg:items-center'>
        <MeasuredChartFrame className='flex-1' minHeight={280}>
          {({ width, height }) => (
            <PieChart width={width} height={height}>
              <Pie
                data={chartData}
                innerRadius={60}
                outerRadius={100}
                dataKey={(item) => item.value}
                label={({ name, percent }) =>
                  requestLabelAllowList.has(name) &&
                  shouldRenderPieLabel(percent, 5)
                    ? formatPieLabel({ name, percent })
                    : ''
                }
                labelLine={{ strokeWidth: 1 }}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          )}
        </MeasuredChartFrame>
        {requestLegendItems.length ? renderPieLegend(requestLegendItems) : null}
      </div>
    );
  };

  const renderRequestRank = () => {
    const sorted = reqDistData.slice(0, 10);
    return (
      <MeasuredChartFrame className='h-full' minHeight={280}>
        {({ width, height }) => (
          <BarChart
            width={width}
            height={height}
            data={sorted}
            layout='vertical'
            margin={{ left: 80, right: 20 }}
          >
            <CartesianGrid
              strokeDasharray={[3, 3].join(String.fromCharCode(32))}
              stroke='hsl(var(--border))'
            />
            <XAxis type='number' tick={{ fontSize: 11 }} />
            <YAxis
              type='category'
              dataKey={(item) => item.name}
              tick={{ fontSize: 11 }}
              width={80}
            />
            <Tooltip />
            <Bar
              dataKey={(item) => item.value}
              fill='#6366f1'
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        )}
      </MeasuredChartFrame>
    );
  };

  const chartRenderers = {
    distribution: renderDistribution,
    trend: renderTrend,
    requestDist: renderRequestDist,
    requestRank: renderRequestRank,
  };

  return (
    <div className='rounded-xl border border-border bg-card p-4'>
      {(showTitle || showTabs) && (
        <div className='mb-3 flex items-center justify-between'>
          {showTitle ? <h2 className='text-sm font-medium'>{title}</h2> : <div />}
          {showTabs && (
            <div className='flex gap-1'>
              {SPEND_CHART_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type='button'
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className='h-[280px] min-w-0'>
        {loading ? (
          <div className='h-full flex items-center justify-center text-sm text-muted-foreground'>
            {t('loading...')}
          </div>
        ) : (
          chartRenderers[activeTab]?.() || null
        )}
      </div>
    </div>
  );
};

export default SpendChart;
