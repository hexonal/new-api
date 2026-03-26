import React from 'react';
import { useKeyCostData } from '../../hooks/key-cost/useKeyCostData';
import { useKeyCostStats } from '../../hooks/key-cost/useKeyCostStats';
import { useKeyCostCharts } from '../../hooks/key-cost/useKeyCostCharts';

import KeyCostFilters from './KeyCostFilters';
import KeyCostStatsCards from './KeyCostStatsCards';
import KeyCostTrendPanel from './KeyCostTrendPanel';
import KeyCostDistributionPanel from './KeyCostDistributionPanel';
import KeyCostDetailTable from './KeyCostDetailTable';

const KeyCostPanel = () => {
  const data = useKeyCostData();
  const { statsData } = useKeyCostStats(data.summaryData, data.t);
  const charts = useKeyCostCharts(
    data.summaryData,
    data.granularity,
    data.t,
  );

  return (
    <div className='h-full'>
      <KeyCostFilters
        tokens={data.tokens}
        selectedTokenId={data.selectedTokenId}
        onTokenChange={data.setSelectedTokenId}
        granularity={data.granularity}
        onGranularityChange={data.setGranularity}
        granularityOptions={data.granularityOptions}
        dateRange={data.dateRange}
        onDateRangeChange={data.setDateRange}
        onRefresh={data.refresh}
        loading={data.loading}
        t={data.t}
      />

      <KeyCostStatsCards statsData={statsData} loading={data.loading} />

      <KeyCostTrendPanel
        activeChartTab={data.activeChartTab}
        onChartTabChange={data.setActiveChartTab}
        specCostLine={charts.specCostLine}
        specRequestLine={charts.specRequestLine}
        specTokenLine={charts.specTokenLine}
        t={data.t}
      />

      <KeyCostDistributionPanel
        specPie={charts.specPie}
        specRankBar={charts.specRankBar}
        t={data.t}
      />

      <KeyCostDetailTable
        summaryData={data.summaryData}
        loading={data.loading}
        t={data.t}
      />
    </div>
  );
};

export default KeyCostPanel;
