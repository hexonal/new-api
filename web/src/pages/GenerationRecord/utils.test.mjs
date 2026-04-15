import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatGenerationRecordId,
  formatGenerationTaskId,
  formatTokenCount,
} from './utils.js';

test('formatGenerationRecordId displays the stable record primary key', () => {
  assert.equal(formatGenerationRecordId(27), '#27');
  assert.equal(formatGenerationRecordId('26'), '#26');
});

test('formatGenerationTaskId does not fake task id for sync success records', () => {
  assert.equal(formatGenerationTaskId({ id: 27, task_id: '' }), '-');
  assert.equal(
    formatGenerationTaskId({ id: 25, task_id: 'task_R5gHGsTJzNHY' }),
    'task_R5gHGsTJzNHY',
  );
});

test('formatTokenCount keeps zero visible instead of treating it as missing', () => {
  assert.equal(formatTokenCount(0), 0);
  assert.equal(formatTokenCount(undefined), '-');
});
