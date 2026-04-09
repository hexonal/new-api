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
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../primitives/sheet';
import { X } from 'lucide-react';
import { Button } from '../primitives/button';
import Sidebar from './Sidebar';

const MobileNav = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='left' className='aurora-mobile-nav'>
        <SheetHeader className='aurora-mobile-nav-head'>
          <div className='aurora-mobile-nav-header'>
            <SheetTitle>{t('Menu')}</SheetTitle>
            <SheetDescription>{t('Access all console modules')}</SheetDescription>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => onOpenChange(false)}
              aria-label={t('Close menu')}
            >
              <X size={16} />
            </Button>
          </div>
        </SheetHeader>

        <div className='aurora-mobile-nav-content'>
          <Sidebar
            onNavigate={() => {
              onOpenChange(false);
            }}
          />

          <div className='aurora-mobile-nav-actions'>
            <Link to='/' onClick={() => onOpenChange(false)}>
              <Button size='sm' variant='outline' className='w-full'>
                {t('Home')}
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
