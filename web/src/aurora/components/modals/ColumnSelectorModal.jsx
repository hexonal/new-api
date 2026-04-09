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

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import { Checkbox } from '../../primitives/checkbox';
import { Button } from '../../primitives/button';

export default function ColumnSelectorModal({
  open = false,
  onClose = () => {},
  columns = [],
  visibleColumns = {},
  onColumnVisibilityChange,
  onSelectAll,
}) {
  const { t } = useTranslation();

  const allChecked = useMemo(
    () =>
      columns.length > 0 &&
      columns.every((col) => visibleColumns[col.key] !== false),
    [columns, visibleColumns],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('列选择')}</DialogTitle>
          <DialogDescription>{t('自定义表格显示列')}</DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <label className='flex items-center gap-2 text-sm font-medium'>
            <Checkbox
              checked={allChecked}
              onCheckedChange={(checked) => onSelectAll?.(Boolean(checked))}
            />
            {t('全选')}
          </label>

          <div className='max-h-72 space-y-2 overflow-auto rounded-lg border border-border p-3'>
            {columns.map((column) => (
              <label
                key={column.key}
                className='flex items-center gap-2 text-sm'
              >
                <Checkbox
                  checked={visibleColumns[column.key] !== false}
                  onCheckedChange={(checked) =>
                    onColumnVisibilityChange?.(column.key, Boolean(checked))
                  }
                />
                {column.title || column.name || column.key}
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            {t('关闭')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
