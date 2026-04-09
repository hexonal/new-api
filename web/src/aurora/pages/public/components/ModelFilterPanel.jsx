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
import { useTranslation } from 'react-i18next';

const filterGroups = [
  {
    title: 'Modalities',
    items: ['text', 'image', 'audio', 'video'],
  },
  {
    title: 'Context Window',
    items: ['4K', '8K', '16K', '32K+'],
  },
  {
    title: 'Pricing',
    items: ['USD', 'CNY', 'Credits'],
  },
  {
    title: 'Series',
    items: ['gpt', 'claude', 'gemini', 'qwen', 'midjourney'],
  },
  {
    title: 'Providers',
    items: ['OpenAI', 'Anthropic', 'Google', 'Meta', 'Zhipu'],
  },
];

const ModelFilterPanel = () => {
  const { t } = useTranslation();
  return (
    <aside className='aurora-model-filter-panel'>
      <div className='aurora-model-filter-panel-title'>{t('Filters')}</div>
      {filterGroups.map((group) => (
        <section className='aurora-model-filter-group' key={group.title}>
          <h4 className='aurora-model-filter-group-title'>{group.title}</h4>
          <div className='aurora-model-filter-pills'>
            {group.items.map((item) => (
              <button
                type='button'
                className='aurora-model-filter-pill'
                key={`${group.title}-${item}`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
};

export default ModelFilterPanel;
