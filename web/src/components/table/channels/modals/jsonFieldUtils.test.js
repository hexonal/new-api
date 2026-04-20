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

import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLoadedJsonObjectString } from './jsonFieldUtils.js';

test('normalizeLoadedJsonObjectString strips null-like values for JSON editors', () => {
  assert.equal(normalizeLoadedJsonObjectString(null), '');
  assert.equal(normalizeLoadedJsonObjectString(undefined), '');
  assert.equal(normalizeLoadedJsonObjectString(''), '');
  assert.equal(normalizeLoadedJsonObjectString('null'), '');
});

test('normalizeLoadedJsonObjectString prettifies valid object json', () => {
  assert.equal(
    normalizeLoadedJsonObjectString('{"gpt-4o":"gpt-4o-mini"}'),
    '{\n  "gpt-4o": "gpt-4o-mini"\n}',
  );
});

test('normalizeLoadedJsonObjectString preserves invalid raw text for debugging', () => {
  assert.equal(normalizeLoadedJsonObjectString('{bad json}'), '{bad json}');
});
