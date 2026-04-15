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

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/cn';

const SidebarItem = ({
  href,
  label,
  icon,
  collapsed,
  onNavigate = () => {},
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === href;

  const handleClick = (event) => {
    const isModifiedClick =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    const isNonPrimaryButton = event.button !== 0;

    if (isModifiedClick || isNonPrimaryButton) {
      return;
    }

    event.preventDefault();
    onNavigate();
    navigate(href);
  };

  return (
    <li>
      <Link
        to={href}
        onClick={handleClick}
        className={cn(
          'aurora-sidebar-item',
          isActive && 'aurora-sidebar-item-active',
          collapsed && 'aurora-sidebar-item-collapsed',
        )}
      >
        <span className='aurora-sidebar-item-icon' aria-hidden={true}>
          {icon}
        </span>
        {!collapsed && <span className='aurora-sidebar-item-label'>{label}</span>}
      </Link>
    </li>
  );
};

export default SidebarItem;
