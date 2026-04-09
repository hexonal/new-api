/*
Copyright (C) 2025 QuantumNous
*/

import * as React from 'react';
import { cn } from '../lib/cn';

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className='relative w-full overflow-auto'>
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const Thead = React.forwardRef(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('[&_tr]:border-b', className)}
    {...props}
  />
));
const Tbody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
const Tfoot = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('bg-muted/40 border-t', className)}
    {...props}
  />
));
const Tr = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className,
    )}
    {...props}
  />
));
const Th = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-3 text-left align-middle font-medium text-muted-foreground',
      className,
    )}
    {...props}
  />
));
const Td = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-3 py-2 align-middle', className)}
    {...props}
  />
));

Thead.displayName = 'Thead';
Tbody.displayName = 'Tbody';
Tfoot.displayName = 'Tfoot';
Tr.displayName = 'Tr';
Th.displayName = 'Th';
Td.displayName = 'Td';

export { Table, Thead, Tbody, Tfoot, Tr, Th, Td };

