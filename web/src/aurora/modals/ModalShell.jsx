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

export default function ModalShell({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onClose,
  onConfirm,
  children,
}) {
  if (!open) return null;

  const handleConfirm = () => {
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4'>
      <div className='w-full max-w-lg rounded-lg bg-white p-5 shadow-xl'>
        <div className='mb-4'>
          <h3 className='text-lg font-semibold'>{title}</h3>
          {description ? <p className='mt-1 text-sm text-gray-600'>{description}</p> : null}
        </div>
        <div className='space-y-3'>{children}</div>
        <div className='mt-5 flex justify-end gap-2'>
          <button type='button' className='rounded-md border px-3 py-2 text-sm' onClick={onClose}>
            {cancelLabel}
          </button>
          {onConfirm ? (
            <button
              type='button'
              className='rounded-md bg-blue-600 px-3 py-2 text-sm text-white'
              onClick={handleConfirm}
            >
              {confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
