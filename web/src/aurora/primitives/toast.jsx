/*
Copyright (C) 2025 QuantumNous
*/

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cn } from '../lib/cn';

const ToastProvider = ToastPrimitive.Provider;
const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn('fixed inset-0 z-50 m-0 flex flex-col p-4', className)}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const Toast = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(
      'mb-2 w-full max-w-sm rounded-md border border-border bg-background p-4 shadow-lg',
      className,
    )}
    {...props}
  />
));
Toast.displayName = ToastPrimitive.Root.displayName;

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn('mb-1 text-sm font-medium', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn('ml-auto rounded-sm p-1', className)}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitive.Action.displayName;

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastAction };

