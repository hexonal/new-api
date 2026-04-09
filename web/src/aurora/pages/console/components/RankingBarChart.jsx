import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const RankingBarChart = ({ data = [], title = '' }) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <h2 className='text-sm font-medium mb-2'>{title}</h2>
    <div className='h-56'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={data} margin={{ left: 8, right: 8, top: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray={[3, 3].join(String.fromCharCode(32))} />
          <XAxis dataKey={(item) => item.name} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey={(item) => item.value} fill='#6366f1' />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default RankingBarChart;
