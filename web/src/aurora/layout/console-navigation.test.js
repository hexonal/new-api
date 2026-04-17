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
    expect(groups.admin).toContainEqual(
      expect.objectContaining({
        href: '/console/setting',
        label: 't:系统设置',
      }),
    );
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
