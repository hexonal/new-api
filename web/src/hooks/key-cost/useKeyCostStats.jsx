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
      totalQuota += item.total_quota || 0;
      totalRequests += item.request_count || 0;
      totalPromptTokens += item.prompt_tokens || 0;
      totalCompletionTokens += item.completion_tokens || 0;
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
