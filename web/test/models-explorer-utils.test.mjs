import assert from 'node:assert/strict';
import test from 'node:test';

import { buildModelBadges } from '../src/aurora/pages/public/models-explorer-utils.js';

test('buildModelBadges removes duplicate tag values across billing, tags and endpoint types', () => {
  const result = buildModelBadges({
    billingLabel: '按量计费',
    tags: ['midjourney', 'image', 'midjourney'],
    endpointTypes: ['midjourney', 'mj_blend', 'midjourney'],
  });

  assert.deepEqual(result, ['按量计费', 'midjourney', 'image', 'mj_blend']);
});

test('buildModelBadges normalizes whitespace-only values and preserves first occurrence order', () => {
  const result = buildModelBadges({
    billingLabel: '  ',
    tags: [' foo ', '', 'bar'],
    endpointTypes: ['foo', 'baz'],
  });

  assert.deepEqual(result, ['foo', 'bar', 'baz']);
});
