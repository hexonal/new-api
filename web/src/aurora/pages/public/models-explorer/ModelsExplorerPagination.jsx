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
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PageNumberButton = ({ currentPageSafe, page, setCurrentPage }) => (
  <button
    type='button'
    onClick={() => setCurrentPage(page)}
    className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium ${
      page === currentPageSafe
        ? 'bg-indigo-600 text-white'
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {page}
  </button>
);

const ModelsExplorerPagination = ({
  currentPageSafe,
  pageNumbers,
  setCurrentPage,
  totalPages,
}) => (
  <div className='mt-12 flex items-center justify-center gap-2'>
    <button
      type='button'
      className='p-2 text-gray-400 transition-colors hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30'
      disabled={currentPageSafe <= 1}
      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
    >
      <ChevronLeft className='h-5 w-5' />
    </button>

    {pageNumbers.map((page, index) => {
      const prev = pageNumbers[index - 1];
      const gapBefore = prev && page - prev > 1;
      return (
        <React.Fragment key={`pager-${page}`}>
          {gapBefore && <span className='px-1 text-gray-400'>...</span>}
          <PageNumberButton
            currentPageSafe={currentPageSafe}
            page={page}
            setCurrentPage={setCurrentPage}
          />
        </React.Fragment>
      );
    })}

    <button
      type='button'
      className='p-2 text-gray-400 transition-colors hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30'
      disabled={currentPageSafe >= totalPages}
      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
    >
      <ChevronRight className='h-5 w-5' />
    </button>
  </div>
);

export default ModelsExplorerPagination;
