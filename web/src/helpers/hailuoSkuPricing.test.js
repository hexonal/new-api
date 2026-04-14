import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHailuoSkuPricingRows,
  getHailuoStartingPrice,
} from './hailuoSkuPricing.js';

test('getHailuoStartingPrice uses the cheapest configured sku with base model ratio fallback', () => {
  const result = getHailuoStartingPrice({
    record: {
      model_name: 'MiniMax-Hailuo-02',
      sku_prices: [
        {
          sku: 'MiniMax-Hailuo-02-6s-512p',
          duration: 6,
          resolution: '512p',
          official_points: 0.3,
          model_price: 0.088235,
        },
        {
          sku: 'MiniMax-Hailuo-02-6s-1080p',
          duration: 6,
          resolution: '1080p',
          official_points: 2,
          model_price: 0.588236,
        },
      ],
    },
    selectedGroup: 'shizeing3',
    groupRatio: { shizeing3: 3 },
    groupModelRatio: {
      shizeing3: {
        'MiniMax-Hailuo-02': 1.1,
      },
    },
  });

  assert.equal(result.sku, 'MiniMax-Hailuo-02-6s-512p');
  assert.equal(result.groupRatio, 1.1);
  assert.equal(result.unitPrice, 0.088235);
  assert.equal(result.finalPrice, 0.0970585);
});

test('getHailuoStartingPrice scans all enabled groups when selectedGroup is all', () => {
  const result = getHailuoStartingPrice({
    record: {
      model_name: 'MiniMax-Hailuo-2.3-Fast',
      enable_groups: ['pro', 'vip'],
      sku_prices: [
        {
          sku: 'MiniMax-Hailuo-2.3-Fast-6s-768p',
          duration: 6,
          resolution: '768p',
          official_points: 0.7,
          model_price: 0.205883,
        },
      ],
    },
    selectedGroup: 'all',
    groupRatio: { pro: 1.2, vip: 1.5, hidden: 0.1 },
    groupModelRatio: {
      pro: {
        'MiniMax-Hailuo-2.3-Fast': 0.9,
      },
      vip: {
        'MiniMax-Hailuo-2.3-Fast-6s-768p': 0.5,
      },
      hidden: {
        'MiniMax-Hailuo-2.3-Fast-6s-768p': 0.2,
      },
    },
  });

  assert.equal(result.usedGroup, 'vip');
  assert.equal(result.groupRatio, 0.5);
  assert.ok(Math.abs(result.finalPrice - 0.1029415) < 1e-9);
});

test('buildHailuoSkuPricingRows prefers sku-specific group ratio over base model ratio', () => {
  const rows = buildHailuoSkuPricingRows({
    record: {
      model_name: 'MiniMax-Hailuo-2.3-Fast',
      sku_prices: [
        {
          sku: 'MiniMax-Hailuo-2.3-Fast-6s-768p',
          duration: 6,
          resolution: '768p',
          official_points: 0.7,
          model_price: 0.205883,
        },
        {
          sku: 'MiniMax-Hailuo-2.3-Fast-6s-1080p',
          duration: 6,
          resolution: '1080p',
          official_points: 1.3,
          model_price: 0.382353,
        },
      ],
    },
    selectedGroup: 'vip',
    groupRatio: { vip: 2 },
    groupModelRatio: {
      vip: {
        'MiniMax-Hailuo-2.3-Fast': 0.8,
        'MiniMax-Hailuo-2.3-Fast-6s-1080p': 0.5,
      },
    },
  });

  assert.equal(rows[0].groupRatio, 0.8);
  assert.ok(Math.abs(rows[0].finalPrice - 0.1647064) < 1e-9);
  assert.equal(rows[1].groupRatio, 0.5);
  assert.ok(Math.abs(rows[1].finalPrice - 0.1911765) < 1e-9);
});
