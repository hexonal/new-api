/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import {
  sanitizeDashboardDisplayValue,
} from './dashboard-value-guards.js';

const HIGHLIGHT_CARD_SLOTS = [
  { metricKey: 'balance', groupIndex: 0, itemIndex: 0, badgeText: 'Live' },
  { metricKey: 'requests', groupIndex: 1, itemIndex: 0, badgeText: 'Total' },
  { metricKey: 'usage', groupIndex: 2, itemIndex: 0, badgeText: 'Tracked' },
  { metricKey: 'rate', groupIndex: 3, itemIndex: 0, badgeText: 'Avg' },
];

const getMetricValue = (groupedStatsData, groupIndex, itemIndex) =>
  groupedStatsData?.[groupIndex]?.items?.[itemIndex] || {};

/**
 * 将旧版 dashboard 的统计数据映射到 Stitch 风格的四张高亮卡片。
 * @param {Array<{items?: Array<{title?: string, value?: unknown}>}>} groupedStatsData
 * @returns {Array<{metricKey: string, title: string, value: unknown, badgeText: string}>}
 */
export function buildDashboardHighlightCards(groupedStatsData = []) {
  return HIGHLIGHT_CARD_SLOTS.map((slot) => {
    const item = getMetricValue(
      groupedStatsData,
      slot.groupIndex,
      slot.itemIndex,
    );

    return {
      metricKey: slot.metricKey,
      title: item.title || '',
      value: sanitizeDashboardDisplayValue(item.value),
      badgeText: slot.badgeText,
    };
  });
}

/**
 * 构建 dashboard 底部三栏结构，同时保留公告与健康度两类业务能力。
 * @param {{
 *   apiInfoItems?: unknown[],
 *   faqItems?: unknown[],
 *   announcementItems?: unknown[],
 *   uptimeItems?: unknown[],
 *   t?: (value: string) => string,
 * }} params
 * @returns {Array<object>}
 */
export function buildDashboardSupportPanels({
  apiInfoItems = [],
  faqItems = [],
  announcementItems = [],
  uptimeItems = [],
  t = (value) => value,
} = {}) {
  return [
    {
      id: 'api-endpoints',
      items: apiInfoItems,
    },
    {
      id: 'quick-faq',
      items: faqItems,
    },
    {
      id: 'announcement-center',
      announcementItems,
      uptimeItems,
      defaultView: 'announcements',
      availableViews: ['announcements', 'health'],
      emptyTitle: t('暂无系统公告'),
      emptyDescription: t('系统通知与关键更新会显示在这里'),
    },
  ];
}
