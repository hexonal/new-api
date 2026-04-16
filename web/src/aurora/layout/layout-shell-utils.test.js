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
  CONSOLE_COMPACT_BREAKPOINT,
  shouldShowPageShellChrome,
  shouldUseCompactConsoleLayout,
} from './layout-shell-utils';

describe('layout-shell-utils', () => {
  test('keeps console dashboard in desktop layout at the BrowserOS viewport width', () => {
    expect(shouldUseCompactConsoleLayout(CONSOLE_COMPACT_BREAKPOINT - 1)).toBe(
      true,
    );
    expect(shouldUseCompactConsoleLayout(CONSOLE_COMPACT_BREAKPOINT)).toBe(
      false,
    );
  });

  test('hides duplicated page shell chrome on the console dashboard only', () => {
    expect(
      shouldShowPageShellChrome({
        pathname: '/console',
        showNavigationShell: true,
      }),
    ).toBe(false);
    expect(
      shouldShowPageShellChrome({
        pathname: '/console/token',
        showNavigationShell: true,
      }),
    ).toBe(true);
  });
});
