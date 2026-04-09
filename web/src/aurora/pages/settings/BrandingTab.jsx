import React from 'react';
import OptionCard from './OptionCard';
import useSettingsOptions from './useSettingsOptions';

const CARDS = [
  { title: 'Announcements', prefix: 'aurora.branding.announcements' },
  { title: 'API Info', prefix: 'aurora.branding.api_info' },
  { title: 'FAQ', prefix: 'aurora.branding.faq' },
  { title: 'Identity', prefix: 'aurora.branding.identity' },
];

export default function BrandingTab() {
  const { options, saveOptions } = useSettingsOptions();

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {CARDS.map((card) => (
        <OptionCard
          key={card.prefix}
          title={card.title}
          description='品牌与展示文案配置'
          optionPrefix={card.prefix}
          options={options}
          saveOptions={saveOptions}
        />
      ))}
    </div>
  );
}
