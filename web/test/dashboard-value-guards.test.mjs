import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeDashboardDisplayValue,
  sanitizeDashboardMetricNumber,
} from '../src/aurora/pages/console/dashboard/dashboard-value-guards.js';

test('sanitizeDashboardDisplayValue replaces invalid placeholders with em dash', () => {
  assert.equal(sanitizeDashboardDisplayValue(Number.NaN), '—');
  assert.equal(sanitizeDashboardDisplayValue('NaN'), '—');
  assert.equal(sanitizeDashboardDisplayValue(' N/A '), '—');
  assert.equal(sanitizeDashboardDisplayValue('NA'), '—');
  assert.equal(sanitizeDashboardDisplayValue(null), '—');
});

test('sanitizeDashboardDisplayValue preserves valid business values', () => {
  assert.equal(sanitizeDashboardDisplayValue('$42.72'), '$42.72');
  assert.equal(sanitizeDashboardDisplayValue(12951), 12951);
});

test('sanitizeDashboardMetricNumber coerces invalid chart values to zero', () => {
  assert.equal(sanitizeDashboardMetricNumber(Number.NaN), 0);
  assert.equal(sanitizeDashboardMetricNumber('NaN'), 0);
  assert.equal(sanitizeDashboardMetricNumber('N/A'), 0);
  assert.equal(sanitizeDashboardMetricNumber(undefined), 0);
  assert.equal(sanitizeDashboardMetricNumber('42.72'), 42.72);
});
