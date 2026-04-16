/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Copy, Zap, ExternalLink } from 'lucide-react';
import { Button } from '../../../primitives/button';
import { showSuccess } from '../../../../helpers';
import { normalizeApiEndpoint } from './api-endpoint-utils';

const ApiEndpointsCard = ({ endpoints = [], t = (value) => value }) => (
  <section className='space-y-4'>
    <div className='flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-slate-900'>
      <span className='h-1.5 w-1.5 rounded-full bg-indigo-600' />
      <h2>{t('API Endpoints')}</h2>
    </div>
    <div className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm'>
      <div className='mb-4 flex items-center justify-between'>
        <p className='text-xs font-semibold uppercase tracking-[0.16em] text-slate-400'>
          {t('Gateway Routes')}
        </p>
      <Button
        variant='outline'
        size='sm'
        onClick={async () => {
          const text = endpoints.map((item) => item?.url || item).filter(Boolean).join('\n');
          await navigator.clipboard.writeText(text);
          showSuccess(t('已复制'));
        }}
      >
          <Copy className='mr-1 h-3 w-3' />
          {t('复制全部')}
        </Button>
      </div>
      <div className='space-y-3'>
        {endpoints.map((item, idx) => {
        const endpoint = normalizeApiEndpoint(item, idx);
        if (!endpoint) return null;

        const { key, url, route, description } = endpoint;

          return (
            <div
              key={key}
              className='rounded-xl border border-slate-200 bg-white p-4'
            >
              <div className='mb-3 flex items-start justify-between gap-3'>
                <div>
                  <div className='mb-1 flex items-center gap-2'>
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        item?.color === 'cyan' ? 'bg-cyan-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span className='text-sm font-bold text-slate-900'>{route}</span>
                  </div>
                  {description ? (
                    <p className='text-xs leading-5 text-slate-500'>{description}</p>
                  ) : null}
                </div>
                <p className='rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600'>
                  {t('Active')}
                </p>
              </div>
              <a
                href={url}
                target='_blank'
                rel='noopener noreferrer'
                className='mb-4 block rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600 hover:text-primary'
              >
                {url}
              </a>
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  onClick={() => {
                    window.open(`${url}/v1/chat/completions`, '_blank');
                  }}
                >
                  <Zap className='mr-1 h-3 w-3' />
                  {t('Test')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => window.open(url, '_blank')}
                >
                  <ExternalLink className='mr-1 h-3 w-3' />
                  {t('Go')}
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
  </section>
);

export default ApiEndpointsCard;
