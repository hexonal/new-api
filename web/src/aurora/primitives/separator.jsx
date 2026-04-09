/*
Copyright (C) 2025 QuantumNous
*/

import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cn } from '../lib/cn';

const Separator = React.forwardRef(({ className, orientation = 'horizontal', ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'vertical' ? 'w-px h-full' : 'h-px w-full',
      className,
    )}
    decorative
    orientation={orientation}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };

