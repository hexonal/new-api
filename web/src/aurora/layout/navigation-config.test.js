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

import { describe, expect, test } from 'bun:test';
import {
  isPublicRoute,
  QUICK_LINKS,
  shouldShowMobileMenu,
} from './navigation-config';

describe('navigation-config', () => {
  test('keeps top-level navigation links stable', () => {
    expect(QUICK_LINKS).toEqual([
      { href: '/', label: 'Home' },
      { href: '/console', label: 'Console' },
      { href: '/pricing', label: 'Models' },
      { href: '/about', label: 'Docs' },
    ]);
  });

  test('recognizes public routes', () => {
    expect(isPublicRoute('/')).toBe(true);
    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/console')).toBe(false);
  });

  test('shows mobile menu on compact routes except auth pages', () => {
    expect(
      shouldShowMobileMenu({
        isCompact: false,
        pathname: '/console',
      }),
    ).toBe(false);
    expect(
      shouldShowMobileMenu({
        isCompact: true,
        pathname: '/console',
      }),
    ).toBe(true);
    expect(
      shouldShowMobileMenu({
        isCompact: true,
        pathname: '/',
      }),
    ).toBe(true);
    expect(
      shouldShowMobileMenu({
        isCompact: true,
        pathname: '/login',
      }),
    ).toBe(false);
  });
});
