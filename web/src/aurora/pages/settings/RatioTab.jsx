import React from 'react';
import { useTranslation } from 'react-i18next';
import OptionCard from './OptionCard';
import useSettingsOptions from './useSettingsOptions';

const CARDS = [
  { title: 'Model Ratio', prefix: 'aurora.ratio.model_ratio' },
  { title: 'Group Ratio', prefix: 'aurora.ratio.group_ratio' },
  { title: 'Upstream Sync', prefix: 'aurora.ratio.upstream_sync' },
];

export default function RatioTab() {
  const { t } = useTranslation();
  const { options, saveOptions } = useSettingsOptions();

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {CARDS.map((card) => (
        <OptionCard
          key={card.prefix}
          title={card.title}
          description={t('定价与倍率配置')}
          optionPrefix={card.prefix}
          options={options}
          saveOptions={saveOptions}
        />
      ))}
    </div>
  );
}
