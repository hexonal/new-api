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

const readSource = (...segments) =>
  readFileSync(join(import.meta.dir, ...segments), 'utf8');

describe('channel layout regression', () => {
  test('keeps aurora channel list page width fluid', () => {
    const source = readSource('ChannelListPage.jsx');

    expect(source).toContain("className='flex w-full flex-col gap-7");
    expect(source).not.toContain('max-w-[1680px]');
  });

  test('keeps channel route form width fluid and preserves responsive sidebar blocks', () => {
    const source = readSource(
      '..',
      '..',
      '..',
      'components',
      'table',
      'channels',
      'modals',
      'EditChannelModal.jsx',
    );

    expect(source).toContain("className='relative mx-auto flex w-full flex-col");
    expect(source).not.toContain('max-w-[1760px]');
    expect(source).not.toContain('max-w-[1680px]');
    expect(source).toContain('sm:grid-cols-2 xl:grid-cols-1');
    expect(source).toContain('grid gap-3 pt-1 sm:grid-cols-2');
  });

  test('keeps channel table horizontally scrollable on smaller screens', () => {
    const source = readSource('channel-page', 'ChannelDataTable.jsx');

    expect(source).toContain("className='overflow-x-auto'");
    expect(source).toContain("className='min-w-[720px] table-fixed");
    expect(source).toContain('overflow-x-auto pb-1');
  });
});
