import React from 'react';
import { SubscriptionPlanTable, ActiveSubscriptionTable } from './components';

export default function SubscriptionPage() {
  return (
    <div className='space-y-4'>
      <SubscriptionPlanTable />
      <ActiveSubscriptionTable />
    </div>
  );
}
