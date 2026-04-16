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

export const QUICK_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/console', label: 'Console' },
  { href: '/pricing', label: 'Models' },
  { href: '/about', label: 'Docs' },
];

const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/login$/,
  /^\/register$/,
  /^\/reset$/,
  /^\/user\/reset$/,
  /^\/forbidden$/,
  /^\/pricing$/,
  /^\/about$/,
  /^\/privacy-policy$/,
  /^\/user-agreement$/,
  /^\/oauth(?:\/.*)?$/,
];

export function isPublicRoute(pathname = '') {
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function shouldShowMobileMenu({
  isCompact = false,
  pathname = '',
} = {}) {
  if (isCompact) {
    return true;
  }

  return !isPublicRoute(pathname);
}
