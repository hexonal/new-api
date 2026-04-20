import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildImaProBillingLines,
  parseImaProBillingSku,
  resolveImaProBillingInfo,
} from './imaProBillingLog.js';

test('parseImaProBillingSku extracts mode and resolution from ima-pro sku', () => {
  assert.deepEqual(parseImaProBillingSku('ima-pro-novideo-720p'), {
    inputMode: 'novideo',
    resolutionBucket: '720p',
  });
  assert.deepEqual(parseImaProBillingSku('ima-pro-fast-withvideo-1080p'), {
    inputMode: 'withvideo',
    resolutionBucket: '1080p',
  });
});

test('resolveImaProBillingInfo supports old logs without rate_per_m and mode fields', () => {
  const info = resolveImaProBillingInfo({
    billing_sku: 'ima-pro-novideo-720p',
    model_ratio: 3.5,
    group_ratio: 0.8,
  });

  assert.equal(info.sku, 'ima-pro-novideo-720p');
  assert.equal(info.inputMode, 'novideo');
  assert.equal(info.resolutionBucket, '720p');
  assert.equal(info.ratePerM, 7);
  assert.equal(info.groupRatio, 0.8);
});

test('buildImaProBillingLines renders video-specific formula without LLM input/completion labels', () => {
  const lines = buildImaProBillingLines({
    other: {
      billing_sku: 'ima-pro-novideo-720p',
      model_ratio: 3.5,
      group_ratio: 0.8,
    },
    totalTokens: 87300,
    finalCostText: '$0.488880',
    formatTokenCount: (value) => (value === 87300 ? '87.3k' : String(value)),
  });

  const text = lines.join('\n');
  assert.match(text, /计费 SKU：ima-pro-novideo-720p/);
  assert.match(text, /计费档位：无参考视频 \/ 720p/);
  assert.match(text, /SKU 单价：\$7\.000000 \/ 1M tokens/);
  assert.match(
    text,
    /计费公式：\(87\.3k tokens \/ 1M \* \$7\.000000\) \* 分组倍率（模型覆盖） 0\.8000 = \$0\.488880/,
  );
  assert.doesNotMatch(text, /输入价格/);
  assert.doesNotMatch(text, /补全价格/);
});
