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
import { X } from 'lucide-react';
import { splitTags } from './helpers';

const DrawerHeader = ({ detailModel, onClose }) => (
  <div className='sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-4'>
    <div className='flex items-start justify-between gap-4'>
      <div>
        <h2
          className='text-lg font-bold text-slate-900'
          style={{ fontFamily: 'Public Sans, sans-serif' }}
        >
          {detailModel.model_name}
        </h2>
        <p className='text-xs text-slate-500'>{detailModel.provider}</p>
      </div>
      <button
        type='button'
        className='rounded p-1 text-slate-400 transition-colors hover:text-slate-600'
        onClick={onClose}
      >
        <X className='h-5 w-5' />
      </button>
    </div>
  </div>
);

const DescriptionSection = ({ detailModel, t }) => (
  <section className='rounded-xl border border-slate-200 p-4'>
    <h3 className='mb-2 text-sm font-bold uppercase tracking-wider text-slate-500'>
      {t('描述')}
    </h3>
    <p className='text-sm leading-relaxed text-slate-700'>
      {detailModel.description || t('暂无模型描述')}
    </p>
    <div className='mt-3 flex flex-wrap gap-2'>
      {splitTags(detailModel.tags).map((tag) => (
        <span
          key={`${detailModel.model_name}-${tag}`}
          className='rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600'
        >
          {tag}
        </span>
      ))}
    </div>
  </section>
);

const EndpointsSection = ({ detailEndpoints, detailModel, t }) => (
  <section className='rounded-xl border border-slate-200 p-4'>
    <h3 className='mb-2 text-sm font-bold uppercase tracking-wider text-slate-500'>
      {t('模型支持的接口端点信息')}
    </h3>
    {detailEndpoints.length === 0 ? (
      <p className='text-sm text-slate-500'>{t('暂无端点信息')}</p>
    ) : (
      <div className='space-y-2'>
        {detailEndpoints.map((endpoint) => (
          <div
            key={`${detailModel.model_name}-${endpoint.type}`}
            className='rounded-lg border border-slate-100 bg-slate-50 px-3 py-2'
          >
            <div className='text-xs font-semibold text-slate-700'>{endpoint.type}</div>
            <div className='mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500'>
              <span className='break-all'>{endpoint.path || '-'}</span>
              <span className='rounded bg-white px-2 py-0.5 font-semibold text-slate-600'>
                {endpoint.method}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

const AutoChainBlock = ({ detailAutoChain, detailModel, t }) => {
  if (detailAutoChain.length === 0) {
    return null;
  }

  return (
    <div className='mb-3 flex flex-wrap items-center gap-1 text-[11px] text-slate-500'>
      <span>{t('自动选择')}</span>
      <span>→</span>
      {detailAutoChain.map((group, index) => (
        <React.Fragment key={`${detailModel.model_name}-${group}`}>
          <span className='rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600'>
            {group}
          </span>
          {index < detailAutoChain.length - 1 && <span>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

const PricingItemRows = ({ detailModel, row }) => (
  <div className='space-y-1'>
    {row.items.map((item) => (
      <div
        key={`${detailModel.model_name}-${row.group}-${item.key}`}
        className='text-[11px] text-slate-600'
      >
        <span className='font-semibold text-slate-700'>{item.label}</span> {item.value}
        {item.suffix}
      </div>
    ))}
  </div>
);

const HailuoSkuRows = ({ detailModel, displayPrice, row, t }) => {
  if (!Array.isArray(row.hailuoSkuRows) || row.hailuoSkuRows.length === 0) {
    return null;
  }

  return (
    <div className='mt-2 space-y-2'>
      {row.hailuoSkuRows.map((skuRow) => (
        <div
          key={`${detailModel.model_name}-${row.group}-${skuRow.sku}`}
          className='rounded border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-600'
        >
          <div className='font-semibold text-slate-700'>{skuRow.sku}</div>
          <div className='mt-1'>{`${skuRow.duration}s · ${skuRow.resolution} · ${skuRow.official_points}`}</div>
          <div>{`${displayPrice(skuRow.unitPrice)} / ${t('次')}`}</div>
          <div>{`${displayPrice(skuRow.finalPrice)} / ${t('次')}`}</div>
        </div>
      ))}
    </div>
  );
};

const PricingGroupRow = ({ detailModel, displayPrice, row, t }) => (
  <div
    key={`${detailModel.model_name}-${row.group}`}
    className='rounded-lg border border-slate-100 bg-slate-50 px-3 py-2'
  >
    <div className='mb-2 flex items-center justify-between gap-2'>
      <div className='text-xs font-semibold text-slate-700'>{row.group}</div>
      <div className='flex items-center gap-1'>
        <span className='rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600'>
          {row.ratio}x
        </span>
        <span className='rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600'>
          {row.billingType === 'per_call' ? t('按次计费') : t('按量计费')}
        </span>
      </div>
    </div>

    <PricingItemRows detailModel={detailModel} row={row} />
    <HailuoSkuRows detailModel={detailModel} displayPrice={displayPrice} row={row} t={t} />
  </div>
);

const PricingSection = ({
  detailAutoChain,
  detailModel,
  detailPricingRows,
  displayPrice,
  t,
}) => (
  <section className='rounded-xl border border-slate-200 p-4'>
    <h3 className='mb-2 text-sm font-bold uppercase tracking-wider text-slate-500'>
      {t('当前计费')}
    </h3>
    <AutoChainBlock detailAutoChain={detailAutoChain} detailModel={detailModel} t={t} />
    <div className='space-y-3'>
      {detailPricingRows.length === 0 && (
        <p className='text-sm text-slate-500'>{t('暂无分组价格')}</p>
      )}
      {detailPricingRows.map((row) => (
        <PricingGroupRow
          key={`${detailModel.model_name}-${row.group}`}
          detailModel={detailModel}
          displayPrice={displayPrice}
          row={row}
          t={t}
        />
      ))}
    </div>
  </section>
);

const ModelDetailDrawer = ({
  detailAutoChain,
  detailEndpoints,
  detailModel,
  detailPricingRows,
  displayPrice,
  onClose,
  t,
}) => {
  if (!detailModel) {
    return null;
  }

  return (
    <div className='fixed inset-0 z-50 flex justify-end'>
      <button
        type='button'
        aria-label={t('关闭')}
        className='absolute inset-0 bg-slate-900/30'
        onClick={onClose}
      />
      <aside className='relative z-10 h-full w-full max-w-[560px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl'>
        <DrawerHeader detailModel={detailModel} onClose={onClose} />

        <div className='space-y-5 p-6'>
          <DescriptionSection detailModel={detailModel} t={t} />
          <EndpointsSection
            detailEndpoints={detailEndpoints}
            detailModel={detailModel}
            t={t}
          />
          <PricingSection
            detailAutoChain={detailAutoChain}
            detailModel={detailModel}
            detailPricingRows={detailPricingRows}
            displayPrice={displayPrice}
            t={t}
          />
        </div>
      </aside>
    </div>
  );
};

export default ModelDetailDrawer;
