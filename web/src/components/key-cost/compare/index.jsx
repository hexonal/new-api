import React, { useState } from 'react';
import { useKeyCompareData } from '../../../hooks/key-cost/useKeyCompareData';
import { useKeyCompareCharts } from '../../../hooks/key-cost/useKeyCompareCharts';
import { useKeyCostData } from '../../../hooks/key-cost/useKeyCostData';

import KeyCompareSelector from './KeyCompareSelector';
import KeyCompareTrendPanel from './KeyCompareTrendPanel';
import KeyCompareStatsCards from './KeyCompareStatsCards';
import KeyCompareDetailTable from './KeyCompareDetailTable';
import TimeRangeBar from '../shared/TimeRangeBar';

const KeyComparePanel = () => {
  const [activeMetric, setActiveMetric] = useState('cost');

  // Re-use the cost data hook to get shared token list and granularity options
  const costData = useKeyCostData();

  const compare = useKeyCompareData();

  const { specMultiLine, compareStats } = useKeyCompareCharts(
    compare.compareData,
    activeMetric,
    compare.granularity,
    compare.t,
    costData.tokens,
  );

  return (
    <div className='h-full'>
      <div className='flex items-center justify-between flex-wrap gap-3 mb-4'>
        <TimeRangeBar
          granularity={compare.granularity}
          onGranularityChange={compare.setGranularity}
          granularityOptions={costData.granularityOptions}
          dateRange={compare.dateRange}
          onDateRangeChange={compare.setDateRange}
          t={compare.t}
        />
      </div>

      <KeyCompareSelector
        tokens={costData.tokens}
        selectedTokenIds={compare.selectedTokenIds}
        onSelectedChange={compare.setSelectedTokenIds}
        t={compare.t}
      />

      <KeyCompareStatsCards
        compareStats={compareStats}
        loading={compare.loading}
        t={compare.t}
      />

      <KeyCompareTrendPanel
        specMultiLine={specMultiLine}
        activeMetric={activeMetric}
        onMetricChange={setActiveMetric}
        t={compare.t}
      />

      <KeyCompareDetailTable
        compareStats={compareStats}
        loading={compare.loading}
        t={compare.t}
      />
    </div>
  );
};

export default KeyComparePanel;
