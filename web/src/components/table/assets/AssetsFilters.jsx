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
import { Button, Input, Select } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const AssetsFilters = ({
  groups,
  selectedGroup,
  statusFilter,
  searchKeyword,
  loading,
  setSelectedGroup,
  setStatusFilter,
  setSearchKeyword,
  onSearch,
  onReset,
  t,
}) => {
  const groupOptions = groups.map((group) => ({
    label: group.name || `${t('分组')} #${group.id}`,
    value: group.id,
  }));

  return (
    <div className='flex flex-col md:flex-row items-center gap-2 w-full'>
      <div className='w-full md:w-44'>
        <Select
          size='small'
          placeholder={t('选择分组')}
          value={selectedGroup}
          optionList={groupOptions}
          onChange={setSelectedGroup}
          showClear
        />
      </div>

      <div className='w-full md:w-40'>
        <Select
          size='small'
          placeholder={t('状态')}
          value={statusFilter}
          onChange={setStatusFilter}
          showClear
          optionList={[
            { label: t('处理中'), value: 'Processing' },
            { label: t('可用'), value: 'Active' },
            { label: t('失败'), value: 'Failed' },
          ]}
        />
      </div>

      <div className='w-full md:w-72'>
        <Input
          size='small'
          value={searchKeyword}
          prefix={<IconSearch />}
          showClear
          placeholder={t('按名称搜索素材')}
          onChange={setSearchKeyword}
          onEnterPress={onSearch}
        />
      </div>

      <Button
        size='small'
        type='tertiary'
        loading={loading}
        onClick={onSearch}
        className='w-full md:w-auto'
      >
        {t('查询')}
      </Button>
      <Button
        size='small'
        type='tertiary'
        onClick={onReset}
        className='w-full md:w-auto'
      >
        {t('重置')}
      </Button>
    </div>
  );
};

export default AssetsFilters;
