import React from 'react';
import { Copy } from 'lucide-react';
import { Button } from '../../../primitives/button';

const ApiEndpointsCard = ({ endpoints = [], t = (value) => value }) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <div className='flex items-center justify-between mb-3'>
      <h2 className='text-sm font-medium'>{t('API Endpoint')}</h2>
      <Button
        variant='outline'
        size='sm'
        onClick={async () => {
          await navigator.clipboard.writeText(
            endpoints.map((item) => item?.api_url || item).filter(Boolean).join('\n'),
          );
        }}
      >
        <Copy className='h-4 w-4 mr-1' />
        {t('复制全部')}
      </Button>
    </div>
    <div className='space-y-2'>
      {endpoints.map((item) => {
        const url = item?.url || item?.api_url || item?.endpoint || item;
        if (!url) return null;
        return (
          <div
            key={url}
            className='text-xs rounded-md bg-muted px-3 py-2 text-muted-foreground break-all'
          >
            {url}
          </div>
        );
      })}
      {!endpoints.length ? (
        <p className='text-sm text-muted-foreground'>{t('暂无可用 API 端点')}</p>
      ) : null}
    </div>
  </div>
);

export default ApiEndpointsCard;
