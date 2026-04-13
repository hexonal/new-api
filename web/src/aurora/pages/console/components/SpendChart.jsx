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

const TABS = [
  { key: 'distribution', label: '消耗分布' },
  { key: 'trend', label: '消耗趋势' },
  { key: 'requestDist', label: '调用次数分布' },
  { key: 'requestRank', label: '调用次数排行' },
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
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('distribution');

  // Aggregate data for charts
  const modelMap = {};
  (data || []).forEach((item) => {
    const name = item.model_name || item.model || '未分类';
    if (!modelMap[name]) modelMap[name] = { quota: 0, count: 0 };
    modelMap[name].quota += Number(item.quota || 0);
    modelMap[name].count += Number(item.count || 0);
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
      quota: Number(item.quota || 0),
      count: Number(item.count || 0),
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
      <div className='flex items-center justify-between mb-3'>
        <h2 className='text-sm font-medium'>{title}</h2>
        <div className='flex gap-1'>
          {TABS.map((tab) => (
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
      </div>
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
