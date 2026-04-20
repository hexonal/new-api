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

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  LayoutDashboard,
  MessageSquare,
  Brush,
  CreditCard,
  Shapes,
  Calculator,
  Gauge,
  Server,
  Timer,
  Cog,
  MoreHorizontal,
} from 'lucide-react';
import { isAdmin } from '../../../helpers';
import OperationSetting from '../../../components/settings/OperationSetting';
import DashboardSetting from '../../../components/settings/DashboardSetting';
import ChatsSetting from '../../../components/settings/ChatsSetting';
import DrawingSetting from '../../../components/settings/DrawingSetting';
import PaymentSetting from '../../../components/settings/PaymentSetting';
import RatioSetting from '../../../components/settings/RatioSetting';
import RateLimitSetting from '../../../components/settings/RateLimitSetting';
import ModelSetting from '../../../components/settings/ModelSetting';
import ModelDeploymentSetting from '../../../components/settings/ModelDeploymentSetting';
import PerformanceSetting from '../../../components/settings/PerformanceSetting';
import SystemSetting from '../../../components/settings/SystemSetting';
import OtherSetting from '../../../components/settings/OtherSetting';

const TAB_META = [
  {
    key: 'operation',
    label: '运营设置',
    caption: 'General',
    description: '站点开关、模块可见性、敏感词与监控告警策略。',
    icon: Settings,
    Component: OperationSetting,
  },
  {
    key: 'dashboard',
    label: '仪表盘设置',
    caption: 'Dashboard',
    description: '控制台公告、API 信息、FAQ 与 Uptime 数据配置。',
    icon: LayoutDashboard,
    Component: DashboardSetting,
  },
  {
    key: 'chats',
    label: '聊天设置',
    caption: 'Chat',
    description: '聊天模板、默认行为与展示策略配置。',
    icon: MessageSquare,
    Component: ChatsSetting,
  },
  {
    key: 'drawing',
    label: '绘图设置',
    caption: 'Drawing',
    description: '绘图通道与 Midjourney 等相关参数设置。',
    icon: Brush,
    Component: DrawingSetting,
  },
  {
    key: 'payment',
    label: '支付设置',
    caption: 'Payment',
    description: '充值通道、价格项与第三方支付网关配置。',
    icon: CreditCard,
    Component: PaymentSetting,
  },
  {
    key: 'ratio',
    label: '分组与模型定价设置',
    caption: 'Ratio',
    description: '模型倍率、分组倍率及上游比率同步能力。',
    icon: Calculator,
    Component: RatioSetting,
  },
  {
    key: 'ratelimit',
    label: '速率限制设置',
    caption: 'Rate Limit',
    description: '请求节流与速率门限规则配置。',
    icon: Gauge,
    Component: RateLimitSetting,
  },
  {
    key: 'models',
    label: '模型相关设置',
    caption: 'Model',
    description: '全局模型参数、厂商兼容参数与特性开关。',
    icon: Shapes,
    Component: ModelSetting,
  },
  {
    key: 'model-deployment',
    label: '模型部署设置',
    caption: 'Deployment',
    description: '模型部署参数与联通性校验配置。',
    icon: Server,
    Component: ModelDeploymentSetting,
  },
  {
    key: 'performance',
    label: '性能设置',
    caption: 'Performance',
    description: '缓存、资源阈值与性能监控相关配置。',
    icon: Timer,
    Component: PerformanceSetting,
  },
  {
    key: 'system',
    label: '系统设置',
    caption: 'System',
    description: '认证、邮件、OAuth、域名策略等系统级配置。',
    icon: Cog,
    Component: SystemSetting,
  },
  {
    key: 'other',
    label: '其他设置',
    caption: 'Other',
    description: '导入导出、系统信息与补充功能配置。',
    icon: MoreHorizontal,
    Component: OtherSetting,
  },
];

const parseInitialTab = (search, tabKeys = []) => {
  const params = new URLSearchParams(search);
  const rawTab = params.get('tab');
  if (rawTab && tabKeys.includes(rawTab)) {
    return rawTab;
  }
  return tabKeys[0] || 'operation';
};

