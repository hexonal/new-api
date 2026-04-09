/*
Copyright (C) 2025 QuantumNous
*/

import * as React from 'react';
import { cn } from '../lib/cn';

const Input = React.forwardRef(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <label className='w-full'>
        {label && (
          <span className='mb-1.5 block text-sm font-medium text-foreground'>
            {label}
          </span>
        )}
        <div className='relative flex items-center'>
          {icon && (
            <span className='aurora-input-icon'>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium',
              icon ? 'pl-9' : '',
              error ? 'border-destructive focus-visible:ring-destructive' : '',
              className,
            )}
            {...props}
          />
        </div>
        {error && <span className='mt-1 text-xs text-destructive'>{error}</span>}
      </label>
    );
  },
);

Input.displayName = 'Input';

export { Input };

