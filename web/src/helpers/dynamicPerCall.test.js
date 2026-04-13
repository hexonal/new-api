import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDynamicPerCallPrice,
  buildDynamicPerCallFormula,
} from './dynamicPerCall.js';

test('calculateDynamicPerCallPrice returns final price for PixVerse-style ratios', () => {
  const result = calculateDynamicPerCallPrice({
    modelPrice: 0.025,
    groupRatio: 1,
    otherRatios: {
      duration: 5,
      resolution: 1.4,
      audio: 9 / 7,
    },
  });

  assert.equal(result.basePrice, 0.025);
  assert.equal(result.finalPrice, 0.225);
});

test('buildDynamicPerCallFormula includes dynamic factors and final price', () => {
  const formula = buildDynamicPerCallFormula({
    basePrice: 0.025,
    finalPrice: 0.225,
    groupRatio: 1,
    otherRatios: {
      duration: 5,
      resolution: 1.4,
      audio: 9 / 7,
    },
  });

  assert.equal(
    formula,
    '基础单价 $0.025000 / 次 * duration 5.00 * resolution 1.40 * audio 1.29 * 分组倍率 1.0000 = $0.225000',
  );
});

test('quality multiplier is treated as a dynamic per-call ratio', () => {
  const result = calculateDynamicPerCallPrice({
    modelPrice: 0.16,
    groupRatio: 1,
    otherRatios: {
      duration: 5,
      quality: 1.5,
    },
  });

  assert.equal(result.finalPrice, 1.2);
});

test('zero group ratio keeps dynamic per-call preview free', () => {
  const result = calculateDynamicPerCallPrice({
    modelPrice: 0.025,
    groupRatio: 0,
    otherRatios: {
      duration: 5,
      resolution: 1.4,
      audio: 9 / 7,
    },
  });

  assert.equal(result.groupRatio, 0);
  assert.equal(result.finalPrice, 0);

  const formula = buildDynamicPerCallFormula({
    basePrice: result.basePrice,
    finalPrice: result.finalPrice,
    groupRatio: result.groupRatio,
    otherRatios: {
      duration: 5,
      resolution: 1.4,
      audio: 9 / 7,
    },
  });

  assert.equal(
    formula,
    '基础单价 $0.025000 / 次 * duration 5.00 * resolution 1.40 * audio 1.29 * 分组倍率 0.0000 = $0.000000',
  );
});
