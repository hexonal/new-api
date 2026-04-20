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

import { afterEach, describe, expect, test } from 'bun:test';
import {
  getLanguageSwitcherLabel,
  getResolvedDocsLink,
  getTopNavLinks,
  isLandingPageEnabled,
  isLandingPagePublicAccessEnabled,
  isSystemHomeEnabled,
  parseHeaderNavModulesConfig,
  shouldRedirectHomeToLogin,
} from './top-nav-utils';

const createLocalStorageMock = () => {
  const store = new Map();

  return {
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createLocalStorageMock();
}

describe('top-nav-utils', () => {
  afterEach(() => {
    localStorage.clear();
  });

  test('builds localized top nav links and falls back to about page when docs link is absent', () => {
    const links = getTopNavLinks((key) => `t:${key}`);

    expect(links).toEqual([
      { href: '/', label: 't:首页', external: false },
      { href: '/console', label: 't:控制台', external: false },
      { href: '/pricing', label: 't:模型广场', external: false },
      { href: '/about', label: 't:文档', external: false },
    ]);
  });

  test('uses status docs link for the docs nav item when available', () => {
    const links = getTopNavLinks((key) => `t:${key}`, {
      docsLink: 'https://docs.example.com/guide',
    });

    expect(links.at(-1)).toEqual({
      href: 'https://docs.example.com/guide',
      label: 't:文档',
      external: true,
    });
  });

  test('filters nav items by header navigation modules', () => {
    const links = getTopNavLinks((key) => `t:${key}`, {
      docsLink: 'https://docs.example.com',
      headerNavModules: {
        home: true,
        console: true,
        pricing: { enabled: false, requireAuth: false },
        docs: false,
      },
    });

    expect(links).toEqual([
      { href: '/', label: 't:首页', external: false },
      { href: '/console', label: 't:控制台', external: false },
    ]);
  });

  test('resolves docs link from status first and falls back to local storage', () => {
    localStorage.setItem('docs_link', 'https://cached.example.com/docs');

    expect(
      getResolvedDocsLink({ docs_link: 'https://status.example.com/docs' }),
    ).toBe('https://status.example.com/docs');
    expect(getResolvedDocsLink({})).toBe('https://cached.example.com/docs');
  });

  test('parses header nav modules and normalizes legacy landing and pricing config', () => {
    expect(
      parseHeaderNavModulesConfig(
        JSON.stringify({
          landing: true,
          home: true,
          console: true,
          pricing: true,
          docs: true,
        }),
      ),
    ).toEqual({
      landing: { enabled: true, publicAccess: true },
      home: true,
      console: true,
      pricing: { enabled: true, requireAuth: false },
      docs: true,
    });
  });

  test('supports object landing config with disabled public access', () => {
    expect(
      parseHeaderNavModulesConfig(
        JSON.stringify({
          landing: {
            enabled: true,
            publicAccess: false,
          },
        }),
      ),
    ).toEqual({
      landing: { enabled: true, publicAccess: false },
      pricing: { enabled: true, requireAuth: false },
    });
  });

  test('uses translation key for language switcher label', () => {
    expect(getLanguageSwitcherLabel((key) => `t:${key}`)).toBe('t:切换语言');
  });

  test('enables landing page by default and disables only when explicitly false', () => {
    expect(isLandingPageEnabled()).toBe(true);
    expect(isLandingPageEnabled('')).toBe(true);
    expect(isLandingPageEnabled(JSON.stringify({}))).toBe(true);
    expect(
      isLandingPageEnabled(
        JSON.stringify({
          landing: false,
        }),
      ),
    ).toBe(false);
    expect(isLandingPageEnabled('{invalid-json')).toBe(true);
  });

  test('enables system home by default and disables only when explicitly false', () => {
    expect(isSystemHomeEnabled()).toBe(true);
    expect(isSystemHomeEnabled(JSON.stringify({}))).toBe(true);
    expect(
      isSystemHomeEnabled(
        JSON.stringify({
          home: false,
        }),
      ),
    ).toBe(false);
  });

  test('treats landing page as publicly accessible by default and supports explicit guest blocking', () => {
    expect(isLandingPagePublicAccessEnabled()).toBe(true);
    expect(isLandingPagePublicAccessEnabled(JSON.stringify({}))).toBe(true);
    expect(
      isLandingPagePublicAccessEnabled(
        JSON.stringify({
          landing: {
            enabled: true,
            publicAccess: false,
          },
        }),
      ),
    ).toBe(false);
  });

  test('redirects unauthenticated visitors from home when guest access is disabled or no homepage is available', () => {
    expect(
      shouldRedirectHomeToLogin({
        headerNavModulesConfig: JSON.stringify({
          landing: {
            enabled: true,
            publicAccess: false,
          },
        }),
        isAuthenticated: false,
      }),
    ).toBe(true);

    expect(
      shouldRedirectHomeToLogin({
        headerNavModulesConfig: JSON.stringify({
          landing: {
            enabled: true,
            publicAccess: false,
          },
        }),
        isAuthenticated: true,
      }),
    ).toBe(false);

    expect(
      shouldRedirectHomeToLogin({
        headerNavModulesConfig: JSON.stringify({
          landing: { enabled: false, publicAccess: true },
          home: true,
        }),
        isAuthenticated: false,
      }),
    ).toBe(false);

    expect(
      shouldRedirectHomeToLogin({
        headerNavModulesConfig: JSON.stringify({
          landing: { enabled: false, publicAccess: true },
          home: false,
        }),
        isAuthenticated: false,
      }),
    ).toBe(true);

    expect(
      shouldRedirectHomeToLogin({
        headerNavModulesConfig: JSON.stringify({
          landing: true,
        }),
        isAuthenticated: false,
      }),
    ).toBe(false);
  });
});
