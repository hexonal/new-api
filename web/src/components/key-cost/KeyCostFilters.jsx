import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import KeySelector from './shared/KeySelector';
import TimeRangeBar from './shared/TimeRangeBar';

const KeyCostFilters = ({
  tokens,
  selectedTokenId,
  onTokenChange,
  granularity,
  onGranularityChange,
  granularityOptions,
  dateRange,
  onDateRangeChange,
  onRefresh,
  loading,
  t,
}) => {
  return (
    <div className='flex items-center justify-between flex-wrap gap-3 mb-4'>
      <div className='flex items-center gap-3 flex-wrap'>
        <KeySelector
          tokens={tokens}
          value={selectedTokenId}
          onChange={onTokenChange}
          placeholder={t('全部 Key')}
          t={t}
        />
        <TimeRangeBar
          granularity={granularity}
          onGranularityChange={onGranularityChange}
          granularityOptions={granularityOptions}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          t={t}
        />
      </div>
      <Button
        icon={<IconRefresh />}
        onClick={onRefresh}
        loading={loading}
        theme='light'
      >
        {t('刷新')}
      </Button>
    </div>
  );
};

export default KeyCostFilters;
