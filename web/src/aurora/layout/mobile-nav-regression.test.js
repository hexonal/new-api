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

describe('mobile nav regression', () => {
  test('uses one unified visual style for all quick links including pricing', () => {
    const source = readSource('MobileNav.jsx');

    expect(source).toContain('const mobileLinks = [');
    expect(source).toContain("className={`aurora-mobile-nav-link w-full justify-between ${");
    expect(source).toContain("isActive ? 'is-active' : ''");
    expect(source).not.toContain('aurora-mobile-nav-primary-btn');
    expect(source).not.toContain('aurora-mobile-nav-quick-link');
  });

  test('defines a shared mobile nav link class with an active modifier', () => {
    const source = readSource('..', 'tokens', 'globals.css');

    expect(source).toContain('.aurora-mobile-nav-link {');
    expect(source).toContain('.aurora-mobile-nav-link.is-active {');
  });
});
