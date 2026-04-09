import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  MessageSquare,
  Palette,
  CreditCard,
  Calculator,
  Gauge,
  Shapes,
  Server,
  Activity,
  Cog,
  Settings,
  MoreHorizontal,
  ShieldCheck,
  Key,
  Bell,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../primitives/tabs';
import SystemSetting from '../../../components/settings/SystemSetting';
import OtherSetting from '../../../components/settings/OtherSetting';
import OperationSetting from '../../../components/settings/OperationSetting';
import RateLimitSetting from '../../../components/settings/RateLimitSetting';
import ModelSetting from '../../../components/settings/ModelSetting';
import DashboardSetting from '../../../components/settings/DashboardSetting';
import RatioSetting from '../../../components/settings/RatioSetting';
import ChatsSetting from '../../../components/settings/ChatsSetting';
import DrawingSetting from '../../../components/settings/DrawingSetting';
import PaymentSetting from '../../../components/settings/PaymentSetting';
import ModelDeploymentSetting from '../../../components/settings/ModelDeploymentSetting';
import PerformanceSetting from '../../../components/settings/PerformanceSetting';

const TAB_META = (t) => [
  {
    key: 'operation',
    label: t('运营设置'),
    icon: LayoutDashboard,
    Component: OperationSetting,
  },
  { key: 'dashboard', label: t('仪表盘设置'), icon: Gauge, Component: DashboardSetting },
  { key: 'chats', label: t('聊天设置'), icon: MessageSquare, Component: ChatsSetting },
  { key: 'drawing', label: t('绘图设置'), icon: Palette, Component: DrawingSetting },
  { key: 'payment', label: t('支付设置'), icon: CreditCard, Component: PaymentSetting },
  { key: 'ratio', label: t('分组与模型定价设置'), icon: Calculator, Component: RatioSetting },
  {
    key: 'rate-limit',
    label: t('速率限制设置'),
    icon: Gauge,
    Component: RateLimitSetting,
  },
  { key: 'model', label: t('模型相关设置'), icon: Shapes, Component: ModelSetting },
  {
    key: 'model-deployment',
    label: t('模型部署设置'),
    icon: Server,
    Component: ModelDeploymentSetting,
  },
  { key: 'performance', label: t('性能设置'), icon: Activity, Component: PerformanceSetting },
  { key: 'system', label: t('系统设置'), icon: ShieldCheck, Component: SystemSetting },
  { key: 'auth', label: t('认证设置'), icon: Key, Component: OtherSetting },
  { key: 'notification', label: t('通知设置'), icon: Bell, Component: OtherSetting },
  { key: 'misc', label: t('其他设置'), icon: Cog, Component: OtherSetting },
];

const parseInitialTab = (search, tabKeys = []) => {
  const params = new URLSearchParams(search);
  const rawTab = params.get('tab');
  if (rawTab && tabKeys.includes(rawTab)) {
    return rawTab;
  }
  return 'operation';
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = useMemo(() => TAB_META(t), [t]);
  const validTabKeys = useMemo(() => tabs.map((tab) => tab.key), [tabs]);
  const [activeTab, setActiveTab] = useState(() => parseInitialTab(location.search, validTabKeys));

  useMemo(() => {
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
        <TabsList className='grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
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
