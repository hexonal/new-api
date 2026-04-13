import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import MeasuredChartFrame from './MeasuredChartFrame';

const RankingBarChart = ({ data = [], title = '' }) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <h2 className='text-sm font-medium mb-2'>{title}</h2>
    <MeasuredChartFrame className='h-56' minHeight={224}>
      {({ width, height }) => (
        <BarChart
          width={width}
          height={height}
          data={data}
          margin={{ left: 8, right: 8, top: 10, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray={[3, 3].join(String.fromCharCode(32))}
          />
          <XAxis dataKey={(item) => item.name} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey={(item) => item.value} fill='#6366f1' />
        </BarChart>
      )}
    </MeasuredChartFrame>
  </div>
);

export default RankingBarChart;
