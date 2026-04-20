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
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../primitives/sheet';
import { Button } from '../primitives/button';
import Sidebar from './Sidebar';
import { QUICK_LINKS } from './navigation-config';

const MobileNav = ({ open, onOpenChange, showConsoleLinks = true }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const mobileLinks = [
    QUICK_LINKS.find((link) => link.href === '/pricing'),
    ...QUICK_LINKS.filter((link) => link.href !== '/pricing'),
  ].filter(Boolean);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='left' className='aurora-mobile-nav'>
        <SheetHeader className='aurora-mobile-nav-head'>
          <div className='aurora-mobile-nav-header'>
            <SheetTitle className='aurora-mobile-nav-title'>
              {t('Menu')}
            </SheetTitle>
            <SheetDescription className='aurora-mobile-nav-desc'>
              {t('Access all console modules')}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className='aurora-mobile-nav-content'>
          <div className='aurora-mobile-nav-actions'>
            {mobileLinks.map((link) => {
              const isActive = location.pathname === link.href;

              return (
              <Link
                key={link.href}
                to={link.href}
                className='block'
                onClick={() => onOpenChange(false)}
              >
                <Button
                  size='sm'
                  variant='ghost'
                  className={`aurora-mobile-nav-link w-full justify-between ${
                    isActive ? 'is-active' : ''
                  }`}
                >
                  {t(link.label)}
                  <ChevronRight size={14} />
                </Button>
              </Link>
              );
            })}
          </div>

          {showConsoleLinks ? (
            <Sidebar
              forceExpanded={true}
              onNavigate={() => {
                onOpenChange(false);
              }}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
