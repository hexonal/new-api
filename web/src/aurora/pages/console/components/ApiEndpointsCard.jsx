import React from 'react';
import { Copy, Zap, ExternalLink } from 'lucide-react';
import { Button } from '../../../primitives/button';
import { showSuccess } from '../../../../helpers';

const ApiEndpointsCard = ({ endpoints = [], t = (value) => value }) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <div className='flex items-center justify-between mb-3'>
      <h2 className='text-sm font-medium'>{t('API信息')}</h2>
      <Button
        variant='outline'
        size='sm'
        onClick={async () => {
          const text = endpoints.map((item) => item?.url || item).filter(Boolean).join('\n');
          await navigator.clipboard.writeText(text);
          showSuccess(t('已复制'));
        }}
      >
        <Copy className='h-3 w-3 mr-1' />
        {t('复制全部')}
      </Button>
    </div>
    <div className='space-y-2'>
      {endpoints.map((item, idx) => {
        const url = item?.url || item?.api_url || item?.endpoint || item;
        const route = item?.route || `Endpoint ${idx + 1}`;
        const desc = item?.description || '';
        if (!url) return null;
        return (
          <div
            key={url}
            className='rounded-lg border border-border p-3 flex items-start justify-between gap-2'
          >
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2 mb-1'>
                <span className={`inline-block w-2 h-2 rounded-full ${
                  item?.color === 'cyan' ? 'bg-cyan-400' : 'bg-blue-400'
                }`} />
                <span className='text-sm font-medium'>{route}</span>
              </div>
              <a
                href={url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-xs text-primary hover:underline break-all'
              >
                {url}
              </a>
              {desc ? (
                <p className='text-xs text-muted-foreground mt-1'>{desc}</p>
              ) : null}
            </div>
            <div className='flex gap-1 flex-shrink-0'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  window.open(`${url}/v1/chat/completions`, '_blank');
                }}
              >
                <Zap className='h-3 w-3 mr-1' />
                {t('测速')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => window.open(url, '_blank')}
              >
                <ExternalLink className='h-3 w-3 mr-1' />
                {t('跳转')}
              </Button>
            </div>
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
