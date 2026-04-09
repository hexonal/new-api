import React from 'react';
import { Badge } from '../../../primitives/badge';

const getPercent = (readyCount, totalCount) => {
  if (!totalCount) return 0;
  return Math.round((readyCount / totalCount) * 100);
};

const ServiceHealthCard = ({
  items = [],
  loading = false,
  t = (value) => value,
}) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <h2 className='text-sm font-medium mb-3'>{t('服务健康度')}</h2>
    {loading ? (
      <div className='text-sm text-muted-foreground'>{t('loading...')}</div>
    ) : (
      <div className='space-y-3'>
        {items.map((service) => {
          const health = getPercent(
            Number(service?.available || 0),
            Number(service?.total || service?.monitors || 0) || 1,
          );
          return (
            <div key={service?.name || service?.categoryName || Math.random()} className='text-sm'>
              <div className='mb-1 flex items-center justify-between'>
                <span>{service?.name || service?.categoryName || t('服务')}</span>
                <span>{health}%</span>
              </div>
              <div className='h-2 rounded-full bg-secondary overflow-hidden'>
                <div
                  className='h-full bg-green-500'
                  style={{ width: `${health}%` }}
                />
              </div>
              <div className='mt-1'>
                <Badge variant={health >= 90 ? 'default' : 'destructive'}>
                  {health >= 90 ? t('良好') : t('波动')}
                </Badge>
              </div>
            </div>
          );
        })}
        {!items?.length ? (
          <p className='text-sm text-muted-foreground'>{t('暂无服务数据')}</p>
        ) : null}
      </div>
    )}
  </div>
);

export default ServiceHealthCard;
