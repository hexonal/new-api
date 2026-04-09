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

import React, { useContext, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Search as SearchIcon, LayoutDashboard, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { API, getLogo, getSystemName, showSuccess } from '../../helpers';
import { Input } from '../primitives/input';
import { Avatar } from '../primitives/avatar';
import { Button } from '../primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../primitives/dropdown-menu';

const quickLinks = [
  { href: '/', label: 'Home' },
  { href: '/console', label: 'Console' },
  { href: '/pricing', label: 'Models' },
  { href: '/about', label: 'Docs' },
];
const languageOptions = [
  { code: 'zh', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
  { code: 'ru', label: 'Русский' },
  { code: 'vi', label: 'Tiếng Việt' },
];

const buildDisplayName = (user) => {
  if (!user) return '';
  if (user.display_name) return user.display_name;
  if (user.username) return user.username;
  if (user.name) return user.name;
  return user.email || 'User';
};

const TopNav = ({ onMobileMenu, showMobileMenu = true }) => {
  const { t, i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const navigate = useNavigate();

  const currentUser = useMemo(() => {
    if (userState?.user) return userState.user;

    const raw = localStorage.getItem('user');
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [userState?.user]);

  const logout = async () => {
    try {
      await API.get('/api/user/logout');
    } catch (error) {
      // ignore
    }

    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    showSuccess(t('退出登录成功'));
    navigate('/login');
  };

  return (
    <header className='aurora-top-nav'>
      <div className='aurora-top-nav-inner'>
        <div className='aurora-top-nav-left'>
          {showMobileMenu ? (
            <button
              type='button'
              className='aurora-top-nav-menu-btn'
              onClick={onMobileMenu}
              aria-label='Open navigation'
            >
              <Menu size={20} />
            </button>
          ) : null}

          <Link to='/' className='aurora-brand' aria-label={getSystemName() || 'Home'}>
            {getLogo() ? (
              <img src={getLogo()} alt={getSystemName() || 'Logo'} style={{ height: 28, width: 'auto' }} />
            ) : (
              <LayoutDashboard size={20} />
            )}
            <span>{getSystemName() || 'ima-router'}</span>
          </Link>
        </div>

        <div className='aurora-top-nav-search'>
          <SearchIcon size={16} />
          <Input
            placeholder={t('Search models, projects, resources...')}
            disabled
            className='aurora-top-nav-input'
          />
        </div>

        <nav className='aurora-top-nav-links' aria-label='Main navigation'>
          {quickLinks.map((link) => (
            <Link key={link.href} to={link.href} className='aurora-top-nav-link'>
              {link.label}
            </Link>
          ))}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              className='inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-accent'
              aria-label={t('切换语言')}
            >
              <Globe size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side='bottom' align='end'>
            <DropdownMenuLabel>{t('语言')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {languageOptions.map((option) => {
              const active = i18n.language === option.code || i18n.language.startsWith(`${option.code}-`);
              return (
                <DropdownMenuItem
                  key={option.code}
                  onSelect={() => i18n.changeLanguage(option.code)}
                  className={active ? 'bg-accent font-medium' : ''}
                >
                  {option.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className='aurora-top-nav-user'>
          {currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type='button' className='aurora-avatar-trigger'>
                  <Avatar>
                    <span>
                      {(currentUser.username || 'U').slice(0, 1).toUpperCase()}
                    </span>
                  </Avatar>
                  <span className='aurora-user-label'>{buildDisplayName(currentUser)}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side='bottom' align='end'>
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link to='/console/personal'>{t('Profile')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to='/console/token'>{t('API Keys')}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout}>{t('Sign out')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className='aurora-top-nav-auth'>
              <Link to='/login'>
                <Button variant='ghost' size='sm'>
                  {t('Login')}
                </Button>
              </Link>
              <Link to='/register'>
                <Button variant='outline' size='sm'>
                  {t('Register')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopNav;
