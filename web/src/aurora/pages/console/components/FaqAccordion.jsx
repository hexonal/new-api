import React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../../../primitives/accordion';

const FaqAccordion = ({ items = [], t = (value) => value }) => (
  <div className='rounded-xl border border-border bg-card p-4'>
    <h2 className='text-sm font-medium mb-3'>{t('常见问题')}</h2>
    {items.length === 0 ? (
      <p className='text-sm text-muted-foreground'>{t('暂无常见问题')}</p>
    ) : (
      <Accordion type='multiple' className='w-full'>
        {items.map((item, index) => (
          <AccordionItem key={item?.title || item?.question || index} value={`${index}`}>
            <AccordionTrigger>
              <span className='text-sm font-medium'>
                {item?.question || item?.title || '-'}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className='text-sm text-muted-foreground'>
                {item?.answer || item?.description || '-'}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )}
  </div>
);

export default FaqAccordion;
