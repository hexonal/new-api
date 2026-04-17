import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChannelSummaryCards,
  buildChannelStatusMeta,
  sanitizeChannelMetricValue,
} from '../src/aurora/pages/admin/channel-page/channel-view-model.js';

test('sanitizeChannelMetricValue 屏蔽 NaN 和 NA 占位错误', () => {
  assert.equal(sanitizeChannelMetricValue(Number.NaN), '—');
  assert.equal(sanitizeChannelMetricValue('NaN'), '—');
  assert.equal(sanitizeChannelMetricValue('NA'), '—');
  assert.equal(sanitizeChannelMetricValue('N/A'), '—');
  assert.equal(sanitizeChannelMetricValue(undefined), '—');
  assert.equal(sanitizeChannelMetricValue(null), '—');
  assert.equal(sanitizeChannelMetricValue('  12.4s  '), '12.4s');
});

test('buildChannelSummaryCards 输出 Stitch 所需统计卡片并避免空值污染', () => {
  const cards = buildChannelSummaryCards({
    channels: [
      { id: 1, status: 1, response_time: 800, balance: 12.5 },
      { id: 2, status: 2, response_time: 0, balance: 'NA' },
      { id: 3, status: 1, response_time: 1200, balance: 3.25 },
    ],
    t: (value) => value,
  });

  assert.deepEqual(
    cards.map((card) => card.id),
    ['health', 'balance', 'latency'],
  );
  assert.equal(cards[0].value, '2 / 3');
  assert.equal(cards[1].value, '$15.75');
  assert.equal(cards[2].value, '1.00 秒');
});

test('buildChannelSummaryCards 在无有效数值时不返回 NaN 或 NA', () => {
  const cards = buildChannelSummaryCards({
    channels: [
      { id: 1, status: 2, response_time: Number.NaN, balance: 'N/A' },
      { id: 2, status: 3, response_time: null, balance: undefined },
    ],
    t: (value) => value,
  });

  assert.deepEqual(
    cards.map((card) => card.value),
    ['0 / 2', '—', '—'],
  );
});

test('buildChannelStatusMeta 保留旧版多密钥状态语义', () => {
  const enabled = buildChannelStatusMeta({
    status: 1,
    channel_info: {
      is_multi_key: true,
      multi_key_size: 3,
      multi_key_status_list: {
        a: 2,
      },
    },
    t: (value) => value,
  });

  assert.equal(enabled.label, '已启用');
  assert.equal(enabled.detail, '2/3');

  const disabled = buildChannelStatusMeta({
    status: 2,
    channel_info: undefined,
    t: (value) => value,
  });

  assert.equal(disabled.label, '已禁用');
  assert.equal(disabled.detail, '');
});
