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
import { Banner, Dropdown } from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconChevronDown, IconPlus, IconBolt, IconCreditCard } from '@douyinfe/semi-icons';
import { ArrowLeftRight, Clock3 } from 'lucide-react';
import CardPro from '../../common/ui/CardPro';
import ChannelsTable from './ChannelsTable';
import ChannelsActions from './ChannelsActions';
import ChannelsFilters from './ChannelsFilters';
import ChannelsTabs from './ChannelsTabs';
import { useChannelsData } from '../../../hooks/channels/useChannelsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import BatchTagModal from './modals/BatchTagModal';
import ModelTestModal from './modals/ModelTestModal';
import ColumnSelectorModal from './modals/ColumnSelectorModal';
import EditChannelModal from './modals/EditChannelModal';
import EditTagModal from './modals/EditTagModal';
import MultiKeyManageModal from './modals/MultiKeyManageModal';
import ChannelUpstreamUpdateModal from './modals/ChannelUpstreamUpdateModal';
import { createCardProPagination } from '../../../helpers/utils';

const buildChannelsI18n = (t) => ({
  title: t('channels.title'),
  description: t('channels.description'),
  refreshAbilities: t('channels.refreshAbilities'),
  batchOperations: t('channels.batchOperations'),
  addChannel: t('channels.addChannel'),
  edit: t('channels.edit'),
  delete: t('channels.delete'),
  globalHealth: t('channels.globalHealth'),
  totalBalance: t('channels.totalBalance'),
  avgLatency: t('channels.avgLatency'),
  estimatedRemaining: t('channels.estimatedRemaining'),
  acrossActiveProviders: t('channels.acrossActiveProviders'),
  optimal: t('channels.optimal'),
});

// const GlobalHealthCard = ({
//   title = 'Global Health',
//   badgeContent = '+12%',
//   badgeClassName = 'w-[43px] h-[19px] flex items-center justify-center bg-[rgba(236,253,245,1)] rounded-xs text-[rgba(5,150,105,1)] text-[10px] font-bold',
//   badgeStyle,
//   value = '99.98%',
//   progressWidth = '100%',
// }) => {
//   return (
//     <div className='w-[429px] h-[179px] p-6 bg-white rounded-2xl border-[0.67px] border-[rgba(229,231,235,1)]'>
//       <div className='w-full h-10 flex items-center justify-between'>
//         <div className='w-10 h-full flex items-center justify-center bg-[rgba(238,242,255,1)] rounded-lg'>
//           <IconBolt style={{ color: 'rgba(79,70,229,1)', fontSize: 20 }} />
//         </div>
//         <div className={badgeClassName} style={badgeStyle}>
//           {badgeContent}
//         </div>
//       </div>
//       <div className='mt-4 text-[rgba(107,114,128,1)] text-xs font-bold tracking-[0.6px] uppercase'>
//         {title}
//       </div>
//       <div className='text-2xl font-black mt-2'>
//         {value}
//       </div>
//       <div
//         className='h-[6px] mt-4 bg-[rgba(79,70,229,1)] rounded-xl'
//         style={{ width: progressWidth }}
//       ></div>
//     </div>
//   );
// };

// const TotalBalanceCard = ({
//   title = 'Total Balance',
//   subtitle = 'Estimated 14 days remaining',
//   badgeContent = '-4%',
//   badgeClassName = 'w-[43px] h-[19px] flex items-center justify-center bg-[rgba(255,247,237,1)] rounded-xs text-[rgba(234,88,12,1)] text-[10px] font-bold',
//   badgeStyle,
//   value = '$12,450.82',
// }) => {
//   return (
//     <div className='w-[429px] h-[179px] p-6 bg-white rounded-2xl border-[0.67px] border-[rgba(229,231,235,1)]'>
//       <div className='w-full h-10 flex items-center justify-between'>
//         <div className='w-10 h-full flex items-center justify-center bg-[rgba(236,253,245,1)] rounded-lg'>
//           <IconCreditCard style={{ color: 'rgba(5,150,105,1)', fontSize: 20 }} />
//         </div>
//         <div className={badgeClassName} style={badgeStyle}>
//           {badgeContent}
//         </div>
//       </div>
//       <div className='mt-4 text-[rgba(107,114,128,1)] text-xs font-bold tracking-[0.6px] uppercase'>
//         {title}
//       </div>
//       <div className='text-2xl font-black mt-2'>
//         {value}
//       </div>
//       <div className='text-[rgba(156,163,175,1)] text-[10px] font-medium mt-2'>
//         {subtitle}
//       </div>
//     </div>
//   );
// };

