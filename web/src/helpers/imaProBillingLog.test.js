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
  assert.deepEqual(parseImaProBillingSku('ima-pro-novideo-480p'), {
    inputMode: 'novideo',
    resolutionBucket: '480p',
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
  assert.equal(info.modelRatio, 3.5);
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
    billedQuota: 244440,
    quotaPerUnit: 500000,
    finalCostText: '$0.488880',
  });

  const text = lines.join('\n');
  assert.match(text, /计费 SKU：ima-pro-novideo-720p/);
  assert.match(text, /计费档位：无参考视频 \/ 720p/);
  assert.match(text, /计费 Tokens：87,300/);
  assert.match(text, /SKU 单价：\$7\.000000 \/ 1M tokens/);
  assert.match(
    text,
    /计费公式：\(87,300 tokens \* SKU倍率 3\.500000 \* 分组倍率（模型覆盖） 0\.8000\) = 244,440 quota；\(244,440 quota \/ 500,000 quota\/USD\) = \$0\.488880/,
  );
  assert.doesNotMatch(text, /87\.3k tokens \/ 1M/);
  assert.doesNotMatch(text, /输入价格/);
  assert.doesNotMatch(text, /补全价格/);
});

test('buildImaProBillingLines uses exact token count for 1080p sku formula', () => {
  const lines = buildImaProBillingLines({
    other: {
      billing_sku: 'ima-pro-novideo-1080p',
      model_ratio: 3.85,
      group_ratio: 0.8,
      rate_per_m: 7.7,
    },
    totalTokens: 245025,
    billedQuota: 754677,
    quotaPerUnit: 500000,
    finalCostText: '$1.509354',
  });

  const text = lines.join('\n');
  assert.match(text, /计费 SKU：ima-pro-novideo-1080p/);
  assert.match(text, /SKU 单价：\$7\.700000 \/ 1M tokens/);
  assert.match(
    text,
    /计费公式：\(245,025 tokens \* SKU倍率 3\.850000 \* 分组倍率（模型覆盖） 0\.8000\) = 754,677 quota；\(754,677 quota \/ 500,000 quota\/USD\) = \$1\.509354/,
  );
  assert.doesNotMatch(text, /245\.0k/);
});

test('buildImaProBillingLines renders base model when sku is unconfigured fallback', () => {
  const lines = buildImaProBillingLines({
    other: {
      billing_sku: 'ima-pro-fast',
      billing_candidate_sku: 'ima-pro-fast-novideo-720p',
      model_variant: 'ima-pro-fast-novideo-720p',
      input_mode: 'novideo',
      resolution_bucket: '720p',
      model_ratio: 2.815217,
      group_ratio: 0.8,
      used_fallback: true,
    },
    totalTokens: 87300,
    billedQuota: 196614,
    quotaPerUnit: 500000,
    finalCostText: '$0.393228',
  });

  const text = lines.join('\n');
  assert.match(text, /计费模型：ima-pro-fast/);
  assert.match(text, /候选 SKU（未配置）：ima-pro-fast-novideo-720p/);
  assert.match(text, /计费档位：无参考视频 \/ 720p/);
  assert.match(text, /SKU 单价：\$5\.630434 \/ 1M tokens/);
  assert.match(text, /计费提示：SKU 未配置，已按计费模型基础价格结算/);
  assert.doesNotMatch(text, /计费 SKU：ima-pro-fast-novideo-720p/);
});
