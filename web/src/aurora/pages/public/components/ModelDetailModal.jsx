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

import React, { useMemo } from 'react';
import { Copy } from 'lucide-react';
import {
  calculateModelPrice,
  getLobeHubIcon,
  getModelPriceItems,
} from '../../../../helpers';
import { Badge } from '../../../primitives/badge';
import { Button } from '../../../primitives/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../primitives/sheet';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../../primitives/table';

const ENDPOINT_PATH_MAP = {
  openai: { path: '/v1/chat/completions', method: 'POST' },
  anthropic: { path: '/v1/messages', method: 'POST' },
  'openai-videos': { path: '/v1/video/generations', method: 'POST' },
  'openai-images': { path: '/v1/images/generations', method: 'POST' },
  midjourney: { path: '/mj/submit/imagine', method: 'POST' },
  gemini: { path: '/v1beta/models/*:generateContent', method: 'POST' },
};

const resolveEndpointInfo = (endpoint) =>
  ENDPOINT_PATH_MAP[endpoint] || { path: '/v1/chat/completions', method: 'POST' };

const getLogoNode = (model) => {
  const iconName = model?.vendor_icon || model?.icon || '';
  if (iconName) {
    return getLobeHubIcon(iconName, 30);
  }
  const first = String(model?.vendor_name || model?.model_name || '?')
    .slice(0, 1)
    .toUpperCase();
  return <span className='text-xs font-semibold'>{first}</span>;
};

const getBillingText = (model, t) => {
  if (model?.quota_type === 0) return t('按量计费');
  if (model?.quota_type === 1) return t('按次计费');
  return t('未知计费');
};

export default function ModelDetailModal({
  model,
  open,
  onClose,
  groupRatio,
  groupModelRatio,
  tokenUnit,
  displayPrice,
  autoGroups,
  copyText,
  t,
}) {
  const endpointTypes = useMemo(
    () =>
      (Array.isArray(model?.supported_endpoint_types)
        ? model.supported_endpoint_types
        : []
      ).filter(Boolean),
    [model],
  );

  const priceRows = useMemo(() => {
    const groups = Array.isArray(model?.enable_groups)
      ? model.enable_groups.filter(Boolean)
      : [];
    return groups.map((group) => {
      const priceData = calculateModelPrice({
        record: model,
        selectedGroup: group,
        groupRatio,
        groupModelRatio,
        tokenUnit,
        displayPrice,
        currency: 'USD',
        quotaDisplayType: 'USD',
      });
      const items = getModelPriceItems(priceData, t, 'USD');
      return {
        group,
        items,
      };
    });
  }, [model, groupRatio, groupModelRatio, tokenUnit, displayPrice, t]);

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <SheetContent
        side='right'
        className='max-w-none overflow-y-auto p-0'
        style={{ width: 'min(640px, 90vw)' }}
      >
        <SheetHeader className='border-b border-border px-6 py-4'>
          <div className='flex items-start justify-between gap-3 pr-8'>
            <div className='flex min-w-0 items-center gap-3'>
              <div className='flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted'>
                {getLogoNode(model)}
              </div>
              <div className='min-w-0'>
                <SheetTitle className='truncate text-3xl font-bold'>
                  {model?.model_name || t('未知模型')}
                </SheetTitle>
                <SheetDescription className='mt-1 text-sm'>
                  {model?.vendor_name || t('未知供应商')}
                </SheetDescription>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                variant='outline'
                onClick={() => copyText?.(model?.model_name || '')}
              >
                <Copy className='mr-1 h-3.5 w-3.5' />
                {t('复制')}
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className='space-y-6 px-6 py-5'>
          <section className='space-y-3'>
            <h3 className='text-base font-semibold'>{t('模型支持的接口端点信息')}</h3>
            <div className='rounded-lg border border-border'>
              <Table>
                <Thead>
                  <Tr>
                    <Th>{t('端点')}</Th>
                    <Th>{t('路径')}</Th>
                    <Th>{t('方法')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {endpointTypes.map((endpoint) => {
                    const info = resolveEndpointInfo(endpoint);
                    return (
                      <Tr key={`${model?.model_name}-${endpoint}`}>
                        <Td>
                          <div className='flex items-center gap-2'>
                            <span className='inline-block h-2 w-2 rounded-full bg-emerald-500' />
                            <span className='font-medium'>{endpoint}</span>
                          </div>
                        </Td>
                        <Td className='font-mono text-xs'>{info.path}</Td>
                        <Td>
                          <Badge variant='secondary'>{info.method}</Badge>
                        </Td>
                      </Tr>
                    );
                  })}
                  {endpointTypes.length === 0 ? (
                    <Tr>
                      <Td colSpan={3} className='py-5 text-center text-sm text-muted-foreground'>
                        {t('暂无端点信息')}
                      </Td>
                    </Tr>
                  ) : null}
                </Tbody>
              </Table>
            </div>
          </section>

          <section className='space-y-3'>
            <div>
              <h3 className='text-base font-semibold'>{t('分组价格')}</h3>
              <p className='text-sm text-muted-foreground'>{t('不同用户分组的价格信息')}</p>
            </div>

            {Array.isArray(autoGroups) && autoGroups.length > 0 ? (
              <div className='rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700'>
                {t('auto分组调用链路')} {'->'} {autoGroups.join(', ') || t('默认分组')}
              </div>
            ) : null}

            <div className='rounded-lg border border-border'>
              <Table>
                <Thead>
                  <Tr>
                    <Th>{t('分组')}</Th>
                    <Th>{t('计费类型')}</Th>
                    <Th>{t('价格摘要')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {priceRows.map((row) => (
                    <Tr key={`${model?.model_name}-${row.group}`}>
                      <Td>
                        <Badge variant='outline'>{row.group}</Badge>
                      </Td>
                      <Td>
                        <Badge variant='secondary'>{getBillingText(model, t)}</Badge>
                      </Td>
                      <Td>
                        <div className='space-y-1'>
                          {row.items.map((item) => (
                            <div
                              key={`${row.group}-${item.key}`}
                              className='text-sm text-muted-foreground'
                            >
                              <span>{item.label} </span>
                              <span className='font-semibold text-foreground'>
                                {item.value}
                                {item.suffix || ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                  {priceRows.length === 0 ? (
                    <Tr>
                      <Td colSpan={3} className='py-5 text-center text-sm text-muted-foreground'>
                        {t('暂无分组价格')}
                      </Td>
                    </Tr>
                  ) : null}
                </Tbody>
              </Table>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