const getUpdatedSearch = (search, nextTab) => {
  const params = new URLSearchParams(search);
  params.set('tab', nextTab);
  return params.toString();
};

const SettingsHero = ({ activeMeta, tabs, t }) => {
  return (
    <div className='grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]'>
      <div className='rounded-2xl border border-slate-200/80 bg-white px-6 py-6 shadow-sm'>
        <div className='text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>
          {t('System Settings')}
        </div>
        <h1 className='mt-3 text-4xl font-semibold tracking-tight text-slate-900'>
          {t('系统设置')}
        </h1>
        <p className='mt-2 max-w-3xl text-sm text-slate-600'>
          {t('统一管理平台能力、渠道运营、模型部署、价格策略与系统治理配置。')}
        </p>
      </div>

      <div className='rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 px-6 py-6 shadow-sm'>
        <div className='text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>
          {t('当前配置域')}
        </div>
        <div className='mt-3 text-2xl font-semibold text-slate-900'>
          {activeMeta.label}
        </div>
        <div className='mt-1 text-sm text-slate-600'>{activeMeta.caption}</div>
        <div className='mt-6 grid grid-cols-2 gap-3'>
          <div className='rounded-xl border border-slate-200 bg-white/80 p-4'>
            <div className='text-xs text-slate-500'>{t('配置分区')}</div>
            <div className='mt-2 text-xl font-semibold text-slate-900'>
              {tabs.length}
            </div>
          </div>
          <div className='rounded-xl border border-slate-200 bg-white/80 p-4'>
            <div className='text-xs text-slate-500'>{t('当前标签')}</div>
            <div className='mt-2 text-xl font-semibold text-slate-900'>
              {activeMeta.caption}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsNav = ({ tabs, activeTab, onTabChange, t }) => {
  return (
    <aside className='sticky top-24 h-fit rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm'>
      <div className='mb-4 px-2'>
        <p className='text-lg font-semibold tracking-tight text-slate-900'>
          {t('系统设置')}
        </p>
        <p className='text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>
          {t('全局配置')}
        </p>
      </div>
      <nav className='space-y-1' aria-label={t('系统设置导航')}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type='button'
              onClick={() => onTabChange(tab.key)}
              className={[
                'group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-0.5 inline-flex rounded-lg p-1.5',
                  isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100',
                ].join(' ')}
              >
                <tab.icon size={15} />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block text-sm font-semibold'>{tab.label}</span>
                <span className='mt-0.5 block text-[11px] uppercase tracking-[0.12em] text-slate-500'>
                  {tab.caption}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

const SettingsContent = ({ activeMeta, t }) => {
  return (
    <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5'>
      <div className='mb-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3'>
        <div className='text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500'>
          {t('当前模块')}
        </div>
        <div className='mt-1 flex flex-wrap items-center gap-2'>
          <span className='text-base font-semibold text-slate-900'>
            {activeMeta.label}
          </span>
          <span className='rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600'>
            {activeMeta.caption}
          </span>
        </div>
        <p className='mt-2 text-sm text-slate-600'>{activeMeta.description}</p>
      </div>
      <activeMeta.Component />
    </section>
  );
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = useMemo(() => TAB_META, []);
  const validTabKeys = useMemo(() => tabs.map((tab) => tab.key), [tabs]);
  const [activeTab, setActiveTab] = useState(() =>
    parseInitialTab(location.search, validTabKeys),
  );
  const activeMeta = useMemo(
    () => tabs.find((tab) => tab.key === activeTab) || tabs[0],
    [activeTab, tabs],
  );

  useEffect(() => {
    const nextTab = parseInitialTab(location.search, validTabKeys);
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [location.search, activeTab, validTabKeys]);

  const onTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`${location.pathname}?${getUpdatedSearch(location.search, tab)}`, {
      replace: true,
    });
  };

  if (!isAdmin()) {
    return null;
  }

  return (
    <div className='space-y-5'>
      <SettingsHero activeMeta={activeMeta} tabs={tabs} t={t} />

      <div className='grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]'>
        <SettingsNav
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          t={t}
        />
        <SettingsContent activeMeta={activeMeta} t={t} />
      </div>
    </div>
  );
}
