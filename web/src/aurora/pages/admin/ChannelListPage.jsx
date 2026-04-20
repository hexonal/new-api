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

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHANNEL_OPTIONS } from '../../../constants';
import { useChannelsData } from '../../../hooks/channels/useChannelsData';
import ChannelDataTable from './channel-page/ChannelDataTable';
import ChannelModalStack from './channel-page/ChannelModalStack';
import ChannelSummaryCards from './channel-page/ChannelSummaryCards';
import ChannelToolbar from './channel-page/ChannelToolbar';

const EMPTY_FILTERS = {
  searchKeyword: '',
  searchGroup: '',
  searchModel: '',
};

const createFormApiBridge = (filtersRef, setFilters) => ({
  getValues: () => filtersRef.current,
  reset: () => {
    filtersRef.current = EMPTY_FILTERS;
    setFilters(EMPTY_FILTERS);
  },
});

const getBatchActionHandler = (data, actionId) => {
  if (actionId === 'test-all') return () => data.testAllChannels();
  if (actionId === 'fix') return () => data.fixChannelsAbilities();
  if (actionId === 'update-balance')
    return () => data.updateAllChannelsBalance();
  if (actionId === 'detect-upstream')
    return () => data.detectAllUpstreamUpdates();
  if (actionId === 'apply-upstream')
    return () => data.applyAllUpstreamUpdates();
  if (actionId === 'delete-disabled')
    return () => data.deleteAllDisabledChannels();
  return () => undefined;
};

/**
 * Aurora 渠道管理列表页。
 * @returns {JSX.Element}
 */
export default function ChannelListPage() {
  const navigate = useNavigate();
  const data = useChannelsData();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    data.setFormApi(createFormApiBridge(filtersRef, setFilters));
  }, [data.setFormApi]);

  const handleSearch = async () => {
    data.setActivePage(1);
    await data.searchChannels(
      data.enableTagMode,
      data.activeTypeKey,
      data.statusFilter,
      1,
      data.pageSize,
      data.idSort,
    );
  };

  const handleReset = async () => {
    const nextFilters = EMPTY_FILTERS;
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    data.setActivePage(1);
    await data.refresh(1);
  };

  const handleTypeChange = async (value) => {
    data.setActiveTypeKey(value);
    data.setActivePage(1);
    await data.loadChannels(
      1,
      data.pageSize,
      data.idSort,
      data.enableTagMode,
      value,
    );
  };

  const handleStatusFilterChange = async (value) => {
    localStorage.setItem('channel-status-filter', value);
    data.setStatusFilter(value);
    data.setActivePage(1);
    await data.loadChannels(
      1,
      data.pageSize,
      data.idSort,
      data.enableTagMode,
      data.activeTypeKey,
      value,
    );
  };

  const onBatchAction = (actionId) => {
    const handler = getBatchActionHandler(data, actionId);
    handler();
  };

  return (
    <div className='flex w-full flex-col gap-7 px-3 pb-10 pt-1 2xl:px-6'>
      <ChannelToolbar
        t={data.t}
        filters={filters}
        setFilters={setFilters}
        onSearch={handleSearch}
        onReset={handleReset}
        onRefresh={() => data.refresh()}
        onCreate={() => navigate('/console/channel/create')}
        onBatchAction={onBatchAction}
        loading={data.loading}
        searching={data.searching}
        groupOptions={data.groupOptions}
        activeTypeKey={data.activeTypeKey}
        onTypeChange={handleTypeChange}
        channelTypeCounts={data.channelTypeCounts}
        availableTypeKeys={data.availableTypeKeys}
        channelOptions={CHANNEL_OPTIONS}
        statusFilter={data.statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        onOpenColumnSelector={() => data.setShowColumnSelector(true)}
      />

      <ChannelSummaryCards channels={data.channels} t={data.t} />

      <ChannelDataTable
        channels={data.channels}
        selectedChannels={data.selectedChannels}
        setSelectedChannels={data.setSelectedChannels}
        t={data.t}
        manageChannel={data.manageChannel}
        manageTag={data.manageTag}
        updateChannelBalance={data.updateChannelBalance}
        copySelectedChannel={data.copySelectedChannel}
        setCurrentTestChannel={data.setCurrentTestChannel}
        setShowModelTestModal={data.setShowModelTestModal}
        setCurrentMultiKeyChannel={data.setCurrentMultiKeyChannel}
        setShowMultiKeyManageModal={data.setShowMultiKeyManageModal}
        detectChannelUpstreamUpdates={data.detectChannelUpstreamUpdates}
        openUpstreamUpdateModal={data.openUpstreamUpdateModal}
        showEditTag={data.showEditTag}
        setShowEditTag={data.setShowEditTag}
        setEditingTag={data.setEditingTag}
        activePage={data.activePage}
        pageSize={data.pageSize}
        channelCount={data.channelCount}
        handlePageChange={data.handlePageChange}
        handlePageSizeChange={data.handlePageSizeChange}
      />

      <ChannelModalStack {...data} />
    </div>
  );
}
