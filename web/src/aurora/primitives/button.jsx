/*
Copyright (C) 2025 QuantumNous
*/

import * as React from 'react';
import { cva } from '../lib/cva';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        destructive:
          'bg-destructive text-destructive-foreground hover:opacity-90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:opacity-80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 text-sm',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
      loading: {
        enabled: 'relative cursor-wait opacity-70',
        disabled: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      loading: 'disabled',
    },
  },
);

const Button = React.forwardRef(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(
          buttonVariants({
            variant,
            size,
            loading: loading ? 'enabled' : 'disabled',
            className,
          }),
        )}
        ref={ref}
        {...props}
      >
        {loading && <span className='button-spinner' aria-hidden={true} />}
        {children}
      </Comp>
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
