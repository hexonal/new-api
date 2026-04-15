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
// import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../../context/Status';
import { copy } from '../../../helpers';
// import ProviderLogos from './components/ProviderLogos';
import Footer from './components/Footer';
import { Dropdown } from '@douyinfe/semi-ui';
import { IconChevronDown, IconBolt } from '@douyinfe/semi-icons';
import { IconCopy } from '@douyinfe/semi-icons';
import { FaCheckCircle } from 'react-icons/fa';
import { cn } from '../../lib/cn';

const stats = [
  { labelKey: 'home.stats.monthlyTokens', value: '70T' },
  { labelKey: 'home.stats.globalUsers', value: '5M+' },
  { labelKey: 'home.stats.activeProviders', value: '60+' },
  { labelKey: 'home.stats.models', value: '300+' },
];

const providers = [
  { name: 'OpenAI' },
  { name: 'Claude' },
  { name: 'Gemini' },
  { name: 'Qwen' },
  { name: 'DeepSeek' },
  { name: 'Zhipu' },
  { name: 'Suno' },
  { name: 'Hunyuan' },
  { name: 'Cohere' },
  { name: 'Midjourney' },
  { nameKey: 'home.providers.moreThanThirty', highlight: true },
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
    <div className='overflow-x-auto'>
      {/* Title */}
      <div className='max-w-[720px] mt-20 mx-auto text-7xl font-black text-center tracking-[-1.8px]'>
        {t('home.hero.title')}
      </div>
      {/* Desc */}
      <div className='max-w-[672px] mt-[22px] mx-auto text-[rgba(75,89,99,1)] text-xl font-normal text-center leading-[32.5px]'>
        {t('home.hero.description')}
      </div>
      {/* Button */}
      <div className='flex items-center justify-center gap-4 w-full mt-10'>
        {/* Get API Key */}
        <div className='w-[166px] h-16 bg-[rgba(74,75,215,1)] rounded-lg text-lg text-white font-bold flex items-center justify-center cursor-pointer shadow-[0px_4px_6px_-4px_rgba(199,210,254,1),0px_10px_15px_-3px_rgba(199,210,254,1)]'>
          {t('home.actions.getApiKey')}
        </div>
        {/* Explore Models */}
        <div className='w-[202px] h-16 border-[2px] border-[rgba(229,231,235,1)] rounded-lg text-lg text-[rgba(17,24,39,1)] font-bold flex items-center justify-center cursor-pointer'>
          {t('home.actions.exploreModels')}
        </div>
      </div>
      {/* API BASE CONFIGURATION */}
      <div className='flex flex-col justify-between w-[768px] h-[144px] mt-20 mx-auto p-[24px] bg-white rounded-2xl border-[0.67px] border-[rgba(229,231,235,1)] shadow-2xl'>
        {/* Button + Title */}
        <div className='flex items-center gap-6'>
          {/* Button */}
          <div className='flex items-center gap-2'>
            <div className='w-3 h-3 rounded-full bg-[rgba(248,113,113,1)]'></div>
            <div className='w-3 h-3 rounded-full bg-[rgba(250,204,21,1)]'></div>
            <div className='w-3 h-3 rounded-full bg-[rgba(74,222,128,1)]'></div>
          </div>
          {/* Title */}
          <div className='text-xs text-[rgba(156,163,175,1)] leading-4'>
            {t('home.apiConfig.title')}
          </div>
        </div>
        {/* Container */}
        <div className='w-full h-[62px] flex items-center justify-between px-[10px] rounded-lg bg-[rgba(243,244,246,1)] border-[0.67px] border-[rgba(243,244,246,1)]'>
          {/* BASE_URL */}
          <div className='w-[414px] h-[45px] flex items-center gap-2 px-4 py-3 rounded-sm bg-white border-[0.67px] border-[rgba(229,231,235,1)]'>
            <div className='text-sm text-[rgba(156,163,175,1)]'>BASE_URL:</div>
            <div className='text-sm'>{endpoint}</div>
          </div>
          {/* DropdownMenu */}
          <Dropdown
            position='bottomLeft'
            render={
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => console.log('编辑')}>{t('home.dropdown.edit')}</Dropdown.Item>
                <Dropdown.Item onClick={() => console.log('删除')}>{t('home.dropdown.delete')}</Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            {/* Trigger */}
            <div className='w-[219px] h-[45px] px-4 flex items-center justify-between gap-3 rounded-sm bg-white border-[0.67px] border-[rgba(229,231,235,1)]'>
              <div className='text-sm tracking-[0.8px]'>
                {t('home.apiConfig.endpointPath')}
              </div>
              <IconChevronDown size='12px' />
            </div>
          </Dropdown>
          {/* Copy */}
          <div
            className='w-[52px] h-[45px] flex items-center justify-center bg-[rgba(17,24,39,1)] rounded-sm cursor-pointer'
            onClick={handleCopy}
          >
            <IconCopy size='large' className='text-white rotate-180' />
          </div>
        </div>
      </div>
      {/* hr */}
      <hr className='w-full h-[0.67px] mt-24 text-[rgba(243,244,246,1)]' />
      {/* Data */}
      <div className='w-[1024px] mt-16 flex items-center justify-between mx-auto'>
        {
          stats.map((item) => (
            <div
              className='w-[232px] text-center'
              key={item.value}
            >
              <div className='text-3xl text-[rgba(17,24,39,1)] font-black leading-[36px]'>
                {item.value}
              </div>
              <div className='text-sm text-[rgba(107,114,126,1)] font-medium leading-[20px]'>
                {t(item.labelKey)}
              </div>
            </div>
          ))
        }
      </div>
      {/* Supported Providers */}
      <div className='w-full h-[488px] mt-20 py-24 bg-[rgba(249,250,251,1)]'>
        {/* Title */}
        <div className='text-sm text-[rgba(79,70,229,1)] font-bold tracking-[1.4px] text-center leading-[20px]'>
          {t('home.providers.title')}
        </div>
        {/* Desc */}
        <div className='mt-2 text-3xl text-[rgba(17,24,39,1)] font-bold text-center leading-[36px]'>
          {t('home.providers.description')}
        </div>
        {/* Support */}
        <div className='w-[1024px] h-[160px] mt-10 mx-auto flex flex-col justify-between'>
          <div className='flex items-center justify-between'>
            {
              providers.slice(0, 5).map((item) => (
                <div
                  className='w-[179px] h-16 flex items-center justify-center text-base text-[rgba(156,163,175,1)] font-bold bg-white rounded-lg border-[0.67px] border-[rgba(243,244,246,1)]'
                  key={item.name}
                >
                  {item.name}
                </div>
              ))
            }
          </div>
          <div className='flex items-center justify-between'>
            {
              providers.slice(5, 11).map((item) => (
                <div
                  className={cn('w-[144px] h-16 flex items-center justify-center text-base text-[rgba(156,163,175,1)] font-bold bg-white rounded-lg border-[0.67px] border-[rgba(243,244,246,1)]', item.highlight ? 'text-[rgba(79,70,229,1)] bg-[rgba(238,242,255,1)] border-[rgba(224,231,255,1)]' : '')}
                  key={item.name || item.nameKey}
                >
                  {item.nameKey ? t(item.nameKey) : item.name}
                </div>
              ))
            }
          </div>
        </div>
      </div>
      {/* Card */}
      <div className='w-full pt-32'>
        <div className='w-[1232px] h-[326px] mx-auto flex items-center justify-between'>
          {/* Advanced Routing Logic */}
          <div className='w-[813px] h-full p-6 bg-white rounded-3xl border-[0.67px] border-[rgba(229,231,235,1)]'>
            {/* Title */}
            <div className='text-2xl font-bold'>
              {t('home.cards.advancedRouting.title')}
            </div>
            {/* Desc */}
            <div className='max-w-[448px] mt-4 text-[rgba(75,85,99,1)]'>
              {t('home.cards.advancedRouting.description')}
            </div>
            {/* Points */}
            <div className='mt-8 space-y-4 text-[rgba(75,85,99,1)]'>
              <div className='flex items-center gap-2'>
                <FaCheckCircle className='text-[#22c55e]' size={16} />
                {t('home.cards.advancedRouting.pointUptime')}
              </div>
              <div className='flex items-center gap-2'>
                <FaCheckCircle className='text-[#22c55e]' size={16} />
                {t('home.cards.advancedRouting.pointLatency')}
              </div>
            </div>
          </div>
          {/* Instant Setup */}
          <div className='w-[394px] h-full p-8 bg-[rgba(79,70,229,1)] rounded-3xl'>
            {/* Icon */}
            <IconBolt style={{ color: '#fff', fontSize: 20 }} />
            {/* Title */}
            <div className='mt-4 text-2xl text-white font-bold'>
              {t('home.cards.instantSetup.title')}
            </div>
            {/* Desc */}
            <div className='mt-4 text-[rgba(224,231,255,1)] leading-[26px]'>
              {t('home.cards.instantSetup.description')}
            </div>
            {/* Button */}
            <div className='w-full h-12 mt-10 flex items-center justify-center text-[rgba(79,70,229,1)] font-bold bg-white rounded-lg cursor-pointer'>
              {t('home.cards.instantSetup.button')}
            </div>
          </div>
        </div>
      </div>
      {/* Footer */}
      <Footer />
      {/* <section className='aurora-landing-hero'>
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
      </section> */}
    </div>
  );
};

export default LandingPage;
