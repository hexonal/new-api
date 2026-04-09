import React from 'react';
import OptionCard from './OptionCard';
import useSettingsOptions from './useSettingsOptions';

const CARDS = [
  { title: 'Registration', prefix: 'aurora.auth.registration' },
  { title: 'SMTP', prefix: 'aurora.auth.smtp' },
  { title: 'OAuth grid', prefix: 'aurora.auth.oauth_grid' },
  { title: 'Custom OAuth', prefix: 'aurora.auth.custom_oauth' },
];

export default function AuthTab() {
  const { options, saveOptions } = useSettingsOptions();

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {CARDS.map((card) => (
        <OptionCard
          key={card.prefix}
          title={card.title}
          description='认证相关配置'
          optionPrefix={card.prefix}
          options={options}
          saveOptions={saveOptions}
        />
      ))}
    </div>
  );
}
