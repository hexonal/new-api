import React from 'react';
import OptionCard from './OptionCard';
import useSettingsOptions from './useSettingsOptions';

export default function DrawingTab() {
  const { options, saveOptions } = useSettingsOptions();

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      <OptionCard
        title='MJ设置'
        description='Midjourney 相关参数和开关。'
        optionPrefix='aurora.drawing.mj'
        options={options}
        saveOptions={saveOptions}
      />
    </div>
  );
}
