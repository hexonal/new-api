import React from 'react';
import OptionCard from './OptionCard';
import useSettingsOptions from './useSettingsOptions';

const CARDS = [
  { title: 'Basic Config', prefix: 'aurora.general.basic_config' },
  { title: 'Quota', prefix: 'aurora.general.quota' },
  { title: 'Nav', prefix: 'aurora.general.nav' },
  { title: 'Sidebar', prefix: 'aurora.general.sidebar' },
  { title: 'Filtering', prefix: 'aurora.general.filtering' },
  { title: 'Checkin', prefix: 'aurora.general.checkin' },
  { title: 'Logging', prefix: 'aurora.general.logging' },
  { title: 'Affinity', prefix: 'aurora.general.affinity' },
];

export default function GeneralTab() {
  const { options, saveOptions } = useSettingsOptions();

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {CARDS.map((card) => (
        <OptionCard
          key={card.prefix}
          title={card.title}
          description='Aurora General 设置项'
          optionPrefix={card.prefix}
          options={options}
          saveOptions={saveOptions}
        />
      ))}
    </div>
  );
}
