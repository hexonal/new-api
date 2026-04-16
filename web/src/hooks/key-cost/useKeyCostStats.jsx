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
import { useMemo } from 'react';
import {
  IconCoinMoneyStroked,
  IconSend,
  IconTextStroked,
  IconHistogram,
} from '@douyinfe/semi-icons';
import { quotaToNumeric, formatQuotaDisplay } from '../../helpers/key-cost';

/**
 * Compute the four stat-card values for the Key Cost Analysis dashboard.
 *
 * @param {Array} summaryData - TokenSummary records (already filtered by selected token if needed).
 * @param {Function} t - i18next translation function.
 * @returns {{ statsData: Array }}
 */
export const useKeyCostStats = (summaryData, t) => {
  const statsData = useMemo(() => {
    let totalQuota = 0;
    let totalRequests = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    const safeData = Array.isArray(summaryData) ? summaryData : [];
    for (const item of safeData) {
      totalQuota += Number(item.total_quota ?? 0) || 0;
      totalRequests += Number(item.request_count ?? 0) || 0;
      totalPromptTokens += Number(item.prompt_tokens ?? 0) || 0;
      totalCompletionTokens += Number(item.completion_tokens ?? 0) || 0;
    }

    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const totalCostUSD = quotaToNumeric(totalQuota);
    const avgCostUSD =
      totalRequests > 0 ? quotaToNumeric(totalQuota / totalRequests) : 0;

    return [
      {
        title: t('总成本'),
        value: formatQuotaDisplay(totalCostUSD),
        icon: <IconCoinMoneyStroked />,
        avatarColor: 'blue',
        change: null,
        changeType: 'neutral',
      },
      {
        title: t('请求次数'),
        value: totalRequests.toLocaleString(),
        icon: <IconSend />,
        avatarColor: 'green',
        change: null,
        changeType: 'neutral',
      },
      {
        title: t('Token 消耗'),
        value: totalTokens.toLocaleString(),
        icon: <IconTextStroked />,
        avatarColor: 'purple',
        change: null,
        changeType: 'neutral',
      },
      {
        title: t('平均单次成本'),
        value: formatQuotaDisplay(avgCostUSD, 4),
        icon: <IconHistogram />,
        avatarColor: 'orange',
        change: null,
        changeType: 'neutral',
      },
    ];
  }, [summaryData, t]);

  return { statsData };
};
