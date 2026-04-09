import React from 'react';
import { useTranslation } from 'react-i18next';
import OptionCard from './OptionCard';
import useSettingsOptions from './useSettingsOptions';

const CARDS = [
  { title: 'Global', prefix: 'aurora.model.global' },
  { title: 'Claude', prefix: 'aurora.model.claude' },
  { title: 'Gemini', prefix: 'aurora.model.gemini' },
  { title: 'Grok', prefix: 'aurora.model.grok' },
];

export default function ModelTab() {
  const { t } = useTranslation();
  const { options, saveOptions } = useSettingsOptions();

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {CARDS.map((card) => (
        <OptionCard
          key={card.prefix}
          title={card.title}
          description={t('模型级策略参数')}
          optionPrefix={card.prefix}
          options={options}
          saveOptions={saveOptions}
        />
      ))}
    </div>
  );
}
