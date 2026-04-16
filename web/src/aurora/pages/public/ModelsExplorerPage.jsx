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
import { useTranslation } from 'react-i18next';
import ModelDetailDrawer from './models-explorer/ModelDetailDrawer';
import ModelsExplorerContent from './models-explorer/ModelsExplorerContent';
import ModelsExplorerFooter from './models-explorer/ModelsExplorerFooter';
import ModelsExplorerSidebar from './models-explorer/ModelsExplorerSidebar';
import ModelsExplorerToolbar from './models-explorer/ModelsExplorerToolbar';
import { useModelsExplorerPageState } from './models-explorer/useModelsExplorerPageState';

const ExplorerMainLayout = ({
  categoryCountMap,
  copyText,
  detail,
  loading,
  optionPanels,
  pagination,
  priceMetaMap,
  selections,
  t,
}) => (
  <main className='flex min-h-[calc(100vh-76px)] w-full'>
    <ModelsExplorerSidebar
      optionPanels={optionPanels}
      selectedModalities={selections.selectedModalities}
      selections={selections}
      t={t}
    />

    <div className='min-w-0 flex-1 p-8'>
      <div className='w-full min-w-0'>
        <ModelsExplorerToolbar
          activeCategory={selections.activeCategory}
          categoryCountMap={categoryCountMap}
          handleCategoryClick={selections.handleCategoryClick}
          searchKeyword={selections.searchKeyword}
          setSearchKeyword={selections.setSearchKeyword}
          setSortBy={selections.setSortBy}
          setViewMode={selections.setViewMode}
          sortBy={selections.sortBy}
          t={t}
          viewMode={selections.viewMode}
        />

        <ModelsExplorerContent
          copyText={copyText}
          currentPageSafe={pagination.currentPageSafe}
          loading={loading}
          pageNumbers={pagination.pageNumbers}
          pagedModels={pagination.pagedModels}
          priceMetaMap={priceMetaMap}
          setCurrentPage={pagination.setCurrentPage}
          setDetailModel={detail.setDetailModel}
          t={t}
          totalPages={pagination.totalPages}
          viewMode={selections.viewMode}
        />
      </div>
    </div>
  </main>
);

const ExplorerDetailSection = ({ detail, displayPrice, t }) => (
  <ModelDetailDrawer
    detailAutoChain={detail.detailAutoChain}
    detailEndpoints={detail.detailEndpoints}
    detailModel={detail.detailModel}
    detailPricingRows={detail.detailPricingRows}
    displayPrice={displayPrice}
    onClose={() => detail.setDetailModel(null)}
    t={t}
  />
);

const ModelsExplorerPage = () => {
  const { t, i18n } = useTranslation();
  const {
    categoryCountMap,
    copyText,
    displayPrice,
    loading,
    optionPanels,
    pagination,
    priceMetaMap,
    selections,
    detail,
  } = useModelsExplorerPageState({
    language: i18n.language,
    t,
  });

  return (
    <div className='min-h-screen bg-white text-[#05345c]'>
      <ExplorerMainLayout
        categoryCountMap={categoryCountMap}
        copyText={copyText}
        detail={detail}
        loading={loading}
        optionPanels={optionPanels}
        pagination={pagination}
        priceMetaMap={priceMetaMap}
        selections={selections}
        t={t}
      />

      <ModelsExplorerFooter t={t} />
      <ExplorerDetailSection detail={detail} displayPrice={displayPrice} t={t} />
    </div>
  );
};

export default ModelsExplorerPage;
