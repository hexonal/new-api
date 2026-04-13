import assert from 'node:assert/strict';
import test from 'node:test';

import { filterExistingTokenIds } from '../src/aurora/pages/console/token-list-utils.js';

test('filterExistingTokenIds keeps the same array reference when nothing is removed', () => {
  const ids = [1, 2, 3];
  const result = filterExistingTokenIds(ids, [{ id: 1 }, { id: 2 }, { id: 3 }]);

  assert.equal(result, ids);
});

test('filterExistingTokenIds removes ids missing from current token rows', () => {
  const ids = [1, 2, 3];
  const result = filterExistingTokenIds(ids, [{ id: 2 }, { id: 3 }, { id: 4 }]);

  assert.deepEqual(result, [2, 3]);
});
