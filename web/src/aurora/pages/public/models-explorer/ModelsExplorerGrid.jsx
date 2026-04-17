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

const getProviderIconNode = (model) =>
  getLobeHubIcon(
    model?.vendor_icon || model?.icon || model?.provider || '',
    15,
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

const ModelGridCard = ({ copyText, model, onChoose, pricingItems, t }) => (
  <div className='rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-md'>
    <div className='mb-2 flex items-center justify-between gap-3'>
      <h3 className='truncate text-base font-bold text-gray-900'>
        {model.model_name}
      </h3>
      <button
        type='button'
        className='text-gray-400 transition-colors hover:text-indigo-600'
        onClick={() => copyText(model.model_name)}
      >
        <Copy className='h-4 w-4' />
      </button>
    </div>
    <p className='mb-3 line-clamp-3 text-sm text-gray-600'>
      {model.description || t('暂无模型描述')}
    </p>
    <div className='space-y-1 text-xs text-gray-500'>
      <div className='inline-flex items-center gap-1'>
        <span>{t('供应商')}:</span>
        <span className='inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'>
          <span className='inline-flex h-5 w-5 items-center justify-center rounded-full border border-indigo-200 bg-white'>
            {getProviderIconNode(model)}
          </span>
          {model.provider || t('未知供应商')}
        </span>
      </div>
      <div>
        {t('系列')}: {model.series || '-'}
      </div>
      <div>
        {t('输入类型')}: {model.badgeText}
      </div>
      <div>
        {t('计费方式')}: {model.billingLabel || '-'}
      </div>
      {Array.isArray(model?.bound_channels) &&
      model.bound_channels.length > 0 ? (
        <div className='flex items-center gap-1'>
          {getChannelIconNode(model.bound_channels[0])}
          {t('渠道')}: {model.bound_channels[0]?.name || '-'}
        </div>
      ) : null}
      <div>
        {t('发布时间')}: {model.dateText}
      </div>
      {pricingItems.map((item) => (
        <div key={`${model.model_name}-grid-${item.key}`}>
          {item.value} {item.label}
        </div>
      ))}
    </div>
    <button
      type='button'
      className='mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700'
      onClick={onChoose}
    >
      {t('选择模型')}
    </button>
  </div>
);

const ModelsExplorerGrid = ({
  copyText,
  models,
  onChooseModel,
  priceMetaMap,
  t,
}) => (
  <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
    {models.map((model) => {
      const pricingItems = priceMetaMap.get(model.model_name) || [];
      return (
        <ModelGridCard
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

export default ModelsExplorerGrid;
