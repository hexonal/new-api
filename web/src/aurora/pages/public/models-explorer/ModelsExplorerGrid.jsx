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
import { Copy } from 'lucide-react';

const ModelGridCard = ({ copyText, model, onChoose, pricingItems, t }) => (
  <div className='rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-md'>
    <div className='mb-2 flex items-center justify-between gap-3'>
      <h3 className='truncate text-base font-bold text-gray-900'>{model.model_name}</h3>
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
      <div>
        {t('供应商')}: {model.provider || t('未知供应商')}
      </div>
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

const ModelsExplorerGrid = ({ copyText, models, onChooseModel, priceMetaMap, t }) => (
  <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
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
