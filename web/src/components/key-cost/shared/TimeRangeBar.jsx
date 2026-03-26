import React from 'react';
import { DatePicker, RadioGroup, Radio } from '@douyinfe/semi-ui';

const TimeRangeBar = ({
  granularity,
  onGranularityChange,
  granularityOptions,
  dateRange,
  onDateRangeChange,
  t,
}) => {
  return (
    <div className='flex items-center gap-3 flex-wrap'>
      <RadioGroup
        type='button'
        buttonSize='small'
        value={granularity}
        onChange={(e) => onGranularityChange(e.target.value)}
      >
        {granularityOptions.map((opt) => (
          <Radio key={opt.value} value={opt.value}>
            {opt.label}
          </Radio>
        ))}
      </RadioGroup>

      <DatePicker
        type='dateRange'
        density='compact'
        value={dateRange}
        onChange={onDateRangeChange}
        style={{ width: 260 }}
      />
    </div>
  );
};

export default TimeRangeBar;
