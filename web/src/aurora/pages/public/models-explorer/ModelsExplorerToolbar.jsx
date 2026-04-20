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
  ChevronDown,
  Grid3X3,
  List,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '../../../primitives/tabs';
import { CATEGORY_PILLS } from './constants';

const CategoryTabs = ({
  activeCategory,
  categoryCountMap,
  onCategoryClick,
  t,
}) => (
  <Tabs value={activeCategory} onValueChange={onCategoryClick}>
    <TabsList
      aria-label={t('模型类别')}
      className='mb-6 flex h-auto w-full justify-start gap-3 overflow-x-auto rounded-none border-0 bg-transparent p-0 text-slate-500 shadow-none'
    >
      {CATEGORY_PILLS.map((pill) => {
        const active = activeCategory === pill.key;
        const count = categoryCountMap[pill.key] || 0;
        return (
          <TabsTrigger
            key={pill.key}
            value={pill.key}
            className='shrink-0 rounded-full border border-slate-200 bg-white/95 px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-[0_10px_25px_-22px_rgba(15,23,42,0.22)] transition-all hover:border-indigo-200 hover:text-indigo-600 data-[state=active]:border-indigo-200 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-[0_16px_34px_-24px_rgba(79,70,229,0.5)]'
          >
            <span>{t(pill.labelKey)}</span>
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                active
                  ? 'bg-white text-indigo-700 shadow-[inset_0_0_0_1px_rgba(165,180,252,0.4)]'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {count}
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  </Tabs>
);

const SearchBox = ({ onChange, searchKeyword, t }) => (
  <div className='flex min-h-11 w-full items-center rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm transition-all focus-within:border-indigo-400 md:w-[400px]'>
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
    className='flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
    onClick={onClick}
  >
    <span>{sortBy === 'newest' ? t('最新') : t('名称')}</span>
    <ChevronDown className='h-4 w-4' />
  </button>
);

const ViewModeToggle = ({ setViewMode, viewMode }) => (
  <div className='flex min-h-11 items-center rounded-lg bg-gray-100 p-1'>
    <button
      type='button'
      className={`flex min-h-9 min-w-9 items-center justify-center rounded-md p-1.5 ${
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
      className={`flex min-h-9 min-w-9 items-center justify-center rounded-md p-1.5 ${
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

const FilterToggleButton = ({ activeFiltersCount, onClick, t }) => (
  <button
    type='button'
    className='inline-flex min-h-11 items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
    onClick={onClick}
  >
    <SlidersHorizontal className='h-4 w-4' />
    <span>{t('筛选')}</span>
    {activeFiltersCount > 0 ? (
      <span className='rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white'>
        {activeFiltersCount}
      </span>
    ) : null}
  </button>
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
  isMobile = false,
  onToggleFilters,
  activeFiltersCount = 0,
}) => (
  <>
    <h1
      className='mb-8 text-4xl font-extrabold tracking-tight text-gray-900'
      style={{ fontFamily: 'Public Sans, sans-serif' }}
    >
      {t('模型广场')}
    </h1>

    <CategoryTabs
      activeCategory={activeCategory}
      categoryCountMap={categoryCountMap}
      onCategoryClick={handleCategoryClick}
      t={t}
    />

    <div className='mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
      <SearchBox
        onChange={(event) => setSearchKeyword(event.target.value)}
        searchKeyword={searchKeyword}
        t={t}
      />

      <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
        {isMobile ? (
          <FilterToggleButton
            activeFiltersCount={activeFiltersCount}
            onClick={onToggleFilters}
            t={t}
          />
        ) : null}
        <SortToggle
          onClick={() =>
            setSortBy((prev) => (prev === 'newest' ? 'name' : 'newest'))
          }
          sortBy={sortBy}
          t={t}
        />
        <ViewModeToggle setViewMode={setViewMode} viewMode={viewMode} />
      </div>
    </div>
  </>
);

export default ModelsExplorerToolbar;
