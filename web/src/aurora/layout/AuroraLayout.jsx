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
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import PageShell from './PageShell';
import { useSidebarStore } from '../store/sidebar-store';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { API, setStatusData } from '../../helpers';
import { getPreferredLanguage } from '../../i18n/preference';
import { isPublicRoute, shouldShowMobileMenu } from './navigation-config';
import {
  shouldShowPageShellChrome,
  shouldUseCompactConsoleLayout,
} from './layout-shell-utils';

const getCompactMode = () => {
  if (typeof window === 'undefined') return false;
  return shouldUseCompactConsoleLayout(window.innerWidth);
};

const restoreStoredUser = (userDispatch) => {
  const raw = localStorage.getItem('user');
  if (!raw) {
    return;
  }

  try {
    userDispatch({ type: 'login', payload: JSON.parse(raw) });
  } catch {
    localStorage.removeItem('user');
  }
};

const loadStatusData = async (statusDispatch) => {
  try {
    const res = await API.get('/api/status');
    const { success, data } = res.data;
    if (!success) {
      return;
    }

    statusDispatch({ type: 'set', payload: data });

    // Persist shared status-derived values used across the console.
    setStatusData(data);
  } catch {
    // Keep layout rendering even if status bootstrap is temporarily unavailable.
  }
};

const AuroraLayout = ({ children }) => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const [, statusDispatch] = useContext(StatusContext);
  const [userState, userDispatch] = useContext(UserContext);

  // Mirror PageLayout's loadStatus + loadUser — writes quota_per_unit etc. to localStorage
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) {
      return;
    }
    initialized.current = true;

    restoreStoredUser(userDispatch);
    void loadStatusData(statusDispatch);
  }, [statusDispatch, userDispatch]);

  useEffect(() => {
    const preferredLanguage = getPreferredLanguage({
      userSettingRaw: userState?.user?.setting,
      localStorageLanguage:
        typeof window !== 'undefined' ? localStorage.getItem('i18nextLng') : '',
    });

    if (!preferredLanguage) {
      return;
    }

    localStorage.setItem('i18nextLng', preferredLanguage);
    if (preferredLanguage !== i18n.language) {
      i18n.changeLanguage(preferredLanguage);
    }
  }, [i18n, userState?.user?.setting]);

  const isCompact = getCompactMode();
  const collapsed = useSidebarStore((state) => state.collapsed);
  const setCollapsed = useSidebarStore((state) => state.setCollapsed);
  const mobileOpen = useSidebarStore((state) => state.mobileOpen);
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen);
  const pathname = location.pathname || '';
  const isDashboardRoute = pathname === '/console';

  const publicRoute = isPublicRoute(pathname);
  const showNavigationShell = !publicRoute;
  const showMobileMenu =
    shouldShowMobileMenu({ isCompact, pathname }) || pathname === '/pricing';
  const showPageChrome = shouldShowPageShellChrome({
    pathname,
    showNavigationShell,
  });

  useEffect(() => {
    const onResize = () => {
      const compact = getCompactMode();
      setCollapsed(compact);
      if (!compact) {
        setMobileOpen(false);
      }
    };

    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [setCollapsed, setMobileOpen]);

  return (
    <div className='aurora-root'>
      <TopNav
        onMobileMenu={() => {
          setMobileOpen(true);
        }}
        showMobileMenu={showMobileMenu}
      />

      <div
        className={[
          'aurora-body-shell',
          isCompact || !showNavigationShell ? 'compact' : '',
          isDashboardRoute ? 'aurora-body-shell-dashboard' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {!isCompact && showNavigationShell && (
          <aside className={`aurora-side-pane ${collapsed ? 'collapsed' : ''}`}>
            <Sidebar />
          </aside>
        )}

        <main
          className={[
            'aurora-content',
            !isCompact && showNavigationShell && collapsed ? 'compact' : '',
            !showNavigationShell ? 'aurora-public-content' : '',
            isDashboardRoute ? 'aurora-content-dashboard' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {/* <PageShell showChrome={showNavigationShell}>{children}</PageShell> */}
          {children}
        </main>
      </div>

      {showMobileMenu && (
        <MobileNav
          open={mobileOpen}
          showConsoleLinks={showNavigationShell}
          onOpenChange={(open) => {
            setMobileOpen(open);
          }}
        />
      )}
    </div>
  );
};

export default AuroraLayout;
