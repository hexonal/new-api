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
import CardPro from '../../common/ui/CardPro';
import { createCardProPagination } from '../../../helpers/utils';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import useAssetsData from '../../../hooks/assets/useAssetsData';
import AssetsActions from './AssetsActions';
import AssetsFilters from './AssetsFilters';
import AssetsTable from './AssetsTable';
import UploadAssetModal from './modals/UploadAssetModal';
import CreateGroupModal from './modals/CreateGroupModal';
import AssetDetailModal from './modals/AssetDetailModal';

const AssetsManager = () => {
  const isMobile = useIsMobile();
  const assetsData = useAssetsData();

  const {
    t,
    assets,
    groups,
    quota,
    loading,
    quotaLoading,
    activePage,
    pageSize,
    total,
    selectedGroup,
    statusFilter,
    searchKeyword,
    uploadVisible,
    createGroupVisible,
    detailVisible,
    detailLoading,
    currentAsset,
    submitting,
    setSelectedGroup,
    setStatusFilter,
    setSearchKeyword,
    setUploadVisible,
    setCreateGroupVisible,
    applyFilters,
    resetFilters,
    refresh,
    handlePageChange,
    handlePageSizeChange,
    uploadAsset,
    createGroup,
    openAssetDetail,
    closeAssetDetail,
    copyReference,
    renameAsset,
    removeAsset,
  } = assetsData;

  return (
    <>
      <UploadAssetModal
        visible={uploadVisible}
        onCancel={() => setUploadVisible(false)}
        onSubmit={uploadAsset}
        groups={groups}
        loading={submitting}
        t={t}
      />

      <CreateGroupModal
        visible={createGroupVisible}
        onCancel={() => setCreateGroupVisible(false)}
        onSubmit={createGroup}
        loading={submitting}
        t={t}
      />

      <AssetDetailModal
        visible={detailVisible}
        loading={detailLoading}
        asset={currentAsset}
        onClose={closeAssetDetail}
        onCopyReference={copyReference}
        t={t}
      />

      <CardPro
        type='type1'
        descriptionArea={<div className='text-base font-medium'>{t('素材管理')}</div>}
        actionsArea={
          <div className='flex flex-col gap-3'>
            <AssetsActions
              quota={quota}
              quotaLoading={quotaLoading}
              onOpenCreateGroup={() => setCreateGroupVisible(true)}
              onOpenUpload={() => setUploadVisible(true)}
              onRefresh={refresh}
              t={t}
            />
            <AssetsFilters
              groups={groups}
              selectedGroup={selectedGroup}
              statusFilter={statusFilter}
              searchKeyword={searchKeyword}
              loading={loading}
              setSelectedGroup={setSelectedGroup}
              setStatusFilter={setStatusFilter}
              setSearchKeyword={setSearchKeyword}
              onSearch={applyFilters}
              onReset={resetFilters}
              t={t}
            />
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: activePage,
          pageSize: pageSize,
          total: total,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
          isMobile: isMobile,
          t: t,
        })}
        t={t}
      >
        <AssetsTable
          assets={assets}
          loading={loading}
          onViewDetail={openAssetDetail}
          onCopyReference={copyReference}
          onRename={renameAsset}
          onDelete={removeAsset}
          t={t}
        />
      </CardPro>
    </>
  );
};

export default AssetsManager;
