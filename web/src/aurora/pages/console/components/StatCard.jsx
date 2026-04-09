import React from 'react';

const StatCard = ({
  title = '',
  value = 0,
  icon = null,
  description = '',
  trend = null,
}) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <div className='flex items-start justify-between'>
      <div>
        <p className='text-xs text-muted-foreground'>{title}</p>
        <p className='mt-2 text-2xl font-semibold text-foreground'>
          {typeof value === 'number' && isNaN(value) ? '—' : value}
        </p>
        {description ? (
          <p className='text-xs text-muted-foreground mt-1'>{description}</p>
        ) : null}
        {trend != null ? (
          <p
            className={`text-xs mt-1 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}
          >
            {trend >= 0 ? `+${trend}` : trend}
          </p>
        ) : null}
      </div>
      {icon ? <div className='text-blue-400'>{icon}</div> : null}
    </div>
  </div>
);

export default StatCard;
