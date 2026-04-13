import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDynamicPerCallPrice,
  buildDynamicPerCallFormula,
  buildDynamicPerCallParameterText,
  calculateFixedPerCallPrice,
  buildFixedPerCallFormula,
  getBillingSKU,
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
    '基础单价 $0.025000 / 次 * (duration 5.00 * resolution 1.40 * audio 1.285714) * 分组倍率 1.0000 = $0.225000',
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
    '基础单价 $0.025000 / 次 * (duration 5.00 * resolution 1.40 * audio 1.285714) * 分组倍率 0.0000 = $0.000000',
  );
});

test('buildDynamicPerCallParameterText keeps higher precision for repeating ratios', () => {
  const text = buildDynamicPerCallParameterText({
    duration: 5,
    resolution: 1.4,
    audio: 9 / 7,
  });

  assert.equal(text, 'duration=5.00, resolution=1.40, audio=1.285714');
});

test('getBillingSKU trims configured sku', () => {
  assert.equal(
    getBillingSKU({ billing_sku: ' MiniMax-Hailuo-2.3-Fast-6s-1080p ' }),
    'MiniMax-Hailuo-2.3-Fast-6s-1080p',
  );
});

test('calculateFixedPerCallPrice returns sku unit price and grouped final price', () => {
  const result = calculateFixedPerCallPrice({
    modelPrice: 0.3397058824,
    groupRatio: 1,
  });

  assert.equal(result.unitPrice, 0.3397058824);
  assert.equal(result.finalPrice, 0.3397058824);
});

test('buildFixedPerCallFormula renders fixed sku billing formula', () => {
  const formula = buildFixedPerCallFormula({
    unitPrice: 0.3397058824,
    finalPrice: 0.3397058824,
    groupRatio: 1,
  });

  assert.equal(
    formula,
    '(模型单价 $0.339706 / 次) * 分组倍率 1.0000 = $0.339706',
  );
});
