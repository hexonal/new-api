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
import ModelsExplorerGrid from './ModelsExplorerGrid';
import ModelsExplorerList from './ModelsExplorerList';
import ModelsExplorerPagination from './ModelsExplorerPagination';

const LoadingState = ({ t }) => (
  <div className='rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500'>
    {t('加载中...')}
  </div>
);

const EmptyState = ({ t }) => (
  <div className='rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500'>
    {t('暂无匹配模型')}
  </div>
);

const ModelsExplorerContent = ({
  copyText,
  currentPageSafe,
  loading,
  pageNumbers,
  pagedModels,
  priceMetaMap,
  setCurrentPage,
  setDetailModel,
  t,
  totalPages,
  viewMode,
}) => (
  <>
    {loading && <LoadingState t={t} />}

    {!loading && pagedModels.length === 0 && <EmptyState t={t} />}

    {!loading && pagedModels.length > 0 && viewMode === 'list' && (
      <ModelsExplorerList
        copyText={copyText}
        models={pagedModels}
        onChooseModel={setDetailModel}
        priceMetaMap={priceMetaMap}
        t={t}
      />
    )}

    {!loading && pagedModels.length > 0 && viewMode === 'grid' && (
      <ModelsExplorerGrid
        copyText={copyText}
        models={pagedModels}
        onChooseModel={setDetailModel}
        priceMetaMap={priceMetaMap}
        t={t}
      />
    )}

    <ModelsExplorerPagination
      currentPageSafe={currentPageSafe}
      pageNumbers={pageNumbers}
      setCurrentPage={setCurrentPage}
      totalPages={totalPages}
    />
  </>
);

export default ModelsExplorerContent;
