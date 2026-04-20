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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (file) => readFileSync(join(import.meta.dir, file), 'utf8');

describe('aurora sidebar collapse regression', () => {
  test('exposes a manual collapse toggle on the aurora side pane edge', () => {
    const source = readSource('Sidebar.jsx');

    expect(source).toContain('toggleCollapsed');
    expect(source).toContain('aurora-sidebar-collapse-toggle');
    expect(source).toContain(
      "aria-label={sidebarCollapsed ? t('展开侧边栏') : t('收起侧边栏')}",
    );
  });

  test('does not persist responsive auto-collapse into the stored desktop preference', () => {
    const source = readSource('AuroraLayout.jsx');

    expect(source).toContain('setCollapsed(true, { persist: false })');
    expect(source).toContain(
      'setCollapsed(getStoredSidebarCollapsed(), { persist: false })',
    );
  });

  test('shrinks the root shell grid when the sidebar is collapsed', () => {
    const layoutSource = readSource('AuroraLayout.jsx');
    const cssSource = readSource('../tokens/globals.css');

    expect(layoutSource).toContain('aurora-body-shell-collapsed');
    expect(cssSource).toContain(
      '.aurora-body-shell.aurora-body-shell-collapsed',
    );
    expect(cssSource).toContain('grid-template-columns: 80px minmax(0, 1fr);');
  });

  test('keeps system settings visible to administrators in the aurora sidebar', () => {
    const source = readSource('Sidebar.jsx');

    expect(source).toContain(
      "return isAdminUser && isModuleVisible('admin', 'setting');",
    );
    expect(source).not.toContain(
      "return isRootUser && isModuleVisible('admin', 'setting');",
    );
  });
});
