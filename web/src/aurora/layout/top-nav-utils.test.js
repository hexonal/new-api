import { describe, expect, test } from 'bun:test';
import { getTopNavLinks, getLanguageSwitcherLabel } from './top-nav-utils';

describe('top-nav-utils', () => {
  test('builds localized top nav links from translation keys', () => {
    const links = getTopNavLinks((key) => `t:${key}`);

    expect(links).toEqual([
      { href: '/', label: 't:首页' },
      { href: '/console', label: 't:控制台' },
      { href: '/pricing', label: 't:模型广场' },
      { href: '/about', label: 't:文档' },
    ]);
  });

  test('uses translation key for language switcher label', () => {
    expect(getLanguageSwitcherLabel((key) => `t:${key}`)).toBe('t:切换语言');
  });
});
