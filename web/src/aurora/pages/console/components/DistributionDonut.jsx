import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Cell,
} from 'recharts';

const DEFAULT_COLORS = [
  '#3b82f6',
  '#f97316',
  '#14b8a6',
  '#8b5cf6',
  '#22d3ee',
  '#ec4899',
];

const DistributionDonut = ({ data = [], title = '' }) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <h2 className='text-sm font-medium mb-2'>{title}</h2>
    <div className='h-56'>
      <ResponsiveContainer width='100%' height='100%'>
        <PieChart>
          <Pie
            data={data}
            dataKey='value'
            nameKey='name'
            innerRadius={50}
            outerRadius={80}
            label
          >
            {data.map((entry, index) => (
              <Cell key={entry.name || index} fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default DistributionDonut;
