import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeChartContainerRect,
  hasRenderableChartSize,
} from '../src/aurora/pages/console/components/chart-container-utils.js';

test('normalizeChartContainerRect marks zero or negative dimensions as not ready', () => {
  assert.deepEqual(normalizeChartContainerRect({ width: -1, height: -1 }), {
    width: 0,
    height: 0,
    ready: false,
  });

  assert.deepEqual(normalizeChartContainerRect({ width: 320, height: 0 }), {
    width: 320,
    height: 0,
    ready: false,
  });
});

test('normalizeChartContainerRect keeps positive integer dimensions and marks ready', () => {
  assert.deepEqual(
    normalizeChartContainerRect({ width: 320.8, height: 280.2 }),
    {
      width: 320,
      height: 280,
      ready: true,
    },
  );
});

test('hasRenderableChartSize only accepts positive width and height', () => {
  assert.equal(hasRenderableChartSize({ width: 0, height: 280 }), false);
  assert.equal(hasRenderableChartSize({ width: 320, height: 0 }), false);
  assert.equal(hasRenderableChartSize({ width: 320, height: 280 }), true);
});
