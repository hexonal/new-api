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

const SECTION_LABELS = {
  WORKSPACE: 'WORKSPACE',
  ACCOUNT: 'ACCOUNT',
  ADMIN: 'ADMIN',
};

const isPathActive = (targetPath, currentPath) => {
  if (targetPath === '/console') {
    return currentPath === '/console' || currentPath.startsWith('/console?');
  }

  if (targetPath === '/console/token') {
    return currentPath === '/console/token';
  }

  return currentPath === targetPath;
};

const workspaceItems = [
  {
    key: 'dashboard',
    label: 'Workspace',
    href: '/console',
    icon: <LayoutDashboard size={17} strokeWidth={2} />,
  },
  {
    key: 'api-keys',
    label: 'API Keys',
    href: '/console/token',
    icon: <KeyRound size={17} strokeWidth={2} />,
  },
  {
    key: 'usage-logs',
    label: 'Usage Logs',
    href: '/console/log',
    icon: <ListTodo size={17} strokeWidth={2} />,
  },
  {
    key: 'key-cost',
    label: 'Key Cost Analysis',
    href: '/console/key-cost',
    icon: <BarChart3 size={17} strokeWidth={2} />,
  },
  {
    key: 'callback-logs',
    label: 'Callback Logs',
    href: '/console/callback',
    icon: <ShieldCheck size={17} strokeWidth={2} />,
  },
  {
    key: 'midjourney',
    label: 'MJ Logs',
    href: '/console/midjourney',
    icon: <Paintbrush size={17} strokeWidth={2} />,
  },
  {
    key: 'task-logs',
    label: 'Task Logs',
    href: '/console/task',
    icon: <Package size={17} strokeWidth={2} />,
  },
];

const accountItems = [
  {
    key: 'wallet',
    label: 'Wallet',
    href: '/console/topup',
    icon: <Wallet size={17} strokeWidth={2} />,
  },
  {
    key: 'personal',
    label: 'Personal Settings',
    href: '/console/personal',
    icon: <Settings size={17} strokeWidth={2} />,
  },
];

const adminItems = [
  {
    key: 'channel',
    label: 'Channel Mgmt',
    href: '/console/channel',
    icon: <Building2 size={17} strokeWidth={2} />,
  },
  {
    key: 'subscription',
    label: 'Subscription',
    href: '/console/subscription',
    icon: <Gem size={17} strokeWidth={2} />,
  },
  {
    key: 'models',
    label: 'Models',
    href: '/console/models',
    icon: <Boxes size={17} strokeWidth={2} />,
  },
  {
    key: 'deployment',
    label: 'Model Deployment',
    href: '/console/deployment',
    icon: <Package size={17} strokeWidth={2} />,
  },
  {
    key: 'redemption',
    label: 'Redemption',
    href: '/console/redemption',
    icon: <CreditCard size={17} strokeWidth={2} />,
  },
  {
    key: 'users',
    label: 'Users',
    href: '/console/user',
    icon: <Users size={17} strokeWidth={2} />,
  },
  {
    key: 'groups',
    label: 'Group Mgmt',
    href: '/console/setting/group-management',
    icon: <UserCog size={17} strokeWidth={2} />,
  },
];

const isAdminSectionPath = (pathname) => {
  return adminItems.some((item) => isPathActive(item.href, pathname));
};

const isAccountSectionPath = (pathname) => {
  return accountItems.some((item) => isPathActive(item.href, pathname));
};

const isWorkspaceSectionPath = (pathname) => {
  return workspaceItems.some((item) => isPathActive(item.href, pathname));
};

const Sidebar = ({ onNavigate = () => {} }) => {
  const collapsed = useSidebarStore((state) => state.collapsed);
  const setActiveSection = useSidebarStore((state) => state.setActiveSection);
  const location = useLocation();
  const isAdminUser = isAdmin();

  useEffect(() => {
    if (isWorkspaceSectionPath(location.pathname)) {
      setActiveSection(SECTION_LABELS.WORKSPACE);
      return;
    }

    if (isAccountSectionPath(location.pathname)) {
      setActiveSection(SECTION_LABELS.ACCOUNT);
      return;
    }

    if (isAdminSectionPath(location.pathname)) {
      setActiveSection(SECTION_LABELS.ADMIN);
    }
  }, [location.pathname, setActiveSection]);

  const workspaceNodes = useMemo(
    () =>
      workspaceItems.map((item) => (
        <SidebarItem
          key={item.key}
          collapsed={collapsed}
          href={item.href}
          label={item.label}
          icon={item.icon}
          onNavigate={onNavigate}
        />
      )),
    [collapsed, onNavigate],
  );

  const accountNodes = useMemo(
    () =>
      accountItems.map((item) => (
        <SidebarItem
          key={item.key}
          collapsed={collapsed}
          href={item.href}
          label={item.label}
          icon={item.icon}
          onNavigate={onNavigate}
        />
      )),
    [collapsed, onNavigate],
  );

  const adminNodes = useMemo(
    () =>
      adminItems.map((item) => (
        <SidebarItem
          key={item.key}
          collapsed={collapsed}
          href={item.href}
          label={item.label}
          icon={item.icon}
          onNavigate={onNavigate}
        />
      )),
    [collapsed, onNavigate],
  );

  return (
    <nav className='aurora-sidebar' aria-label='Console navigation'>
      <SidebarSection title={SECTION_LABELS.WORKSPACE} collapsed={collapsed}>
        {workspaceNodes}
      </SidebarSection>

      <SidebarSection title={SECTION_LABELS.ACCOUNT} collapsed={collapsed}>
        {accountNodes}
      </SidebarSection>

      {isAdminUser && (
        <SidebarSection title={SECTION_LABELS.ADMIN} collapsed={collapsed}>
          {adminNodes}
        </SidebarSection>
      )}
    </nav>
  );
};

export default Sidebar;
