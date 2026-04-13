import { describe, expect, test } from 'bun:test';
import {
  getConsoleSectionLabels,
  getConsoleSidebarGroups,
  getPageShellBreadcrumb,
  getPageShellTitle,
} from './console-navigation';

describe('console-navigation', () => {
  test('builds localized console section labels and sidebar groups', () => {
    const t = (key) => `t:${key}`;
    const labels = getConsoleSectionLabels(t);
    const groups = getConsoleSidebarGroups(t);

    expect(labels).toEqual({
      WORKSPACE: 't:工作区',
      ACCOUNT: 't:账户',
      ADMIN: 't:管理',
    });
    expect(groups.workspace[0]).toMatchObject({
      href: '/console',
      label: 't:工作区',
    });
    expect(groups.workspace[1]).toMatchObject({
      href: '/console/token',
      label: 't:API 密钥',
    });
  });

  test('builds localized page shell title and breadcrumb', () => {
    const t = (key) => `t:${key}`;

    expect(getPageShellTitle('/console/token', t)).toBe('t:API 密钥');
    expect(getPageShellBreadcrumb('/console/token', t)).toEqual([
      { label: 't:首页', href: '/' },
      { label: 't:控制台', href: '/console' },
      { label: 't:API 密钥', href: '/console/token' },
    ]);
  });
});
