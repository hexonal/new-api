/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../../../primitives/accordion';

const FaqAccordion = ({ items = [], t = (value) => value }) => (
  <section className='space-y-4'>
    <div className='flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-slate-900'>
      <span className='h-1.5 w-1.5 rounded-full bg-indigo-600' />
      <h2>{t('Quick FAQ')}</h2>
    </div>
    <div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
      {items.length === 0 ? (
        <p className='text-sm text-muted-foreground'>{t('暂无常见问题')}</p>
      ) : (
        <Accordion type='multiple' className='w-full'>
          {items.map((item, index) => (
            <AccordionItem
              key={item?.title || item?.question || index}
              value={`${index}`}
            >
              <AccordionTrigger>
                <span className='text-sm font-medium text-slate-700'>
                  {item?.question || item?.title || '-'}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className='text-sm leading-6 text-slate-500'>
                  {item?.answer || item?.description || '-'}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  </section>
);

export default FaqAccordion;
