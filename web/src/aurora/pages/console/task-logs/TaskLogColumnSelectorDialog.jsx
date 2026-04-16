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

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../primitives/dialog';
import { Button } from '../../../primitives/button';
import { Checkbox } from '../../../primitives/checkbox';
import { TASK_COLUMN_CONFIG } from './task-log-utils';

function ColumnRow({ checked, label, onCheckedChange }) {
  return (
    <label className='flex items-center gap-3 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface'>
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <span>{label}</span>
    </label>
  );
}

export default function TaskLogColumnSelectorDialog({
  open,
  onOpenChange,
  visibleColumns,
  handleColumnVisibilityChange,
  handleSelectAll,
  initDefaultColumns,
  isAdminUser,
  t,
}) {
  const selectableColumns = React.useMemo(() => {
    return TASK_COLUMN_CONFIG.filter((column) => {
      if (isAdminUser) {
        return true;
      }
      return !['channel', 'username'].includes(column.key);
    });
  }, [isAdminUser]);

  const allChecked = selectableColumns.every(
    (column) => visibleColumns[column.key],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl rounded-2xl border-outline-variant bg-surface-container-lowest'>
        <DialogHeader>
          <DialogTitle className='text-xl font-bold text-on-surface'>
            {t('列设置')}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <label className='flex items-center gap-3 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm font-medium text-on-surface'>
            <Checkbox
              checked={allChecked}
              onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
            />
            <span>{t('全选')}</span>
          </label>

          <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
            {selectableColumns.map((column) => (
              <ColumnRow
                key={column.key}
                checked={Boolean(visibleColumns[column.key])}
                label={t(column.labelKey)}
                onCheckedChange={(checked) =>
                  handleColumnVisibilityChange(column.key, Boolean(checked))
                }
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            className='border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'
            onClick={initDefaultColumns}
          >
            {t('重置')}
          </Button>
          <Button
            className='bg-primary text-white hover:bg-primary-dim'
            onClick={() => onOpenChange(false)}
          >
            {t('确定')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
