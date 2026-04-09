/*
Copyright (C) 2025 QuantumNous
*/

import { Command } from 'cmdk';
import { cn } from '../lib/cn';

const CommandPalette = ({ className, ...props }) => (
  <Command
    className={cn(
      'w-full rounded-lg border border-border bg-popover text-popover-foreground',
      className,
    )}
    {...props}
  />
);

const CommandInput = ({ className, ...props }) => (
  <Command.Input
    className={cn(
      'flex h-10 w-full rounded-md bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground',
      className,
    )}
    {...props}
  />
);

const CommandList = ({ className, ...props }) => (
  <Command.List
    className={cn('max-h-80 overflow-y-auto p-1', className)}
    {...props}
  />
);

const CommandEmpty = ({ className, ...props }) => (
  <Command.Empty
    className={cn('px-3 py-6 text-center text-sm text-muted-foreground', className)}
    {...props}
  />
);

const CommandGroup = ({ className, ...props }) => (
  <Command.Group
    className={cn('overflow-hidden p-1', className)}
    {...props}
  />
);

const CommandItem = ({ className, ...props }) => (
  <Command.Item
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
      'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
      className,
    )}
    {...props}
  />
);

const CommandSeparator = ({ className, ...props }) => (
  <Command.Separator
    className={cn('h-px bg-border', className)}
    {...props}
  />
);

const CommandShortcut = ({ className, ...props }) => (
  <span
    className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
    {...props}
  />
);

export {
  CommandPalette as Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
};

