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
import { Copy, User } from 'lucide-react';
import { CONTEXT_BADGE_COLOR } from './constants';

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
        CONTEXT_BADGE_COLOR[model.primaryModality] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {model.badgeText}
    </span>
  </div>
);

const ListRowMeta = ({ model, pricingItems, t }) => (
  <div className='flex flex-wrap items-center gap-4 text-xs font-medium text-gray-400'>
    <span className='flex items-center gap-1'>
      <User className='h-3.5 w-3.5' />
      {t('来自 ')}
      {model.provider || t('未知供应商')}
    </span>
    <span>|</span>
    <span>{model.dateText}</span>
    {pricingItems.map((item) => (
      <React.Fragment key={`${model.model_name}-${item.key}`}>
        <span>|</span>
        <span className='text-gray-700'>
          {item.value} {item.label}
        </span>
      </React.Fragment>
    ))}
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
  <div className='group mb-4 rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-indigo-300 hover:shadow-md'>
    <div className='flex items-start justify-between gap-4'>
      <div className='min-w-0 flex-1'>
        <ListRowHeader copyText={copyText} model={model} />
        <p className='mb-3 max-w-3xl text-sm leading-relaxed text-gray-600'>
          {model.description || t('暂无模型描述')}
        </p>
        <ListRowMeta model={model} pricingItems={pricingItems} t={t} />
      </div>
      <ChooseModelButton onChoose={onChoose} t={t} />
    </div>
  </div>
);

const ModelsExplorerList = ({ copyText, models, onChooseModel, priceMetaMap, t }) => (
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
