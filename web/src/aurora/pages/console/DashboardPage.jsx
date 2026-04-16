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

import React, { useContext, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Clock3,
  Cpu,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { UserContext } from '../../../context/User';
import { StatusContext } from '../../../context/Status';

import {
  ApiEndpointsCard,
  FaqAccordion,
  SpendChart,
  StatCard,
} from './components';
import { useDashboardData } from '../../../hooks/dashboard/useDashboardData';
import { useDashboardStats } from '../../../hooks/dashboard/useDashboardStats';
import { useDashboardCharts } from '../../../hooks/dashboard/useDashboardCharts';

const QUICK_ACTIONS = [
  {
    title: 'API Keys',
    href: '/console/token',
    description: '创建/管理 API Key',
  },
  {
    title: 'Usage Logs',
    href: '/console/log',
    description: '查看请求和计费明细',
  },
  {
    title: 'Key Cost',
    href: '/console/key-cost',
    description: '模型花费分析',
  },
];

const DASHBOARD_CARD_CONFIG = [
  {
    match: '当前余额',
    accent: '+12%',
    icon: Wallet,
    description: 'ACCOUNT BALANCE',
  },
  {
    match: '请求次数',
    accent: '+9%',
    icon: Activity,
    description: 'REQUESTS',
  },
  {
    match: '历史消耗',
    accent: 'On track',
    icon: BarChart3,
    description: 'USAGE',
  },
  {
    match: '平均RPM',
    accent: 'Peak',
    icon: Cpu,
    description: 'RATE',
  },
];

const getCardConfig = (title = '') =>
  DASHBOARD_CARD_CONFIG.find((item) => title.includes(item.match));

const pickDashboardCards = (groupedStatsData = []) =>
  groupedStatsData
    .flatMap((group) => group?.items || [])
    .map((item) => {
      const config = getCardConfig(item.title);
      if (!config) {
        return null;
      }
      return {
        ...item,
        ...config,
      };
    })
    .filter(Boolean)
    .slice(0, 4);

const buildAnnouncementItems = (items = [], t = (value) => value) => {
  if (Array.isArray(items) && items.length > 0) {
    return items.slice(0, 3);
  }
  return [
    {
      title: t('暂无新通知'),
      description: t('更新、维护或系统公告会显示在这里。'),
    },
  ];
};

const AnnouncementCard = ({ items = [], t = (value) => value }) => (
  <section className='rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'>
    <div className='mb-4 flex items-center justify-between'>
      <div>
        <p className='text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-500'>
          {t('Announcements')}
        </p>
        <h2 className='mt-1 text-lg font-semibold text-slate-900'>
          {t('平台通知')}
        </h2>
      </div>
      <Clock3 className='h-4 w-4 text-slate-400' />
    </div>
    <div className='space-y-3'>
      {items.map((item, index) => (
        <article
          key={`${item?.title || item?.content || 'announcement'}-${index}`}
          className='rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3'
        >
          <h3 className='text-sm font-medium text-slate-900'>
            {item?.title || t('系统通知')}
          </h3>
          <p className='mt-1 text-sm text-slate-500'>
            {item?.content || item?.description || t('暂无新通知')}
          </p>
        </article>
      ))}
    </div>
  </section>
);

export default function DashboardPage() {
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const navigate = useNavigate();

  const dashboardData = useDashboardData(userState, userDispatch, statusState);

  // Chart hook aggregates quotaData → consumeQuota, consumeTokens, times
  const dashboardCharts = useDashboardCharts(
    dashboardData.dataExportDefaultTime,
    dashboardData.setTrendData,
    dashboardData.setConsumeQuota,
    dashboardData.setTimes,
    dashboardData.setConsumeTokens,
    dashboardData.setPieData,
    dashboardData.setLineData,
    dashboardData.setModelColors,
    dashboardData.t,
  );

  const { groupedStatsData } = useDashboardStats(
    userState,
    dashboardData.consumeQuota,
    dashboardData.consumeTokens,
    dashboardData.times,
    dashboardData.trendData,
    dashboardData.performanceMetrics,
    dashboardData.navigate,
    dashboardData.t,
  );

  // Load data once on mount — mirrors Legacy Dashboard init flow
  const dataLoaded = React.useRef(false);
  useEffect(() => {
    if (dataLoaded.current) return;
    dataLoaded.current = true;

    (async () => {
      const data = await dashboardData.refresh();
      if (data && data.length > 0) {
        dashboardCharts.updateChartData(data);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const faqItems = Array.isArray(statusState?.status?.faq) ? statusState.status.faq : [];
  const apiInfo = Array.isArray(statusState?.status?.api_info) ? statusState.status.api_info : [];
  const announcementItems = buildAnnouncementItems(
    statusState?.status?.announcements,
    dashboardData.t,
  );
  const quickStatCards = useMemo(
    () => pickDashboardCards(groupedStatsData),
    [groupedStatsData],
  );
  const lastUpdatedLabel = useMemo(() => {
    const lastPoint = [...(dashboardData.quotaData || [])]
      .sort((a, b) => Number(b?.created_at || 0) - Number(a?.created_at || 0))
      .find((item) => Number(item?.created_at || 0) > 0);

    if (!lastPoint?.created_at) {
      return dashboardData.t('暂无数据');
    }

    return new Date(Number(lastPoint.created_at) * 1000).toLocaleString();
  }, [dashboardData.quotaData, dashboardData.t]);

  const handleQuickActionNavigate = (event, href) => {
    const isModifiedClick =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    const isNonPrimaryButton = event.button !== 0;

    if (isModifiedClick || isNonPrimaryButton) {
      return;
    }

    event.preventDefault();
    navigate(href);
  };

  return (
    <div className='mx-auto w-full max-w-[1280px] space-y-6 px-1 pb-6'>
      <section className='rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <p className='text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-500'>
              {dashboardData.t('Dashboard')}
            </p>
            <h1 className='mt-1 text-3xl font-semibold text-slate-900'>
              {dashboardData.t('控制台总览')}
            </h1>
            <p className='mt-2 text-sm text-slate-500'>{dashboardData.getGreeting}</p>
          </div>
          <div className='flex items-center gap-3'>
            <div className='rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400'>
                {dashboardData.t('Last Updated')}
              </p>
              <p className='mt-1 text-sm text-slate-600'>{lastUpdatedLabel}</p>
            </div>
            <button
              type='button'
              className='inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100'
              onClick={async () => {
                const data = await dashboardData.refresh();
                if (data && data.length > 0) {
                  dashboardCharts.updateChartData(data);
                }
              }}
              disabled={dashboardData.loading}
            >
              <RefreshCw className='h-4 w-4' />
              {dashboardData.t('刷新数据')}
            </button>
          </div>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {quickStatCards.map((card) => {
          const Icon = card.icon || Activity;
          return (
            <StatCard
              key={card.title}
              title={card.description || card.title || ''}
              value={card.value || 0}
              description={card.title || ''}
              trend={null}
              icon={
                <div className='flex items-center gap-2'>
                  <span className='rounded-full bg-indigo-50 p-2 text-indigo-500'>
                    <Icon className='h-4 w-4' />
                  </span>
                  <span className='text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-500'>
                    {card.accent}
                  </span>
                </div>
              }
            />
          );
        })}
      </section>

      <section className='grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]'>
        <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'>
          <div className='mb-4 flex items-start justify-between gap-3'>
            <div>
              <p className='text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-500'>
                {dashboardData.t('Spend Overview')}
              </p>
              <h2 className='mt-1 text-lg font-semibold text-slate-900'>
                {dashboardData.t('模型数据分析')}
              </h2>
            </div>
            <span className='rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500'>
              {dashboardData.t('Based on recent usage')}
            </span>
          </div>
          <SpendChart
            title={dashboardData.t('Spend Overview')}
            data={dashboardData.quotaData || []}
            pieData={dashboardData.pieData}
            modelColors={dashboardData.modelColors}
            loading={dashboardData.loading}
          />
        </div>

        <div className='space-y-5'>
          <ApiEndpointsCard endpoints={apiInfo} t={dashboardData.t} />
          <AnnouncementCard items={announcementItems} t={dashboardData.t} />
        </div>
      </section>

      <section className='grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]'>
        <FaqAccordion items={faqItems} t={dashboardData.t} />
        <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'>
          <div className='mb-4'>
            <p className='text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-500'>
              {dashboardData.t('Quick Access')}
            </p>
            <h2 className='mt-1 text-lg font-semibold text-slate-900'>
              {dashboardData.t('快捷入口')}
            </h2>
          </div>
          <div className='space-y-3'>
            {QUICK_ACTIONS.map((action) => (
              <a
                key={action.title}
                href={action.href}
                onClick={(event) => handleQuickActionNavigate(event, action.href)}
                className='flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50'
              >
                <div>
                  <h3 className='text-sm font-medium text-slate-900'>
                    {action.title}
                  </h3>
                  <p className='mt-1 text-sm text-slate-500'>
                    {action.description}
                  </p>
                </div>
                <ArrowUpRight className='h-4 w-4 text-slate-400' />
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
