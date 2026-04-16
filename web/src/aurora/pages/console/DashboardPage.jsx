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

import React, { useContext, useEffect, useRef } from 'react';
import { Activity, BarChart3, Gauge, RefreshCw, Wallet } from 'lucide-react';
import { UserContext } from '../../../context/User';
import { StatusContext } from '../../../context/Status';
import { StatCard, SpendChart, ApiEndpointsCard } from './components';
import { SPEND_CHART_TABS } from './components/spend-chart-constants.js';
import FaqAccordion from './components/FaqAccordion';
import AnnouncementCenterCard from './dashboard/AnnouncementCenterCard';
import {
  buildDashboardHighlightCards,
  buildDashboardSupportPanels,
} from './dashboard/dashboard-view-model';
import { useDashboardData } from '../../../hooks/dashboard/useDashboardData';
import { useDashboardStats } from '../../../hooks/dashboard/useDashboardStats';
import { useDashboardCharts } from '../../../hooks/dashboard/useDashboardCharts';

const iconMap = {
  balance: Wallet,
  requests: Activity,
  usage: BarChart3,
  rate: Gauge,
};

const buildAnnouncementData = (items = []) =>
  items.map((item) => ({
    ...item,
    relative: item?.relative || '',
    time: item?.time || item?.publishDate || '',
  }));

function DashboardBanner({ greeting, loading, onRefresh, t }) {
  return (
    <section className='mb-2'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className='mt-1 text-sm text-slate-500'>{greeting}</p>
        </div>
        <button
          type='button'
          className='inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className='h-4 w-4' />
          {t('刷新数据')}
        </button>
      </div>
    </section>
  );
}

function DashboardHighlights({ cards }) {
  return (
    <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
      {cards.map((card, index) => {
        const Icon = iconMap[card.metricKey] || Activity;

        return (
          <StatCard
            key={`${card.metricKey}-${index}`}
            title={card.title || ''}
            value={card.value || 0}
            icon={<Icon className='h-4 w-4' />}
            badgeText={card.badgeText}
          />
        );
      })}
    </section>
  );
}

function DashboardChartSection({ dashboardData }) {
  const [activeChartTab, setActiveChartTab] = React.useState('trend');

  return (
    <section className='rounded-xl border border-slate-200 bg-white p-6 shadow-sm'>
      <div className='mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div className='flex flex-wrap gap-2'>
          {SPEND_CHART_TABS.map((tab) => (
            <button
              key={tab.key}
              type='button'
              className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${
                activeChartTab === tab.key
                  ? 'bg-indigo-50 font-bold text-indigo-600'
                  : 'font-medium text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
              }`}
              onClick={() => setActiveChartTab(tab.key)}
            >
              {dashboardData.t(tab.label)}
            </button>
          ))}
        </div>
        <div className='text-xs font-medium uppercase tracking-[0.16em] text-slate-400'>
          {dashboardData.t('范围')}: {dashboardData.dataExportDefaultTime}
        </div>
      </div>
      <SpendChart
        title={dashboardData.t('模型数据分析')}
        data={dashboardData.quotaData || []}
        pieData={dashboardData.pieData}
        modelColors={dashboardData.modelColors}
        loading={dashboardData.loading}
        activeTab={activeChartTab}
        onTabChange={setActiveChartTab}
        showTabs={false}
        showTitle={false}
      />
    </section>
  );
}

function DashboardSupportGrid({ panels, t }) {
  return (
    <section className='grid gap-8 lg:grid-cols-3'>
      <ApiEndpointsCard endpoints={panels[0].items} t={t} />
      <FaqAccordion items={panels[1].items} t={t} />
      <AnnouncementCenterCard
        title={t('Announcements')}
        announcementItems={panels[2].announcementItems}
        uptimeItems={panels[2].uptimeItems}
        emptyTitle={panels[2].emptyTitle}
        emptyDescription={panels[2].emptyDescription}
        t={t}
      />
    </section>
  );
}

export default function DashboardPage() {
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const dashboardData = useDashboardData(userState, userDispatch, statusState);
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
  const dataLoaded = useRef(false);

  useEffect(() => {
    if (dataLoaded.current) {
      return;
    }
    dataLoaded.current = true;

    void (async () => {
      const data = await dashboardData.refresh();
      if (data && data.length > 0) {
        dashboardCharts.updateChartData(data);
      }
    })();
  }, [dashboardCharts, dashboardData]);

  const cards = buildDashboardHighlightCards(groupedStatsData || []);
  const panels = buildDashboardSupportPanels({
    apiInfoItems: Array.isArray(statusState?.status?.api_info)
      ? statusState.status.api_info
      : [],
    faqItems: Array.isArray(statusState?.status?.faq) ? statusState.status.faq : [],
    announcementItems: buildAnnouncementData(
      Array.isArray(statusState?.status?.announcements)
        ? statusState.status.announcements
        : [],
    ),
    uptimeItems: Array.isArray(dashboardData.uptimeData)
      ? dashboardData.uptimeData
      : [],
    t: dashboardData.t,
  });

  return (
    <div className='space-y-8'>
      <DashboardBanner
        greeting={dashboardData.getGreeting}
        loading={dashboardData.loading}
        onRefresh={async () => {
          const data = await dashboardData.refresh();
          if (data && data.length > 0) {
            dashboardCharts.updateChartData(data);
          }
        }}
        t={dashboardData.t}
      />
      <DashboardHighlights cards={cards} />
      <DashboardChartSection dashboardData={dashboardData} />
      <DashboardSupportGrid panels={panels} t={dashboardData.t} />
    </div>
  );
}
