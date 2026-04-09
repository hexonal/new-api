import React from 'react';
import ActionCard from './ActionCard';
import useSettingsOptions from './useSettingsOptions';

const CARDS = [
  {
    title: '磁盘缓存',
    optionKey: 'aurora.performance.disk_cache.action',
    description: '刷新磁盘缓存与索引元数据。',
  },
  {
    title: 'Force GC',
    optionKey: 'aurora.performance.force_gc.action',
    description: '触发后端垃圾回收。',
  },
  {
    title: 'Reset Stats',
    optionKey: 'aurora.performance.reset_stats.action',
    description: '重置监控统计窗口。',
  },
];

export default function PerformanceTab() {
  const { saveOptions } = useSettingsOptions();

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {CARDS.map((card) => (
        <ActionCard
          key={card.optionKey}
          title={card.title}
          description={card.description}
          optionKey={card.optionKey}
          saveOptions={saveOptions}
        />
      ))}
    </div>
  );
}