// const AvgLatencyCard = ({
//   title = 'Avg Latency',
//   subtitle = 'Across all active providers',
//   badgeContent = 'Optimal',
//   badgeClassName = 'w-[43px] h-[19px] flex items-center justify-center bg-[rgba(236,253,245,1)] rounded-xs text-[rgba(5,150,105,1)] text-[10px] font-bold',
//   badgeStyle,
//   value = '412ms',
// }) => {
//   return (
//     <div className='w-[429px] h-[179px] p-6 bg-white rounded-2xl border-[0.67px] border-[rgba(229,231,235,1)]'>
//       <div className='w-full h-10 flex items-center justify-between'>
//         <div className='w-10 h-full flex items-center justify-center bg-[rgba(255,247,237,1)] rounded-lg'>
//           <Clock3 style={{ color: 'rgba(234,88,12,1)', fontSize: 20 }} />
//         </div>
//         <div className={badgeClassName} style={badgeStyle}>
//           {badgeContent}
//         </div>
//       </div>
//       <div className='mt-4 text-[rgba(107,114,128,1)] text-xs font-bold tracking-[0.6px] uppercase'>
//         {title}
//       </div>
//       <div className='text-2xl font-black mt-2'>
//         {value}
//       </div>
//       <div className='text-[rgba(156,163,175,1)] text-[10px] font-medium mt-2'>
//         {subtitle}
//       </div>
//     </div>
//   );
// };

