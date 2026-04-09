import React from 'react';
import OptionCard from './OptionCard';
import useSettingsOptions from './useSettingsOptions';

const CARDS = [
  { title: 'General', prefix: 'aurora.payment.general' },
  { title: 'Stripe', prefix: 'aurora.payment.stripe' },
  { title: 'Creem', prefix: 'aurora.payment.creem' },
  { title: 'EPay', prefix: 'aurora.payment.epay' },
];

export default function PaymentTab() {
  const { options, saveOptions } = useSettingsOptions();

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {CARDS.map((card) => (
        <OptionCard
          key={card.prefix}
          title={card.title}
          description='支付通道与回调配置'
          optionPrefix={card.prefix}
          options={options}
          saveOptions={saveOptions}
        />
      ))}
    </div>
  );
}
