/*
Copyright (C) 2025 QuantumNous
*/

import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';

const ScrollArea = ({ className, children, ...props }) => (
  <ScrollAreaPrimitive.Root className='relative overflow-hidden' {...props}>
    <ScrollAreaPrimitive.Viewport className='h-full w-full rounded'>
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar
      orientation='vertical'
      className='flex touch-none select-none transition-colors'
    >
      <ScrollAreaPrimitive.Thumb className='relative flex-1 rounded-full bg-border' />
    </ScrollAreaPrimitive.Scrollbar>
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
);
ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };

