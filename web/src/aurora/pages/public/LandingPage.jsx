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

import React, { useContext, useMemo, useState } from 'react';
// import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../../context/Status';
import { UserContext } from '../../../context/User';
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
  const [userState] = useContext(UserContext);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const endpoint = statusState?.status?.server_address || window.location.origin;
  const docsLink = useMemo(() => {
    const docsLinkFromStatus =
      typeof statusState?.status?.docs_link === 'string'
        ? statusState.status.docs_link.trim()
        : '';
    if (docsLinkFromStatus) {
      return docsLinkFromStatus;
    }
    if (typeof localStorage === 'undefined') {
      return '';
    }
    return localStorage.getItem('docs_link') || '';
  }, [statusState?.status?.docs_link]);
  const hasLoginSession = useMemo(() => {
    if (userState?.user) {
      return true;
    }
    return Boolean(localStorage.getItem('user'));
  }, [userState?.user]);

  const handleCopy = async () => {
    const ok = await copy(endpoint);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  const resolveLink = (target) => {
    try {
      return new URL(target, window.location.origin);
    } catch {
      return null;
    }
  };

  const isExternalLink = (target) => {
    const resolved = resolveLink(target);
    if (!resolved) {
      return false;
    }
    return resolved.origin !== window.location.origin;
  };

  const handleDocsNavigate = () => {
    const target = docsLink || endpoint;
    const resolved = resolveLink(target);
    if (!resolved) {
      return;
    }
    if (isExternalLink(target)) {
      window.open(resolved.toString(), '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.assign(resolved.toString());
  };

  const handleGetApiKeyNavigate = () => {
    if (hasLoginSession) {
      navigate('/console/token');
      return;
    }
    navigate('/login');
  };

  const handleExploreModels = () => {
    navigate('/pricing');
  };

  return (
    <div className='w-full min-w-0 max-w-full overflow-x-hidden'>
      {/* Title */}
      <div className='mx-auto mt-12 max-w-[720px] px-4 text-center text-4xl font-black tracking-[-1.2px] sm:mt-16 sm:text-6xl lg:mt-20 lg:text-7xl'>
        {t('home.hero.title')}
      </div>
      {/* Desc */}
      <div className='mx-auto mt-5 max-w-[672px] px-4 text-center text-base font-normal leading-7 text-[rgba(75,89,99,1)] sm:text-xl sm:leading-[32.5px]'>
        {t('home.hero.description')}
      </div>
      {/* Button */}
      <div className='mt-8 flex w-full flex-col items-center justify-center gap-3 px-4 sm:mt-10 sm:flex-row sm:gap-4'>
        {/* Get API Key */}
        <div
          className='flex h-12 w-full max-w-[240px] cursor-pointer items-center justify-center rounded-lg bg-[rgba(74,75,215,1)] text-base font-bold text-white shadow-[0px_4px_6px_-4px_rgba(199,210,254,1),0px_10px_15px_-3px_rgba(199,210,254,1)] sm:h-16 sm:text-lg'
          onClick={handleGetApiKeyNavigate}
        >
          {t('home.actions.getApiKey')}
        </div>
        {/* Explore Models */}
        <div
          className='flex h-12 w-full max-w-[240px] cursor-pointer items-center justify-center rounded-lg border-[2px] border-[rgba(229,231,235,1)] text-base font-bold text-[rgba(17,24,39,1)] sm:h-16 sm:text-lg'
          onClick={handleExploreModels}
        >
          {t('home.actions.exploreModels')}
        </div>
      </div>
      {/* API BASE CONFIGURATION */}
      <div className='mx-auto mt-14 flex w-full max-w-[768px] flex-col justify-between rounded-2xl border-[0.67px] border-[rgba(229,231,235,1)] bg-white p-4 shadow-2xl sm:mt-20 sm:min-h-[144px] sm:p-6'>
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
        <div className='flex w-full flex-col gap-2 rounded-lg border-[0.67px] border-[rgba(243,244,246,1)] bg-[rgba(243,244,246,1)] px-[10px] py-2 sm:h-[62px] sm:flex-row sm:items-center sm:justify-between sm:gap-3'>
          {/* BASE_URL */}
          <div className='flex h-[45px] min-w-0 w-full items-center gap-2 rounded-sm border-[0.67px] border-[rgba(229,231,235,1)] bg-white px-4 py-3 sm:flex-1'>
            <div className='text-sm text-[rgba(156,163,175,1)]'>BASE_URL:</div>
            <div className='truncate text-sm'>{endpoint}</div>
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
            <div className='flex h-[45px] w-full items-center justify-between gap-3 rounded-sm border-[0.67px] border-[rgba(229,231,235,1)] bg-white px-4 sm:w-[219px]'>
              <div className='text-sm tracking-[0.8px]'>
                {t('home.apiConfig.endpointPath')}
              </div>
              <IconChevronDown size='12px' />
            </div>
          </Dropdown>
          {/* Copy */}
          <div
            className='flex h-[45px] w-full cursor-pointer items-center justify-center rounded-sm bg-[rgba(17,24,39,1)] sm:w-[52px]'
            onClick={handleCopy}
          >
            <IconCopy size='large' className='text-white rotate-180' />
          </div>
        </div>
      </div>
      {/* hr */}
      <hr className='mt-16 h-[0.67px] w-full text-[rgba(243,244,246,1)] sm:mt-24' />
      {/* Data */}
      <div className='mx-auto mt-12 grid w-full max-w-[1024px] grid-cols-2 gap-6 px-4 sm:mt-16 sm:grid-cols-4'>
        {
          stats.map((item) => (
            <div
              className='text-center'
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
      <div className='mt-16 w-full bg-[rgba(249,250,251,1)] py-14 sm:mt-20 sm:py-20'>
        {/* Title */}
        <div className='text-sm text-[rgba(79,70,229,1)] font-bold tracking-[1.4px] text-center leading-[20px]'>
          {t('home.providers.title')}
        </div>
        {/* Desc */}
        <div className='mt-2 text-3xl text-[rgba(17,24,39,1)] font-bold text-center leading-[36px]'>
          {t('home.providers.description')}
        </div>
        {/* Support */}
        <div className='mx-auto mt-10 w-full max-w-[1024px] space-y-4 px-4'>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-5'>
            {
              providers.slice(0, 5).map((item) => (
                <div
                  className='flex h-14 items-center justify-center rounded-lg border-[0.67px] border-[rgba(243,244,246,1)] bg-white text-sm font-bold text-[rgba(156,163,175,1)] sm:h-16 sm:text-base'
                  key={item.name}
                >
                  {item.name}
                </div>
              ))
            }
          </div>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-6'>
            {
              providers.slice(5, 11).map((item) => (
                <div
                  className={cn('flex h-14 items-center justify-center rounded-lg border-[0.67px] border-[rgba(243,244,246,1)] bg-white text-sm font-bold text-[rgba(156,163,175,1)] sm:h-16 sm:text-base', item.highlight ? 'border-[rgba(224,231,255,1)] bg-[rgba(238,242,255,1)] text-[rgba(79,70,229,1)]' : '')}
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
      <div className='w-full px-4 pb-10 pt-16 sm:pt-24'>
        <div className='mx-auto flex w-full max-w-[1232px] flex-col gap-4 lg:h-[326px] lg:flex-row lg:items-center lg:justify-between'>
          {/* Advanced Routing Logic */}
          <div className='h-full w-full rounded-3xl border-[0.67px] border-[rgba(229,231,235,1)] bg-white p-6 lg:w-[66%]'>
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
          <div className='h-full w-full rounded-3xl bg-[rgba(79,70,229,1)] p-8 lg:w-[32%]'>
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
            <div
              className='mt-8 flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-white font-bold text-[rgba(79,70,229,1)] sm:mt-10'
              onClick={handleDocsNavigate}
            >
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
            onClick={handleDocsNavigate}
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
