/*
Copyright (C) 2025 QuantumNous
*/

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;
const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 bg-black/50', className)}
    {...props}
  />
));

const SheetContent = React.forwardRef(({ className, children, side = 'right', ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 w-full bg-background p-6 shadow-xl transition ease-in-out',
        side === 'left' && 'inset-y-0 left-0 h-full max-w-sm border-r',
        side === 'right' && 'inset-y-0 right-0 h-full max-w-sm border-l',
        side === 'top' && 'inset-x-0 top-0 border-b',
        side === 'bottom' && 'inset-x-0 bottom-0 border-t',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className='absolute right-4 top-4 rounded-sm p-1 hover:bg-accent'>
        <X className='h-4 w-4' />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));

const SheetHeader = ({ className, ...props }) => (
  <div className={cn('mb-4', className)} {...props} />
);
const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-base font-semibold', className)}
    {...props}
  />
));
const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));

SheetContent.displayName = DialogPrimitive.Content.displayName;
SheetTitle.displayName = DialogPrimitive.Title.displayName;
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};

