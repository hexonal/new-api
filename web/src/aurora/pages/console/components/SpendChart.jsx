import React, { useState } from 'react';
import {
  ResponsiveContainer,
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

const COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
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

  const trendData = (data || [])
    .slice()
    .sort((a, b) => a.created_at - b.created_at)
    .map((item) => ({
      time: item.created_at,
      quota: Number(item.quota || 0),
      count: Number(item.count || 0),
      model: item.model_name || '未分类',
    }));

  const renderDistribution = () => (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={distData.length > 0 ? distData : [{ name: '无数据', value: 1 }]}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
          labelLine={{ strokeWidth: 1 }}
        >
          {distData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(val) => renderQuota(val)} />
      </PieChart>
    </ResponsiveContainer>
  );

  const renderTrend = () => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={trendData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="time" tickFormatter={formatTime} minTickGap={30} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip labelFormatter={formatTime} formatter={(val) => renderQuota(val)} />
        <Line type="monotone" dataKey="quota" stroke="#6366f1" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );

  const renderRequestDist = () => (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={reqDistData.length > 0 ? reqDistData : [{ name: '无数据', value: 1 }]}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
          labelLine={{ strokeWidth: 1 }}
        >
          {reqDistData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );

  const renderRequestRank = () => {
    const sorted = reqDistData.slice(0, 10);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ left: 80, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
          <Tooltip />
          <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const chartRenderers = {
    distribution: renderDistribution,
    trend: renderTrend,
    requestDist: renderRequestDist,
    requestRank: renderRequestRank,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
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
      <div className="h-[280px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            loading...
          </div>
        ) : (
          chartRenderers[activeTab]?.() || null
        )}
      </div>
    </div>
  );
};

export default SpendChart;
