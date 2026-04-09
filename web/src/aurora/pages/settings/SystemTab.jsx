import React from 'react';
import ActionCard from './ActionCard';
import useSettingsOptions from './useSettingsOptions';

const CARDS = [
  {
    title: '版本检查',
    optionKey: 'aurora.system.version_check.action',
    description: '检查当前版本与远端版本状态。',
  },
  {
    title: '数据迁移',
    optionKey: 'aurora.system.data_migration.action',
    description: '触发系统数据迁移流程。',
  },
];

export default function SystemTab() {
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
