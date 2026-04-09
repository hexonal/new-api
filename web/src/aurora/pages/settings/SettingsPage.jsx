import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  SlidersHorizontal,
  Key,
  CreditCard,
  Gauge,
  Activity,
  Palette,
  Shapes,
  Calculator,
  Timer,
  Brush,
  MessageSquare,
  ServerCog,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../primitives/tabs';
import GeneralTab from './GeneralTab';
import AuthTab from './AuthTab';
import PaymentTab from './PaymentTab';
import RateLimitTab from './RateLimitTab';
import MonitoringTab from './MonitoringTab';
import BrandingTab from './BrandingTab';
import ModelTab from './ModelTab';
import RatioTab from './RatioTab';
import PerformanceTab from './PerformanceTab';
import DrawingTab from './DrawingTab';
import ChatTab from './ChatTab';
import SystemTab from './SystemTab';

const TAB_META = [
  { key: 'general', label: 'General', icon: SlidersHorizontal, Component: GeneralTab },
  { key: 'auth', label: 'Auth', icon: Key, Component: AuthTab },
  { key: 'payment', label: 'Payment', icon: CreditCard, Component: PaymentTab },
  { key: 'rate-limit', label: 'RateLimit', icon: Gauge, Component: RateLimitTab },
  { key: 'monitoring', label: 'Monitoring', icon: Activity, Component: MonitoringTab },
  { key: 'branding', label: 'Branding', icon: Palette, Component: BrandingTab },
  { key: 'model', label: 'Model', icon: Shapes, Component: ModelTab },
  { key: 'ratio', label: 'Ratio', icon: Calculator, Component: RatioTab },
  { key: 'performance', label: 'Performance', icon: Timer, Component: PerformanceTab },
  { key: 'drawing', label: 'Drawing', icon: Brush, Component: DrawingTab },
  { key: 'chat', label: 'Chat', icon: MessageSquare, Component: ChatTab },
  { key: 'system', label: 'System', icon: ServerCog, Component: SystemTab },
];

const parseInitialTab = (search, tabKeys = []) => {
  const params = new URLSearchParams(search);
  const rawTab = params.get('tab');
  if (rawTab && tabKeys.includes(rawTab)) {
    return rawTab;
  }
  return 'general';
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = useMemo(() => TAB_META, []);
  const validTabKeys = useMemo(() => tabs.map((tab) => tab.key), [tabs]);
  const [activeTab, setActiveTab] = useState(() => parseInitialTab(location.search, validTabKeys));

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

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border border-border bg-card p-4 md:p-5'>
        <h1 className='text-lg font-semibold'>{t('系统设置')}</h1>
        <p className='text-sm text-muted-foreground mt-1'>
          {t('在这里统一配置平台功能、权限、模型与计费等参数')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className='w-full'>
        <TabsList className='grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              <tab.icon size={14} className='mr-2' />
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={`${tab.key}-panel`} value={tab.key}>
            <div className='rounded-xl border border-border bg-card p-3 md:p-4'>
              <tab.Component />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
