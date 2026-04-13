import assert from 'node:assert/strict';
import test from 'node:test';

import { MANUAL_CHUNKS } from '../vite/manual-chunks.js';

test('manual chunks keep semi-ui grouped and do not force a separate i18n chunk', () => {
  assert.deepEqual(MANUAL_CHUNKS['semi-ui'], [
    '@douyinfe/semi-icons',
    '@douyinfe/semi-ui',
  ]);
  assert.equal('i18n' in MANUAL_CHUNKS, false);
});
