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

import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../../context/Status';
import { copy } from '../../../helpers';
import ProviderLogos from './components/ProviderLogos';

const stats = [
  { label: 'Models', value: '180+' },
  { label: 'Vendors', value: '12+' },
  { label: 'SLA', value: '99.9%' },
];

const LandingPage = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [copied, setCopied] = useState(false);

  const endpoint = statusState?.status?.server_address || window.location.origin;
  const docsLink = statusState?.status?.docs_link || '';

  const handleCopy = async () => {
    const ok = await copy(endpoint);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <div className='aurora-landing-page'>
      <section className='aurora-landing-hero'>
        <p className='aurora-landing-kicker'>{t('The Unified Interface For LLMs')}</p>
        <h1>{t('The Unified Interface For LLMs')}</h1>
        <p className='aurora-landing-subtitle'>
          {t(
            '统一入口接入多模态模型，统一鉴权计费，支持 OpenAI 兼容协议，快速接入',
          )}
        </p>
        <div className='aurora-landing-endpoint'>
          <input
            type='text'
            className='aurora-landing-endpoint-input'
            value={endpoint}
            readOnly
            aria-label={t('Base URL')}
          />
          <button
            type='button'
            className='aurora-landing-endpoint-copy'
            onClick={handleCopy}
          >
            {copied ? t('已复制') : t('复制')}
          </button>
        </div>
        <div className='aurora-landing-cta'>
          <Link to='/pricing' className='aurora-btn aurora-btn-primary'>
            {t('查看模型价格')}
          </Link>
          <button
            type='button'
            className='aurora-btn aurora-btn-outline'
            onClick={() => window.open(docsLink || endpoint, '_blank')}
          >
            {t('文档')}
          </button>
        </div>
      </section>

      <section className='aurora-landing-stats'>
        {stats.map((item) => (
          <article className='aurora-stat-card' key={item.label}>
            <div>{item.value}</div>
            <p>{item.label}</p>
          </article>
        ))}
      </section>

      <section className='aurora-landing-providers'>
        <h2>{t('支持的供应商')}</h2>
        <ProviderLogos />
      </section>
    </div>
  );
};

export default LandingPage;
