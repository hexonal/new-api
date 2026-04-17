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
import { getLobeHubIcon } from '../../../../helpers';
import { splitTags } from './helpers';

const sectionClassName =
  'rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:p-5';
const sectionTitleClassName =
  'mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500';

const getProviderIconNode = (detailModel) =>
  getLobeHubIcon(
    detailModel?.vendor_icon ||
      detailModel?.icon ||
      detailModel?.provider ||
      '',
    18,
  );

const DrawerHeader = ({ detailModel, onClose, t }) => (
  <div className='sticky top-0 z-20 border-b border-slate-200 bg-white/96 px-4 py-4 backdrop-blur sm:px-6'>
    <div className='flex items-start justify-between gap-3'>
      <div className='min-w-0'>
        <p className='mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500'>
          {t('模型详情')}
        </p>
        <h2
          className='break-all pr-2 text-xl font-extrabold leading-tight text-slate-900 sm:text-[27px]'
          style={{ fontFamily: 'Public Sans, sans-serif' }}
        >
          {detailModel.model_name}
        </h2>
        <p className='mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-500'>
          {getProviderIconNode(detailModel)}
          <span>{detailModel.provider}</span>
        </p>
      </div>
      <button
        type='button'
        className='inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700'
        onClick={onClose}
      >
        <X className='h-[18px] w-[18px]' />
      </button>
    </div>
  </div>
);

const DescriptionSection = ({ detailModel, t }) => (
  <section className={sectionClassName}>
    <h3 className={sectionTitleClassName}>{t('描述')}</h3>
    <p className='text-[14px] leading-relaxed text-slate-700 sm:text-base'>
      {detailModel.description || t('暂无模型描述')}
    </p>
    <div className='mt-3 flex flex-wrap gap-2'>
      {splitTags(detailModel.tags).map((tag) => (
        <span
          key={`${detailModel.model_name}-${tag}`}
          className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600'
        >
          {tag}
        </span>
      ))}
    </div>
  </section>
);

const EndpointsSection = ({ detailEndpoints, detailModel, t }) => (
  <section className={sectionClassName}>
    <h3 className={sectionTitleClassName}>{t('模型支持的接口端点信息')}</h3>
    {detailEndpoints.length === 0 ? (
      <p className='text-sm text-slate-500'>{t('暂无端点信息')}</p>
    ) : (
      <div className='space-y-2.5'>
        {detailEndpoints.map((endpoint) => (
          <div
            key={`${detailModel.model_name}-${endpoint.type}`}
            className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5'
          >
            <div className='text-sm font-semibold text-slate-700'>
              {endpoint.type}
            </div>
            <div className='mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500'>
              <span className='break-all font-mono text-xs text-slate-600'>
                {endpoint.path || '-'}
              </span>
              <span className='rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 font-semibold tracking-wide text-blue-700'>
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
    <div className='mb-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500'>
      <span>{t('自动选择')}</span>
      <span>→</span>
      {detailAutoChain.map((group, index) => (
        <React.Fragment key={`${detailModel.model_name}-${group}`}>
          <span className='rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-slate-700'>
            {group}
          </span>
          {index < detailAutoChain.length - 1 && <span>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

const PricingItemRows = ({ detailModel, row }) => (
  <div className='space-y-1.5'>
    {row.items.map((item) => (
      <div
        key={`${detailModel.model_name}-${row.group}-${item.key}`}
        className='flex items-baseline justify-between gap-3 border-b border-slate-100 pb-1 last:border-b-0 last:pb-0'
      >
        <span className='text-[13px] font-semibold text-slate-700 sm:text-sm'>
          {item.label}
        </span>
        <span className='text-right font-mono text-[13px] tabular-nums text-slate-600 sm:text-sm'>
          {item.value}
          {item.suffix}
        </span>
      </div>
    ))}
  </div>
);

const HailuoSkuRows = ({ detailModel, displayPrice, row, t }) => {
  if (!Array.isArray(row.hailuoSkuRows) || row.hailuoSkuRows.length === 0) {
    return null;
  }

  return (
    <div className='mt-2.5 space-y-2'>
      {row.hailuoSkuRows.map((skuRow) => (
        <div
          key={`${detailModel.model_name}-${row.group}-${skuRow.sku}`}
          className='rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-600'
        >
          <div className='font-semibold text-slate-700'>{skuRow.sku}</div>
          <div className='mt-1'>{`${skuRow.duration}s · ${skuRow.resolution} · ${skuRow.official_points}`}</div>
          <div className='font-mono tabular-nums'>{`${displayPrice(skuRow.unitPrice)} / ${t('次')}`}</div>
          <div className='font-mono tabular-nums'>{`${displayPrice(skuRow.finalPrice)} / ${t('次')}`}</div>
        </div>
      ))}
    </div>
  );
};

const PricingGroupRow = ({ detailModel, displayPrice, row, t }) => (
  <div
    key={`${detailModel.model_name}-${row.group}`}
    className='rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-3.5'
  >
    <div className='mb-2.5 flex items-center justify-between gap-2'>
      <div className='text-sm font-semibold text-slate-700'>{row.group}</div>
      <div className='flex items-center gap-1.5'>
        <span className='rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600'>
          {row.ratio}x
        </span>
        <span className='rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600'>
          {row.billingType === 'per_call' ? t('按次计费') : t('按量计费')}
        </span>
      </div>
    </div>

    <PricingItemRows detailModel={detailModel} row={row} />
    <HailuoSkuRows
      detailModel={detailModel}
      displayPrice={displayPrice}
      row={row}
      t={t}
    />
  </div>
);

const PricingSection = ({
  detailAutoChain,
  detailModel,
  detailPricingRows,
  displayPrice,
  t,
}) => (
  <section className={sectionClassName}>
    <h3 className={sectionTitleClassName}>{t('当前计费')}</h3>
    <AutoChainBlock
      detailAutoChain={detailAutoChain}
      detailModel={detailModel}
      t={t}
    />
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
    <div className='fixed inset-0 z-50 flex items-end bg-slate-900/40 backdrop-blur-[1px] sm:items-stretch sm:justify-end'>
      <button
        type='button'
        aria-label={t('关闭')}
        className='absolute inset-0'
        onClick={onClose}
      />
      <aside
        className='relative z-10 h-[94vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-slate-50 shadow-[0_-18px_44px_rgba(15,23,42,0.24)] sm:h-full sm:rounded-none sm:rounded-l-2xl sm:border-y-0 sm:border-r-0 sm:shadow-[-18px_0_44px_rgba(15,23,42,0.24)]'
        style={{ width: 'min(100%, 780px)' }}
      >
        <DrawerHeader detailModel={detailModel} onClose={onClose} t={t} />

        <div className='space-y-4 p-4 pb-24 sm:space-y-5 sm:p-6 sm:pb-6'>
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

        <div className='sticky bottom-0 z-20 border-t border-slate-200 bg-white/96 p-3 backdrop-blur sm:hidden'>
          <button
            type='button'
            className='h-10 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white'
            onClick={onClose}
          >
            {t('关闭')}
          </button>
        </div>
      </aside>
    </div>
  );
};

export default ModelDetailDrawer;
