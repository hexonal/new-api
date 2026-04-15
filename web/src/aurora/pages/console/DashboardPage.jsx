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

import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, BarChart3, Activity, Cpu, Gauge, RefreshCw } from 'lucide-react';
import { UserContext } from '../../../context/User';
import { StatusContext } from '../../../context/Status';

import {
  StatCard,
  SpendChart,
  ServiceHealthCard,
  FaqAccordion,
  ApiEndpointsCard,
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

const iconMap = {
  balance: Wallet,
  usedQuota: BarChart3,
  requests: Activity,
  rate: Cpu,
  rpm: Gauge,
};

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
  const uptimeItems = Array.isArray(dashboardData.uptimeData)
    ? dashboardData.uptimeData
    : [];
  const quickStatCards = (groupedStatsData || []).flatMap((group) => group?.items || []);

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
    <div className='space-y-6'>
      <section className='rounded-xl border border-border p-4 md:p-5 bg-card/70'>
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-2'>
          <div>
            <p className='text-sm text-muted-foreground'>{dashboardData.t('欢迎回来')}</p>
            <h1 className='text-xl font-semibold text-foreground'>
              {dashboardData.getGreeting}
            </h1>
          </div>
          <button
            type='button'
            className='inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent'
            onClick={async () => {
              const data = await dashboardData.refresh();
              if (data && data.length > 0) dashboardCharts.updateChartData(data);
            }}
            disabled={dashboardData.loading}
          >
            <RefreshCw className='h-4 w-4' />
            {dashboardData.t('刷新数据')}
          </button>
        </div>
      </section>

      <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {quickStatCards.map((card, index) => {
          const Icon = iconMap[card.key] || Activity;
          return (
            <StatCard
              key={`${card.title}-${index}`}
              title={card.title || ''}
              value={card.value || 0}
              icon={<Icon className='h-4 w-4 text-blue-400' />}
            />
          );
        })}
      </section>

      <section className='grid gap-4 lg:grid-cols-3'>
        <div className='lg:col-span-2'>
          <SpendChart
            title={dashboardData.t('模型数据分析')}
            data={dashboardData.quotaData || []}
            pieData={dashboardData.pieData}
            modelColors={dashboardData.modelColors}
            loading={dashboardData.loading}
          />
        </div>
        <ApiEndpointsCard endpoints={apiInfo} />
      </section>

      <section className='grid gap-4 lg:grid-cols-2'>
        <ServiceHealthCard
          items={uptimeItems}
          loading={dashboardData.uptimeLoading}
          t={dashboardData.t}
        />
        <FaqAccordion items={faqItems} t={dashboardData.t} />
      </section>

      <section className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
        {QUICK_ACTIONS.map((action) => (
          <a
            key={action.title}
            href={action.href}
            onClick={(event) => handleQuickActionNavigate(event, action.href)}
            className='rounded-lg border border-border bg-card/70 p-4 hover:bg-accent transition-colors'
          >
            <h3 className='font-semibold'>{action.title}</h3>
            <p className='text-sm text-muted-foreground mt-1'>{action.description}</p>
          </a>
        ))}
      </section>
    </div>
  );
}
