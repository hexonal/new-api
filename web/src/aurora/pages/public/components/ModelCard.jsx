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
import { BadgeCheck, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const priceFormatter = (price = 0) => {
  if (!Number.isFinite(Number(price))) return '--';
  return `$${Number(price).toFixed(3)}`;
};

const ModelCard = ({ item = {} }) => {
  const { t } = useTranslation();
  const {
    model_name: name,
    vendor_name: provider,
    quota_type,
    input,
    output,
    endpoint_types = [],
    tags = '',
  } = item;

  const label = quota_type === 0 ? 'input/output' : 'image/video';

  return (
    <article className='aurora-model-card'>
      <div className='aurora-model-card-head'>
        <h3 className='aurora-model-card-title'>{name || t('未知模型')}</h3>
        <BadgeCheck size={16} className='aurora-model-card-verify' />
      </div>

      <div className='aurora-model-card-meta'>
        <span>{provider || t('Unknown')}</span>
        <span className='aurora-model-card-pill'>{label}</span>
      </div>

      <div className='aurora-model-card-pricing'>
        <div>
          <p>{t('Input')}</p>
          <strong>{priceFormatter(input)}</strong>
        </div>
        <div>
          <p>{t('Output')}</p>
          <strong>{priceFormatter(output)}</strong>
        </div>
      </div>

      {!!endpoint_types.length && (
        <div className='aurora-model-card-endpoints'>
          {endpoint_types.slice(0, 4).map((endpoint) => (
            <span key={endpoint} className='aurora-model-card-endpoint'>
              {endpoint}
            </span>
          ))}
        </div>
      )}

      {tags && (
        <div className='aurora-model-card-tags'>
          <Tag size={12} />
          <span>{tags}</span>
        </div>
      )}
    </article>
  );
};

export default ModelCard;

