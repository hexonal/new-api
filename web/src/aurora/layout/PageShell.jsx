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

import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

const titleMap = {
  '/': 'Home',
  '/console': 'Console',
  '/console/token': 'API Keys',
  '/console/log': 'Usage Logs',
  '/console/key-cost': 'Key Cost Analysis',
  '/console/callback': 'Callback Logs',
  '/console/midjourney': 'Drawing Logs',
  '/console/task': 'Task Logs',
  '/console/topup': 'Wallet',
  '/console/personal': 'Personal Settings',
  '/console/channel': 'Channel Management',
  '/console/subscription': 'Subscription',
  '/console/models': 'Model Management',
  '/console/deployment': 'Model Deployment',
  '/console/redemption': 'Redemption',
  '/console/user': 'User Management',
  '/console/setting/group-management': 'Group Management',
  '/console/setting': 'System Settings',
  '/pricing': 'Pricing',
  '/about': 'About',
  '/privacy-policy': 'Privacy Policy',
  '/user-agreement': 'User Agreement',
};

const buildBreadcrumb = (path) => {
  if (path.startsWith('/console/chat/')) {
    const chatId = path.replace('/console/chat/', '');
    const detailLabel = chatId ? `Chat ${decodeURIComponent(chatId)}` : 'Chat';
    return [
      { label: 'Home', href: '/' },
      { label: 'Console', href: '/console' },
      { label: detailLabel },
    ];
  }

  const pageTitle = titleMap[path] || 'IMA Router';
  const root = path === '/' ? null : path.startsWith('/console') ? '/console' : '/';

  return [
    { label: 'Home', href: '/' },
    ...(root ? [{ label: root === '/console' ? 'Console' : 'Home', href: root }] : []),
    ...(pageTitle === 'Console' ? [] : [{ label: pageTitle, href: path }]),
  ];
};

const PageShell = ({ children, showChrome = true }) => {
  const location = useLocation();
  const breadcrumb = useMemo(
    () => buildBreadcrumb(location.pathname),
    [location.pathname],
  );

  const title = useMemo(() => {
    if (location.pathname.startsWith('/console/chat/')) return 'Chat';
    return titleMap[location.pathname] || 'IMA Router';
  }, [location.pathname]);

  if (!showChrome) {
    return <div className='aurora-page-shell-plain'>{children}</div>;
  }

  return (
    <div className='aurora-page-shell'>
      <div className='aurora-page-shell-header'>
        <div className='aurora-breadcrumb'>
          <Home size={14} />
          {breadcrumb.map((item, index) => {
            const isLast = index === breadcrumb.length - 1;

            return (
              <React.Fragment key={`${item.label}-${index}`}>
                <span className='aurora-breadcrumb-divider'>/</span>
                {isLast ? (
                  <span className='aurora-breadcrumb-item aurora-breadcrumb-item-current'>
                    {item.label}
                  </span>
                ) : (
                  <Link className='aurora-breadcrumb-item' to={item.href}>
                    {item.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <h1 className='aurora-page-title'>{title}</h1>
      </div>

      <div className='aurora-page-content'>
        {children}
      </div>
    </div>
  );
};

export default PageShell;
