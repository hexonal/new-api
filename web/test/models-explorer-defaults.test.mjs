import assert from 'node:assert/strict';
import test from 'node:test';

import { getDefaultSelectedModalities } from '../src/aurora/pages/public/models-explorer-utils.js';

test('getDefaultSelectedModalities enables all visible input types by default', () => {
  assert.deepEqual(getDefaultSelectedModalities(), [
    'text',
    'image',
    'audio',
    'video',
  ]);
});
