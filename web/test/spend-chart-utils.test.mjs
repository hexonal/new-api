import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPieChartData,
  buildPieLegendItems,
  shouldRenderPieLabel,
  formatPieLabel,
} from '../src/aurora/pages/console/components/spend-chart-utils.js';

test('buildPieChartData keeps major slices and groups tiny slices into 其他', () => {
  const data = [
    { name: 'MiniMax-Hailuo-02', value: 87.9 },
    { name: 'pixverse-v6', value: 6 },
    { name: 'pixverse-c1', value: 6 },
    { name: 'tiny-a', value: 0.04 },
    { name: 'tiny-b', value: 0.03 },
    { name: 'tiny-c', value: 0.03 },
  ];

  const result = buildPieChartData(data, { minPercent: 1 });

  assert.deepEqual(result, [
    { name: 'MiniMax-Hailuo-02', value: 87.9 },
    { name: 'pixverse-v6', value: 6 },
    { name: 'pixverse-c1', value: 6 },
    { name: '其他', value: 0.1 },
  ]);
});

test('shouldRenderPieLabel hides labels for tiny percentages', () => {
  assert.equal(shouldRenderPieLabel(0.002, 1), false);
  assert.equal(shouldRenderPieLabel(0.008, 1), false);
  assert.equal(shouldRenderPieLabel(0.0101, 1), true);
});

test('formatPieLabel rounds percentage to one decimal place', () => {
  assert.equal(formatPieLabel({ name: 'pixverse-v6', percent: 0.0604 }), 'pixverse-v6 6.0%');
});

test('buildPieLegendItems includes formatted percentages for every visible slice', () => {
  const result = buildPieLegendItems([
    { name: 'MiniMax-Hailuo-02', value: 87.9 },
    { name: 'pixverse-v6', value: 6 },
    { name: 'pixverse-c1', value: 6 },
    { name: '其他', value: 0.1 },
  ]);

  assert.deepEqual(result, [
    { name: 'MiniMax-Hailuo-02', value: 87.9, percentText: '87.9%' },
    { name: 'pixverse-v6', value: 6, percentText: '6.0%' },
    { name: 'pixverse-c1', value: 6, percentText: '6.0%' },
    { name: '其他', value: 0.1, percentText: '0.1%' },
  ]);
});
