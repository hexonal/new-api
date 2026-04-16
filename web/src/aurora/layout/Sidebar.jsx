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

import React, { useEffect, useMemo } from 'react';
import {
  BarChart3,
  Boxes,
  CreditCard,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Paintbrush,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  Package,
  UserCog,
  Gem,
  Building2,
} from 'lucide-react';
import { isAdmin } from '../../helpers/utils';
import SidebarItem from './SidebarItem';
import SidebarSection from './SidebarSection';
import { useSidebarStore } from '../store/sidebar-store';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getConsoleSectionLabels,
  getConsoleSidebarGroups,
} from './console-navigation';

const isPathActive = (targetPath, currentPath) => {
  if (targetPath === '/console') {
    return currentPath === '/console' || currentPath.startsWith('/console?');
  }

  if (targetPath === '/console/token') {
    return currentPath === '/console/token';
  }

  return currentPath === targetPath;
};

const SECTION_NAMES = {
  WORKSPACE: 'WORKSPACE',
  ACCOUNT: 'ACCOUNT',
  ADMIN: 'ADMIN',
};

const getNavIcon = (key) => {
  switch (key) {
    case 'dashboard':
      return <LayoutDashboard size={17} strokeWidth={2} />;
    case 'api-keys':
      return <KeyRound size={17} strokeWidth={2} />;
    case 'usage-logs':
      return <ListTodo size={17} strokeWidth={2} />;
    case 'key-cost':
      return <BarChart3 size={17} strokeWidth={2} />;
    case 'callback-logs':
      return <ShieldCheck size={17} strokeWidth={2} />;
    case 'midjourney':
      return <Paintbrush size={17} strokeWidth={2} />;
    case 'task-logs':
      return <Package size={17} strokeWidth={2} />;
    case 'wallet':
      return <Wallet size={17} strokeWidth={2} />;
    case 'personal':
      return <Settings size={17} strokeWidth={2} />;
    case 'channel':
      return <Building2 size={17} strokeWidth={2} />;
    case 'subscription':
      return <Gem size={17} strokeWidth={2} />;
    case 'models':
      return <Boxes size={17} strokeWidth={2} />;
    case 'deployment':
      return <Package size={17} strokeWidth={2} />;
    case 'redemption':
      return <CreditCard size={17} strokeWidth={2} />;
    case 'users':
      return <Users size={17} strokeWidth={2} />;
    case 'groups':
      return <UserCog size={17} strokeWidth={2} />;
    default:
      return null;
  }
};

const isSectionPath = (items, pathname) =>
  items.some((item) => isPathActive(item.href, pathname));

const Sidebar = ({ onNavigate = () => {} }) => {
  const collapsed = useSidebarStore((state) => state.collapsed);
  const setActiveSection = useSidebarStore((state) => state.setActiveSection);
  const location = useLocation();
  const isAdminUser = isAdmin();
  const { t } = useTranslation();
  const sectionLabels = useMemo(() => getConsoleSectionLabels(t), [t]);
  const sidebarGroups = useMemo(() => getConsoleSidebarGroups(t), [t]);
  const isPricingRoute = location.pathname === '/pricing';

  useEffect(() => {
    if (isSectionPath(sidebarGroups.workspace, location.pathname)) {
      setActiveSection(SECTION_NAMES.WORKSPACE);
      return;
    }

    if (isSectionPath(sidebarGroups.account, location.pathname)) {
      setActiveSection(SECTION_NAMES.ACCOUNT);
      return;
    }

    if (isSectionPath(sidebarGroups.admin, location.pathname)) {
      setActiveSection(SECTION_NAMES.ADMIN);
    }
  }, [location.pathname, setActiveSection, sidebarGroups]);

  const workspaceNodes = useMemo(
    () =>
      sidebarGroups.workspace.map((item) => (
        <SidebarItem
          key={item.key}
          collapsed={collapsed}
          href={item.href}
          label={item.label}
          icon={getNavIcon(item.key)}
          onNavigate={onNavigate}
        />
      )),
    [collapsed, onNavigate, sidebarGroups],
  );

  const accountNodes = useMemo(
    () =>
      sidebarGroups.account.map((item) => (
        <SidebarItem
          key={item.key}
          collapsed={collapsed}
          href={item.href}
          label={item.label}
          icon={getNavIcon(item.key)}
          onNavigate={onNavigate}
        />
      )),
    [collapsed, onNavigate, sidebarGroups],
  );

  const adminNodes = useMemo(
    () =>
      sidebarGroups.admin.map((item) => (
        <SidebarItem
          key={item.key}
          collapsed={collapsed}
          href={item.href}
          label={item.label}
          icon={getNavIcon(item.key)}
          onNavigate={onNavigate}
        />
      )),
    [collapsed, onNavigate, sidebarGroups],
  );

  if (isPricingRoute) {
    const pricingNavItems = [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard size={16} strokeWidth={2} />,
        active: false,
      },
      {
        key: 'models',
        label: 'Models',
        icon: <Boxes size={16} strokeWidth={2} />,
        active: true,
      },
      {
        key: 'keys',
        label: 'Keys',
        icon: <KeyRound size={16} strokeWidth={2} />,
        active: false,
      },
      {
        key: 'usage',
        label: 'Usage',
        icon: <BarChart3 size={16} strokeWidth={2} />,
        active: false,
      },
      {
        key: 'settings',
        label: 'Settings',
        icon: <Settings size={16} strokeWidth={2} />,
        active: false,
      },
    ];

    return (
      <div className='flex h-full flex-col bg-gray-50 px-3 py-4'>
        <div className='mb-4 px-2'>
          <div className='flex items-center gap-2'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white'>
              <Boxes size={15} />
            </div>
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-wider text-indigo-600 font-['Public_Sans']">
                Admin Console
              </h2>
              <p className='text-[10px] text-gray-500'>Gateway Management</p>
            </div>
          </div>
        </div>

        <nav className='space-y-1' aria-label='Pricing Sidebar'>
          {pricingNavItems.map((item) => (
            <button
              key={item.key}
              type='button'
              className={[
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium font-['Public_Sans'] transition-colors",
                item.active
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          type='button'
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white font-['Public_Sans'] hover:bg-indigo-700"
        >
          <Plus size={14} />
          <span>New Deployment</span>
        </button>

        <div className='mt-auto space-y-1 border-t border-gray-200 pt-3'>
          <button
            type='button'
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:bg-gray-100 font-['Public_Sans']"
          >
            <HelpCircle size={15} />
            <span>Help</span>
          </button>
          <button
            type='button'
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:bg-gray-100 font-['Public_Sans']"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <nav className='aurora-sidebar' aria-label={t('控制台导航')}>
      <SidebarSection title={sectionLabels.WORKSPACE} collapsed={collapsed}>
        {workspaceNodes}
      </SidebarSection>

      <SidebarSection title={sectionLabels.ACCOUNT} collapsed={collapsed}>
        {accountNodes}
      </SidebarSection>

      {isAdminUser && (
        <SidebarSection title={sectionLabels.ADMIN} collapsed={collapsed}>
          {adminNodes}
        </SidebarSection>
      )}
    </nav>
  );
};

export default Sidebar;
