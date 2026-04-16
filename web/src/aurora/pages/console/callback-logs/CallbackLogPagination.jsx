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

function PaginationButton({ active, disabled, children, onClick }) {
  const className = active
    ? 'border-primary bg-primary text-white shadow-sm'
    : 'border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low';

  return (
    <button
      type='button'
      disabled={disabled}
      className={`min-w-11 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function CallbackLogPagination({
  activePage,
  eventCount,
  loading,
  onPageChange,
  pageSize,
  paginationItems,
  t,
  totalPages,
}) {
  const start = Math.min((activePage - 1) * pageSize + 1, eventCount || 0);
  const end = Math.min(activePage * pageSize, eventCount || 0);

  return (
    <section className='flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest px-6 py-4 md:flex-row md:items-center md:justify-between'>
      <div className='text-sm text-on-surface-variant'>
        {t('Showing')}{' '}
        <span className='font-semibold text-on-surface'>{start}</span> {t('to')}{' '}
        <span className='font-semibold text-on-surface'>{end}</span> {t('of')}{' '}
        <span className='font-semibold text-on-surface'>{eventCount || 0}</span>{' '}
        {t('logs')}
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <PaginationButton
          disabled={activePage <= 1 || loading}
          onClick={() => onPageChange(activePage - 1)}
        >
          {t('上一页')}
        </PaginationButton>
        {paginationItems.map((item) => {
          if (String(item).startsWith('ellipsis')) {
            return (
              <span key={item} className='px-2 text-sm text-on-surface-variant'>
                ...
              </span>
            );
          }

          return (
            <PaginationButton
              key={item}
              active={item === activePage}
              onClick={() => onPageChange(item)}
            >
              {item}
            </PaginationButton>
          );
        })}
        <PaginationButton
          disabled={activePage >= totalPages || loading}
          onClick={() => onPageChange(activePage + 1)}
        >
          {t('下一页')}
        </PaginationButton>
      </div>
    </section>
  );
}
