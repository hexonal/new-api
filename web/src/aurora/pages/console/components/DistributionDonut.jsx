import React from 'react';
import { PieChart, Pie, Tooltip, Cell } from 'recharts';
import MeasuredChartFrame from './MeasuredChartFrame';

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
    <MeasuredChartFrame className='h-56' minHeight={224}>
      {({ width, height }) => (
        <PieChart width={width} height={height}>
          <Pie
            data={data}
            dataKey={(item) => item.value}
            nameKey={(item) => item.name}
            innerRadius={50}
            outerRadius={80}
            label
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.name || index}
                fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      )}
    </MeasuredChartFrame>
  </div>
);

export default DistributionDonut;