const ChannelsPage = () => {
  const channelsData = useChannelsData();
  const isMobile = useIsMobile();
  const channels = buildChannelsI18n(channelsData.t);

  return (
    <>
      {/* Header */}
      <div className='w-full flex items-center justify-between mt-6'>
        {/* Title + Desc */}
        <div>
          {/* Title */}
          <div className='text-3xl font-black tracking-[-0.75px]'>
            {channels.title}
          </div>
          {/* Desc */}
          <div className='text-[rgba(107,114,128,1)] font-medium'>
            {channels.description}
          </div>
        </div>
        {/* Buttons */}
        <div className='flex items-center justify-between gap-4'>
          {/* Refresh Button */}
          <div
            className='h-[37px] flex items-center justify-center gap-2 px-4 text-sm font-semibold rounded-lg border border-[rgba(229,231,235,1)] cursor-pointer'
            role='button'
            tabIndex={0}
            onClick={() => channelsData.refresh()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                channelsData.refresh();
              }
            }}
          >
            <ArrowLeftRight size={16} />
            {channels.refreshAbilities}
          </div>
          {/* Batch Operations */}
          {/* <Dropdown
            position='bottomLeft'
            render={
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => console.log(channels.edit)}>
                  {channels.edit}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => console.log(channels.delete)}>
                  {channels.delete}
                </Dropdown.Item>
              </Dropdown.Menu>
            }
          > */}
            {/* Trigger */}
            {/* <div className='h-[37px] px-4 flex items-center justify-between gap-3 text-sm font-semibold rounded-lg border-[0.67px] border-[rgba(229,231,235,1)] cursor-pointer'>
              <div className='text-sm tracking-[0.8px]'>
                {channels.batchOperations}
              </div>
              <IconChevronDown size='12px' />
            </div>
          </Dropdown> */}
          {/*  Add Channel  */}
          <div
            className='h-[37px] flex items-center justify-center gap-3 px-4 text-sm font-semibold bg-[rgba(79,70,229,1)] text-white rounded-lg border border-[rgba(229,231,235,1)] shadow-[0px_2px_4px_-2px_rgba(199,210,254,1),0px_4px_6px_-1px_rgba(199,210,254,1)] cursor-pointer'
            role='button'
            tabIndex={0}
            onClick={() => {
              channelsData.setEditingChannel({ id: undefined });
              channelsData.setShowEdit(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                channelsData.setEditingChannel({ id: undefined });
                channelsData.setShowEdit(true);
              }
            }}
          >
            <IconPlus size={16} />
            {channels.addChannel}
          </div>
        </div>
      </div>
      {/* Modals */}
      <ColumnSelectorModal {...channelsData} />
      <EditTagModal
        visible={channelsData.showEditTag}
        tag={channelsData.editingTag}
        handleClose={() => channelsData.setShowEditTag(false)}
        refresh={channelsData.refresh}
      />
      <EditChannelModal
        refresh={channelsData.refresh}
        visible={channelsData.showEdit}
        handleClose={channelsData.closeEdit}
        editingChannel={channelsData.editingChannel}
      />
      <BatchTagModal {...channelsData} />
      <ModelTestModal {...channelsData} />
      <MultiKeyManageModal
        visible={channelsData.showMultiKeyManageModal}
        onCancel={() => channelsData.setShowMultiKeyManageModal(false)}
        channel={channelsData.currentMultiKeyChannel}
        onRefresh={channelsData.refresh}
      />
      <ChannelUpstreamUpdateModal
        visible={channelsData.showUpstreamUpdateModal}
        addModels={channelsData.upstreamUpdateAddModels}
        removeModels={channelsData.upstreamUpdateRemoveModels}
        preferredTab={channelsData.upstreamUpdatePreferredTab}
        confirmLoading={channelsData.upstreamApplyLoading}
        onConfirm={channelsData.applyUpstreamUpdates}
        onCancel={channelsData.closeUpstreamUpdateModal}
      />

      {/* Main Content */}
      {channelsData.globalPassThroughEnabled ? (
        <Banner
          type='warning'
          closeIcon={null}
          icon={
            <IconAlertTriangle
              size='large'
              style={{ color: 'var(--semi-color-warning)' }}
            />
          }
          description={channelsData.t(
            '已开启全局请求透传：参数覆写、模型重定向、渠道适配等 NewAPI 内置功能将失效，非最佳实践；如因此产生问题，请勿提交 issue 反馈。',
          )}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      <CardPro
        type='type3'
        className='channels-card'
        tabsArea={<ChannelsTabs {...channelsData} />}
        // actionsArea={<ChannelsActions {...channelsData} />}
        // searchArea={<ChannelsFilters {...channelsData} />}
        paginationArea={createCardProPagination({
          currentPage: channelsData.activePage,
          pageSize: channelsData.pageSize,
          total: channelsData.channelCount,
          onPageChange: channelsData.handlePageChange,
          onPageSizeChange: channelsData.handlePageSizeChange,
          showSizeChanger: false,
          isMobile: isMobile,
          t: channelsData.t,
        })}
        t={channelsData.t}
      >
        <ChannelsTable {...channelsData} />
      </CardPro>

      {/* <div className='w-full max-w-[1336px] flex items-center justify-between gap-2 my-6 overflow-x-auto overflow-y-hidden'> */}
        {/* Global Health */}
        {/* <GlobalHealthCard title={channels.globalHealth} /> */}
        {/* Total Balance */}
        {/* <TotalBalanceCard */}
          {/* title={channels.totalBalance} */}
          {/* subtitle={channels.estimatedRemaining} */}
        {/* /> */}
        {/* Avg Latency */}
        {/* <AvgLatencyCard */}
          {/* title={channels.avgLatency} */}
          {/* subtitle={channels.acrossActiveProviders} */}
          {/* badgeContent={channels.optimal} */}
        {/* /> */}
      {/* </div> */}
    </>
  );
};

export default ChannelsPage;
