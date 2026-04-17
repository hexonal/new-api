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
import { Building2, Copy } from 'lucide-react';
import { getChannelIcon, getLobeHubIcon } from '../../../../helpers';
import { CONTEXT_BADGE_COLOR } from './constants';

const getProviderIconNode = (model) =>
  getLobeHubIcon(
    model?.vendor_icon || model?.icon || model?.provider || '',
    15,
  );

const ListRowHeader = ({ copyText, model }) => (
  <div className='mb-2 flex items-center gap-3'>
    <h3
      className='text-lg font-bold text-gray-900 transition-colors group-hover:text-indigo-600'
      style={{ fontFamily: 'Public Sans, sans-serif' }}
    >
      {model.model_name}
    </h3>
    <button
      type='button'
      className='text-gray-400 transition-colors hover:text-indigo-600'
      onClick={() => copyText(model.model_name)}
    >
      <Copy className='h-4 w-4' />
    </button>
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        CONTEXT_BADGE_COLOR[model.primaryModality] ||
        'bg-gray-100 text-gray-700'
      }`}
    >
      {model.badgeText}
    </span>
  </div>
);

const getChannelIconNode = (channel) => {
  const typeValue = Number(channel?.channel_type ?? channel?.type);
  if (Number.isFinite(typeValue)) {
    const icon = getChannelIcon(typeValue);
    if (icon) {
      return icon;
    }
  }
  if (channel?.icon) {
    return getLobeHubIcon(channel.icon, 14);
  }
  return <Building2 className='h-3.5 w-3.5 text-gray-400' />;
};

const ListRowMeta = ({ model, pricingItems, t }) => (
  <div className='min-w-0 space-y-2 text-xs font-medium text-gray-400'>
    <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
      <span className='inline-flex items-center gap-1'>
        <span>{t('来自 ')}</span>
        <span className='inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'>
          <span className='inline-flex h-5 w-5 items-center justify-center rounded-full border border-indigo-200 bg-white'>
            {getProviderIconNode(model)}
          </span>
          {model.provider || t('未知供应商')}
        </span>
      </span>
      <span className='rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600'>
        {t('系列')}: {model.series || '-'}
      </span>
      <span className='rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700'>
        {t('输入类型')}: {model.badgeText}
      </span>
      <span className='rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[11px] text-teal-700'>
        {t('计费方式')}: {model.billingLabel || '-'}
      </span>
      {Array.isArray(model?.bound_channels) &&
      model.bound_channels.length > 0 ? (
        <span className='flex items-center gap-1 text-gray-600'>
          {getChannelIconNode(model.bound_channels[0])}
          {model.bound_channels[0]?.name || t('渠道')}
        </span>
      ) : null}
      <span>
        {t('发布时间')}: {model.dateText}
      </span>
    </div>

    {pricingItems.length > 0 ? (
      <div className='flex flex-wrap gap-2'>
        {pricingItems.map((item) => (
          <span
            key={`${model.model_name}-${item.key}`}
            className='max-w-full break-all rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700'
          >
            {item.value} {item.label}
          </span>
        ))}
      </div>
    ) : null}
  </div>
);

const ChooseModelButton = ({ onChoose, t }) => (
  <button
    type='button'
    className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700'
    onClick={onChoose}
  >
    {t('选择模型')}
  </button>
);

const ModelListRow = ({ copyText, model, onChoose, pricingItems, t }) => (
  <div className='group mb-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-md sm:p-6'>
    <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
      <div className='min-w-0 flex-1'>
        <ListRowHeader copyText={copyText} model={model} />
        <p className='mb-3 max-w-3xl text-sm leading-relaxed text-gray-600'>
          {model.description || t('暂无模型描述')}
        </p>
        <ListRowMeta model={model} pricingItems={pricingItems} t={t} />
      </div>
      <div className='sm:pl-4'>
        <ChooseModelButton onChoose={onChoose} t={t} />
      </div>
    </div>
  </div>
);

const ModelsExplorerList = ({
  copyText,
  models,
  onChooseModel,
  priceMetaMap,
  t,
}) => (
  <div className='space-y-1'>
    {models.map((model) => {
      const pricingItems = priceMetaMap.get(model.model_name) || [];
      return (
        <ModelListRow
          key={model.model_name}
          copyText={copyText}
          model={model}
          onChoose={() => onChooseModel(model)}
          pricingItems={pricingItems}
          t={t}
        />
      );
    })}
  </div>
);

export default ModelsExplorerList;
