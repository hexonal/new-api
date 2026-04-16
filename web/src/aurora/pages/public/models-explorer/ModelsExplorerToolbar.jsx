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
import { ChevronDown, Grid3X3, List, Search } from 'lucide-react';
import { CATEGORY_PILLS } from './constants';

const CategoryPills = ({ activeCategory, categoryCountMap, onCategoryClick, t }) => (
  <div className='mb-8 flex items-center gap-2 overflow-x-auto pb-2'>
    {CATEGORY_PILLS.map((pill) => {
      const active = activeCategory === pill.key;
      const count = categoryCountMap[pill.key] || 0;
      return (
        <button
          key={pill.key}
          type='button'
          onClick={() => onCategoryClick(pill.key)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
            active
              ? 'bg-indigo-600 font-semibold text-white'
              : 'border border-gray-200 bg-white font-medium text-gray-600 hover:border-indigo-300'
          }`}
        >
          {t(pill.labelKey)} {count}
        </button>
      );
    })}
  </div>
);

const SearchBox = ({ onChange, searchKeyword, t }) => (
  <div className='flex w-full items-center rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm transition-all focus-within:border-indigo-400 md:w-[400px]'>
    <Search className='mr-2 h-4 w-4 text-gray-400' />
    <input
      type='text'
      value={searchKeyword}
      onChange={onChange}
      className='w-full border-none text-sm outline-none'
      placeholder={t('搜索模型...')}
    />
  </div>
);

const SortToggle = ({ onClick, sortBy, t }) => (
  <button
    type='button'
    className='flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
    onClick={onClick}
  >
    <span>{sortBy === 'newest' ? t('最新') : t('名称')}</span>
    <ChevronDown className='h-4 w-4' />
  </button>
);

const ViewModeToggle = ({ setViewMode, viewMode }) => (
  <div className='flex rounded-lg bg-gray-100 p-1'>
    <button
      type='button'
      className={`rounded-md p-1.5 ${
        viewMode === 'list'
          ? 'bg-white text-indigo-600 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
      onClick={() => setViewMode('list')}
    >
      <List className='h-5 w-5' />
    </button>
    <button
      type='button'
      className={`rounded-md p-1.5 ${
        viewMode === 'grid'
          ? 'bg-white text-indigo-600 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
      onClick={() => setViewMode('grid')}
    >
      <Grid3X3 className='h-5 w-5' />
    </button>
  </div>
);

const ModelsExplorerToolbar = ({
  activeCategory,
  categoryCountMap,
  handleCategoryClick,
  searchKeyword,
  setSearchKeyword,
  setSortBy,
  setViewMode,
  sortBy,
  t,
  viewMode,
}) => (
  <>
    <h1
      className='mb-8 text-4xl font-extrabold tracking-tight text-gray-900'
      style={{ fontFamily: 'Public Sans, sans-serif' }}
    >
      {t('模型广场')}
    </h1>

    <CategoryPills
      activeCategory={activeCategory}
      categoryCountMap={categoryCountMap}
      onCategoryClick={handleCategoryClick}
      t={t}
    />

    <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
      <SearchBox
        onChange={(event) => setSearchKeyword(event.target.value)}
        searchKeyword={searchKeyword}
        t={t}
      />

      <div className='flex items-center gap-3'>
        <SortToggle
          onClick={() => setSortBy((prev) => (prev === 'newest' ? 'name' : 'newest'))}
          sortBy={sortBy}
          t={t}
        />
        <ViewModeToggle setViewMode={setViewMode} viewMode={viewMode} />
      </div>
    </div>
  </>
);

export default ModelsExplorerToolbar;
