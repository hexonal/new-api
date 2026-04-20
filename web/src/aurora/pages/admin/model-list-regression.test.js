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

describe('model list regression', () => {
  test('exposes a dedicated priority column in the aurora model list', () => {
    const source = readSource('ModelListPage.jsx');

    expect(source).toContain("{t('优先级')}");
    expect(source).toContain('const priority = Number(row.sort_order ?? 0);');
    expect(source).toContain("type='number'");
    expect(source).toContain('onBlur={(event) =>');
    expect(source).toContain('updateModelSortOrder(row.id, event.target.value, priority)');
  });

  test('uses compact primary actions with an overflow menu for secondary model actions', () => {
    const source = readSource('ModelListPage.jsx');

    expect(source).toContain('<DropdownMenu>');
    expect(source).toContain('<MoreHorizontal className=');
    expect(source).toContain("{t('更多操作')}");
    expect(source).toContain("{t('删除模型')}");
  });
});
