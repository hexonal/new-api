import React from 'react';
import OptionCard from './OptionCard';
import useSettingsOptions from './useSettingsOptions';

const CARDS = [
  { title: '渠道监控', prefix: 'aurora.monitoring.channel' },
  { title: 'UptimeKuma', prefix: 'aurora.monitoring.uptime_kuma' },
  { title: 'Dashboard', prefix: 'aurora.monitoring.dashboard' },
];

export default function MonitoringTab() {
  const { options, saveOptions } = useSettingsOptions();

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {CARDS.map((card) => (
        <OptionCard
          key={card.prefix}
          title={card.title}
          description='监控与可观测性配置'
          optionPrefix={card.prefix}
          options={options}
          saveOptions={saveOptions}
        />
      ))}
    </div>
  );
}
