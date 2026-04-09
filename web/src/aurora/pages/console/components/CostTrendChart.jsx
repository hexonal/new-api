import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const CostTrendChart = ({ title = '', data = [], yLabel = 'cost' }) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <h2 className='text-sm font-medium mb-2'>{title}</h2>
    <div className='h-64'>
      <ResponsiveContainer width='100%' height='100%'>
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [value, yLabel]} />
          <Area
            type='monotone'
            dataKey='value'
            stroke='#14b8a6'
            fill='#14b8a6'
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default CostTrendChart;
