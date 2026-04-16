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
import { Tabs, TabPane, Tag } from '@douyinfe/semi-ui';
import { CHANNEL_OPTIONS } from '../../../constants';
import { getChannelIcon } from '../../../helpers';
import cn from 'classnames';

const ChannelsTabs = ({
  enableTagMode,
  activeTypeKey,
  setActiveTypeKey,
  channelTypeCounts,
  availableTypeKeys,
  loadChannels,
  activePage,
  pageSize,
  idSort,
  setActivePage,
  t,
}) => {
  if (enableTagMode) return null;

  const handleTabChange = (key) => {
    setActiveTypeKey(key);
    setActivePage(1);
    loadChannels(1, pageSize, idSort, enableTagMode, key);
  };

  return (
    <Tabs
      activeKey={activeTypeKey}
      collapsible
      onChange={handleTabChange}
      className='channels-type-tabs mb-2'
    >
      <TabPane
        itemKey='all'
        tab={
          <div className={cn('flex items-center gap-1 px-4 text-[rgba(107,114,128,1)] text-sm font-bold hover:text-[rgba(79,70,229,1)]', activeTypeKey === 'all' ? 'text-[rgba(79,70,229,1)]' : '')}>
            <div>{t('全部')}</div>
            {/* <Tag
              color={activeTypeKey === 'all' ? 'red' : 'grey'}
              shape='circle'
            >
              {channelTypeCounts['all'] || 0}
            </Tag> */}
            <div>{channelTypeCounts['all'] || 0}</div>
          </div>
        }
      />

      {CHANNEL_OPTIONS.filter((opt) =>
        availableTypeKeys.includes(String(opt.value)),
      ).map((option) => {
        const key = String(option.value);
        const count = channelTypeCounts[option.value] || 0;
        return (
          <TabPane
            key={key}
            itemKey={key}
            tab={
              <div className={cn('flex items-center gap-1 px-4 text-[rgba(107,114,128,1)] text-sm font-bold hover:text-[rgba(79,70,229,1)]', activeTypeKey === key ? 'text-[rgba(79,70,229,1)]' : '')}>
                {/* {getChannelIcon(option.value)} */}
                <div>{option.label}</div>
                {/* <Tag
                  color={activeTypeKey === key ? 'red' : 'grey'}
                  shape='circle'
                >
                  {count}
                </Tag> */}
                <div>{count}</div>
              </div>
            }
          />
        );
      })}
    </Tabs>
  );
};

export default ChannelsTabs;
