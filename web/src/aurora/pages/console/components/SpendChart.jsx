import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const formatTime = (value) => {
  if (!value) return '-';
  const date = new Date(Number(value) * 1000);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const SpendChart = ({ title = '', data = [], loading = false }) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <h2 className='text-sm font-medium mb-3'>{title}</h2>
    <div className='h-[260px]'>
      {loading ? (
        <div className='h-full flex items-center justify-center text-sm text-muted-foreground'>
          loading...
        </div>
      ) : (
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis
              dataKey='time'
              tickFormatter={formatTime}
              minTickGap={20}
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(value) => `Time: ${formatTime(value)}`}
              formatter={(value) => [value, 'Quota']}
            />
            <Line type='monotone' dataKey='quota' stroke='#8b5cf6' strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

export default SpendChart;
