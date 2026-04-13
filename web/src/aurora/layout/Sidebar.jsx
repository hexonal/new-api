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
  KeyRound,
  LayoutDashboard,
  ListTodo,
  Paintbrush,
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
