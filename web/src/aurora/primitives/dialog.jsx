/*
Copyright (C) 2025 QuantumNous
*/

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 bg-black/50', className)}
    {...props}
  />
));
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-4 shadow-lg',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogClose = React.forwardRef(({ className, ...props }, ref) => (
  <DialogCloseInner ref={ref} className={className} {...props} />
));
DialogClose.displayName = DialogPrimitive.Close.displayName;

const DialogCloseInner = React.forwardRef(({ className, ...props }, ref) => {
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Close
      ref={ref}
      className={cn(
        'absolute right-3 top-3 rounded-sm p-1 text-foreground/70 transition-colors hover:bg-accent',
        className,
      )}
      {...props}
    >
      <X className='h-4 w-4' />
      <span className='sr-only'>{t('Close')}</span>
    </DialogPrimitive.Close>
  );
});
DialogCloseInner.displayName = 'DialogCloseInner';

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-sm font-medium leading-none', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogHeader = ({ className, ...props }) => (
  <div className={cn('mb-4', className)} {...props} />
);
const DialogFooter = ({ className, ...props }) => (
  <div className={cn('mt-4 flex justify-end gap-2', className)} {...props} />
);

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
