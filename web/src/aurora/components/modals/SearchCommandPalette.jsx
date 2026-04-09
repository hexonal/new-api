/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../../primitives/command';

const defaultCommands = [
  {
    id: 'dashboard',
    group: 'Navigation',
    label: 'Dashboard',
    href: '/console/dashboard',
    shortcut: 'G D',
  },
  {
    id: 'tokens',
    group: 'Navigation',
    label: 'Tokens',
    href: '/console/tokens',
    shortcut: 'G T',
  },
  {
    id: 'users',
    group: 'Navigation',
    label: 'Users',
    href: '/admin/users',
    shortcut: 'G U',
  },
  {
    id: 'models',
    group: 'Navigation',
    label: 'Models',
    href: '/admin/models',
    shortcut: 'G M',
  },
  {
    id: 'channels',
    group: 'Navigation',
    label: 'Channels',
    href: '/admin/channels',
    shortcut: 'G C',
  },
  {
    id: 'settings',
    group: 'Navigation',
    label: 'Settings',
    href: '/settings',
    shortcut: 'G S',
  },
];

export default function SearchCommandPalette({
  open,
  onOpenChange,
  commands = defaultCommands,
}) {
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);

  const visible = typeof open === 'boolean' ? open : internalOpen;
  const setVisible = (value) => {
    if (typeof onOpenChange === 'function') {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };

  useEffect(() => {
    const listener = (event) => {
      const isCmdK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isCmdK) return;
      event.preventDefault();
      setVisible(!visible);
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [visible]);

  const groups = useMemo(() => {
    const map = new Map();
    commands.forEach((item) => {
      const key = item.group || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries());
  }, [commands]);

  const run = (item) => {
    if (typeof item.onSelect === 'function') {
      item.onSelect(item);
    } else if (item.href) {
      navigate(item.href);
    }
    setVisible(false);
  };

  return (
    <Dialog open={visible} onOpenChange={setVisible}>
      <DialogContent className='p-0 sm:max-w-2xl'>
        <DialogHeader className='px-4 pt-4'>
          <DialogTitle>Command Palette</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder='Type a command or search...' />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {groups.map(([groupName, items]) => (
              <CommandGroup key={groupName} heading={groupName}>
                {items.map((item) => (
                  <CommandItem key={item.id} onSelect={() => run(item)}>
                    {item.label}
                    {item.shortcut ? (
                      <CommandShortcut>{item.shortcut}</CommandShortcut>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
