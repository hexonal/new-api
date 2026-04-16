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
import { isRoot } from '../../../helpers';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../primitives/tabs';
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
    icon: Settings,
    Component: OperationSetting,
  },
  {
    key: 'dashboard',
    label: '仪表盘设置',
    caption: 'Dashboard',
    icon: LayoutDashboard,
    Component: DashboardSetting,
  },
  {
    key: 'chats',
    label: '聊天设置',
    caption: 'Chat',
    icon: MessageSquare,
    Component: ChatsSetting,
  },
  {
    key: 'drawing',
    label: '绘图设置',
    caption: 'Drawing',
    icon: Brush,
    Component: DrawingSetting,
  },
  {
    key: 'payment',
    label: '支付设置',
    caption: 'Payment',
    icon: CreditCard,
    Component: PaymentSetting,
  },
  {
    key: 'ratio',
    label: '分组与模型定价设置',
    caption: 'Ratio',
    icon: Calculator,
    Component: RatioSetting,
  },
  {
    key: 'ratelimit',
    label: '速率限制设置',
    caption: 'Rate Limit',
    icon: Gauge,
    Component: RateLimitSetting,
  },
  {
    key: 'models',
    label: '模型相关设置',
    caption: 'Model',
    icon: Shapes,
    Component: ModelSetting,
  },
  {
    key: 'model-deployment',
    label: '模型部署设置',
    caption: 'Deployment',
    icon: Server,
    Component: ModelDeploymentSetting,
  },
  {
    key: 'performance',
    label: '性能设置',
    caption: 'Performance',
    icon: Timer,
    Component: PerformanceSetting,
  },
  {
    key: 'system',
    label: '系统设置',
    caption: 'System',
    icon: Cog,
    Component: SystemSetting,
  },
  {
    key: 'other',
    label: '其他设置',
    caption: 'Other',
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
    const search = new URLSearchParams(location.search);
    search.set('tab', tab);
    navigate(`${location.pathname}?${search.toString()}`, { replace: true });
  };

  if (!isRoot()) {
    return null;
  }

  return (
    <div className='space-y-5'>
      <div className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]'>
        <div className='rounded-[28px] border border-border/70 bg-card px-6 py-6 shadow-sm'>
          <div className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
            {t('System Settings')}
          </div>
          <h1 className='mt-3 text-4xl font-semibold tracking-tight text-foreground'>
            {t('系统设置')}
          </h1>
          <p className='mt-2 max-w-3xl text-sm text-muted-foreground'>
            {t(
              '统一管理平台能力、渠道运营、模型部署、价格策略与系统治理配置。',
            )}
          </p>
        </div>

        <div className='rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-secondary/10 px-6 py-6 shadow-sm'>
          <div className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
            {t('当前配置域')}
          </div>
          <div className='mt-3 text-2xl font-semibold'>{activeMeta.label}</div>
          <div className='mt-1 text-sm text-muted-foreground'>
            {activeMeta.caption}
          </div>
          <div className='mt-6 grid grid-cols-2 gap-3'>
            <div className='rounded-2xl border border-border/60 bg-background/75 p-4'>
              <div className='text-xs text-muted-foreground'>
                {t('配置分区')}
              </div>
              <div className='mt-2 text-xl font-semibold'>{tabs.length}</div>
            </div>
            <div className='rounded-2xl border border-border/60 bg-background/75 p-4'>
              <div className='text-xs text-muted-foreground'>
                {t('当前标签')}
              </div>
              <div className='mt-2 text-xl font-semibold'>
                {activeMeta.caption}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className='w-full'>
        <TabsList className='grid h-auto w-full grid-cols-2 gap-2 rounded-[24px] border border-border/70 bg-muted/20 p-2 md:grid-cols-3 xl:grid-cols-4'>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className='flex min-h-[72px] flex-col items-start gap-1 rounded-2xl px-4 py-3 text-left'
            >
              <div className='flex items-center gap-2'>
                <tab.icon size={16} />
                <span className='text-sm font-semibold'>{tab.caption}</span>
              </div>
              <span className='text-xs text-muted-foreground'>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={`${tab.key}-panel`} value={tab.key}>
            <div className='rounded-[28px] border border-border/70 bg-card p-4 shadow-sm md:p-5'>
              <tab.Component />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
