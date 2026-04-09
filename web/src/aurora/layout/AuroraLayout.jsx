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

import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import PageShell from './PageShell';
import { useSidebarStore } from '../store/sidebar-store';

const getCompactMode = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 1024;
};

const AuroraLayout = ({ children }) => {
  const location = useLocation();
  const isCompact = getCompactMode();
  const collapsed = useSidebarStore((state) => state.collapsed);
  const setCollapsed = useSidebarStore((state) => state.setCollapsed);
  const mobileOpen = useSidebarStore((state) => state.mobileOpen);
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen);
  const pathname = location.pathname || '';

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/reset' ||
    pathname === '/user/reset' ||
    pathname === '/pricing' ||
    pathname === '/forbidden' ||
    pathname === '/about' ||
    pathname === '/privacy-policy' ||
    pathname === '/user-agreement' ||
    pathname.startsWith('/oauth');

  const showNavigationShell = !isPublicRoute;

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
        showMobileMenu={showNavigationShell}
      />

      <div className='aurora-body-shell'>
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
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <PageShell showChrome={showNavigationShell}>{children}</PageShell>
        </main>
      </div>

      {showNavigationShell && (
        <MobileNav
          open={mobileOpen}
          onOpenChange={(open) => {
            setMobileOpen(open);
          }}
        />
      )}
    </div>
  );
};

export default AuroraLayout;
