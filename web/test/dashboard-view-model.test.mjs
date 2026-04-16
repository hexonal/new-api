import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDashboardHighlightCards,
  buildDashboardSupportPanels,
} from '../src/aurora/pages/console/dashboard/dashboard-view-model.js';

test('buildDashboardHighlightCards maps legacy business metrics into stitch card order', () => {
  const groupedStatsData = [
    {
      items: [
        { title: '当前余额', value: '$100.00' },
        { title: '历史消耗', value: '$25.00' },
      ],
    },
    {
      items: [
        { title: '请求次数', value: 321 },
        { title: '统计次数', value: 123 },
      ],
    },
    {
      items: [
        { title: '统计额度', value: '$18.20' },
        { title: '统计Tokens', value: '99,000' },
      ],
    },
    {
      items: [
        { title: '平均RPM', value: '16.3' },
        { title: '平均TPM', value: '101.2' },
      ],
    },
  ];

  const cards = buildDashboardHighlightCards(groupedStatsData);

  assert.equal(cards.length, 4);
  assert.deepEqual(
    cards.map((card) => card.metricKey),
    ['balance', 'requests', 'usage', 'rate'],
  );
  assert.deepEqual(
    cards.map((card) => card.value),
    ['$100.00', 321, '$18.20', '16.3'],
  );
});

test('buildDashboardHighlightCards shields the dashboard from NaN and NA placeholders', () => {
  const groupedStatsData = [
    { items: [{ title: '当前余额', value: Number.NaN }] },
    { items: [{ title: '请求次数', value: 'N/A' }] },
    { items: [{ title: '统计额度', value: 'NA' }] },
    { items: [{ title: '平均RPM', value: null }] },
  ];

  const cards = buildDashboardHighlightCards(groupedStatsData);

  assert.deepEqual(
    cards.map((card) => card.value),
    ['—', '—', '—', '—'],
  );
});

test('buildDashboardSupportPanels keeps stitch primary layout while preserving announcement and health logic', () => {
  const panels = buildDashboardSupportPanels({
    apiInfoItems: [{ route: 'Main API', url: 'https://api.example.com' }],
    faqItems: [{ question: 'Q1', answer: 'A1' }],
    announcementItems: [],
    uptimeItems: [{ categoryName: 'Core', monitors: [{ name: 'api-1', status: 1 }] }],
    t: (value) => value,
  });

  assert.deepEqual(
    panels.map((panel) => panel.id),
    ['api-endpoints', 'quick-faq', 'announcement-center'],
  );
  assert.equal(panels[2].defaultView, 'announcements');
  assert.deepEqual(panels[2].availableViews, ['announcements', 'health']);
  assert.equal(panels[2].emptyTitle, '暂无系统公告');
});
