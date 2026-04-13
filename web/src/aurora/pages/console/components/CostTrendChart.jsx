import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import MeasuredChartFrame from './MeasuredChartFrame';

const CostTrendChart = ({ title = '', data = [], yLabel = 'cost' }) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <h2 className='text-sm font-medium mb-2'>{title}</h2>
    <MeasuredChartFrame className='h-64' minHeight={256}>
      {({ width, height }) => (
        <AreaChart
          width={width}
          height={height}
          data={data}
          margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray={[3, 3].join(String.fromCharCode(32))}
          />
          <XAxis dataKey={(item) => item.time} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [value, yLabel]} />
          <Area
            type='monotone'
            dataKey={(item) => item.value}
            stroke='#14b8a6'
            fill='#14b8a6'
            fillOpacity={0.15}
          />
        </AreaChart>
      )}
    </MeasuredChartFrame>
  </div>
);

export default CostTrendChart;
