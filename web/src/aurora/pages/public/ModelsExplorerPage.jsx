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

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import ModelDetailDrawer from './models-explorer/ModelDetailDrawer';
import ModelsExplorerContent from './models-explorer/ModelsExplorerContent';
import ModelsExplorerFooter from './models-explorer/ModelsExplorerFooter';
import ModelsExplorerSidebar from './models-explorer/ModelsExplorerSidebar';
import ModelsExplorerToolbar from './models-explorer/ModelsExplorerToolbar';
import { useModelsExplorerPageState } from './models-explorer/useModelsExplorerPageState';
import { BASE_MODALITY_KEYS } from './models-explorer/constants';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../primitives/sheet';

const ExplorerMainLayout = ({
  categoryCountMap,
  copyText,
  detail,
  isMobile,
  loading,
  mobileFilterCount,
  onOpenMobileFilters,
  optionPanels,
  pagination,
  priceMetaMap,
  selections,
  t,
}) => (
  <main className='flex min-h-[calc(100vh-76px)] w-full flex-col lg:flex-row'>
    {!isMobile ? (
      <ModelsExplorerSidebar
        optionPanels={optionPanels}
        selectedModalities={selections.selectedModalities}
        selections={selections}
        t={t}
      />
    ) : null}

    <div className='min-w-0 flex-1 px-4 py-6 sm:px-5 lg:p-8'>
      <div className='w-full min-w-0'>
        <ModelsExplorerToolbar
          activeCategory={selections.activeCategory}
          activeFiltersCount={mobileFilterCount}
          categoryCountMap={categoryCountMap}
          handleCategoryClick={selections.handleCategoryClick}
          isMobile={isMobile}
          onToggleFilters={onOpenMobileFilters}
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

const MobileFilterSheet = ({
  open,
  onOpenChange,
  optionPanels,
  selectedModalities,
  selections,
  t,
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side='left'
      className='w-[86vw] max-w-[360px] overflow-y-auto p-4'
    >
      <SheetHeader className='mb-4 border-b border-border pb-3'>
        <SheetTitle>{t('筛选')}</SheetTitle>
        <SheetDescription>
          {t('按输入类型、系列与供应商筛选模型')}
        </SheetDescription>
      </SheetHeader>
      <ModelsExplorerSidebar
        isMobile={true}
        optionPanels={optionPanels}
        selectedModalities={selectedModalities}
        selections={selections}
        t={t}
      />
    </SheetContent>
  </Sheet>
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
  const isMobile = useIsMobile();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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

  const mobileFilterCount = useMemo(() => {
    const modalityNarrowCount = Math.max(
      0,
      BASE_MODALITY_KEYS.length - selections.selectedModalities.length,
    );
    return (
      modalityNarrowCount +
      selections.selectedSeries.length +
      selections.selectedProviders.length
    );
  }, [
    selections.selectedModalities.length,
    selections.selectedProviders.length,
    selections.selectedSeries.length,
  ]);

  return (
    <div className='min-h-screen bg-white text-[#05345c]'>
      <ExplorerMainLayout
        categoryCountMap={categoryCountMap}
        copyText={copyText}
        detail={detail}
        isMobile={isMobile}
        loading={loading}
        mobileFilterCount={mobileFilterCount}
        onOpenMobileFilters={() => setMobileFiltersOpen(true)}
        optionPanels={optionPanels}
        pagination={pagination}
        priceMetaMap={priceMetaMap}
        selections={selections}
        t={t}
      />

      {isMobile ? (
        <MobileFilterSheet
          open={mobileFiltersOpen}
          onOpenChange={setMobileFiltersOpen}
          optionPanels={optionPanels}
          selectedModalities={selections.selectedModalities}
          selections={selections}
          t={t}
        />
      ) : null}

      <ModelsExplorerFooter t={t} />
      <ExplorerDetailSection
        detail={detail}
        displayPrice={displayPrice}
        t={t}
      />
    </div>
  );
};

export default ModelsExplorerPage;
