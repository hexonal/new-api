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
  Columns3,
  Plus,
  RefreshCw,
  Search,
  Settings2,
} from 'lucide-react';
import { Button } from '../../../primitives/button';
import { Input } from '../../../primitives/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../primitives/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../primitives/select';
import { Tabs, TabsList, TabsTrigger } from '../../../primitives/tabs';

const batchActions = (t) => [
  { id: 'test-all', label: t('测试所有未手动禁用渠道') },
  { id: 'fix', label: t('修复数据库一致性') },
  { id: 'update-balance', label: t('更新所有已启用通道余额') },
  { id: 'detect-upstream', label: t('检测全部渠道上游更新') },
  { id: 'apply-upstream', label: t('处理全部渠道上游更新') },
  { id: 'delete-disabled', label: t('删除禁用通道'), destructive: true },
];

const statusOptions = [
  { value: 'all', label: '全部' },
  { value: 'enabled', label: '已启用' },
  { value: 'disabled', label: '已禁用' },
];

const buildTypeTabs = ({
  availableTypeKeys,
  channelTypeCounts,
  channelOptions,
  t,
}) => {
  const allTab = {
    key: 'all',
    label: t('全部'),
    count: channelTypeCounts.all || 0,
  };

  const optionTabs = channelOptions
    .filter((option) => availableTypeKeys.includes(String(option.value)))
    .map((option) => ({
      key: String(option.value),
      label: option.label,
      count: channelTypeCounts[option.value] || 0,
    }));

  return [allTab, ...optionTabs];
};

/**
 * 渲染渠道页顶部工具栏与筛选区。
 * @param {Record<string, unknown>} props - 工具栏属性
 * @returns {JSX.Element}
 */
export default function ChannelToolbar(props) {
  const {
    t,
    filters,
    setFilters,
    onSearch,
    onReset,
    onRefresh,
    onCreate,
    onBatchAction,
    loading,
    searching,
    groupOptions,
    activeTypeKey,
    onTypeChange,
    channelTypeCounts,
    availableTypeKeys,
    channelOptions,
    statusFilter,
    onStatusFilterChange,
    onOpenColumnSelector,
  } = props;

  const tabs = buildTypeTabs({
    availableTypeKeys,
    channelTypeCounts,
    channelOptions,
    t,
  });

  return (
    <div className='space-y-5'>
      <div className='flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between'>
        <div>
          <h1 className='text-3xl font-black tracking-[-0.05em] text-slate-900'>
            {t('渠道管理')}
          </h1>
          <p className='mt-1 text-sm font-medium text-slate-500'>
            {t('Manage upstream AI provider configurations')}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Button variant='outline' onClick={onRefresh}>
            <RefreshCw className='mr-2 h-4 w-4' />
            {t('刷新能力')}
          </Button>
          <Button variant='outline' onClick={onOpenColumnSelector}>
            <Columns3 className='mr-2 h-4 w-4' />
            {t('列设置')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline'>
                <Settings2 className='mr-2 h-4 w-4' />
                {t('批量操作')}
                <ChevronDown className='ml-2 h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-64'>
              {batchActions(t).map((action, index) => (
                <React.Fragment key={action.id}>
                  {index === 5 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem
                    className={
                      action.destructive
                        ? 'text-red-600 focus:text-red-600'
                        : ''
                    }
                    onClick={() => onBatchAction(action.id)}
                  >
                    {action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={onCreate}>
            <Plus className='mr-2 h-4 w-4' />
            {t('添加渠道')}
          </Button>
        </div>
      </div>

      <Tabs value={activeTypeKey} onValueChange={onTypeChange}>
        <TabsList className='h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-0 bg-transparent p-0 text-slate-500'>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className='rounded-none border-b-2 border-transparent px-5 py-3 text-sm font-bold data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:text-indigo-600'
            >
              <span>{tab.label}</span>
              <span className='ml-1.5 text-xs'>{tab.count}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className='grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_40px_-30px_rgba(15,23,42,0.35)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_180px_auto]'>
        <Input
          icon={<Search className='h-4 w-4' />}
          value={filters.searchKeyword}
          placeholder={t('渠道ID，名称，密钥，API地址')}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              searchKeyword: event.target.value,
            }))
          }
        />
        <Input
          icon={<Search className='h-4 w-4' />}
          value={filters.searchModel}
          placeholder={t('模型关键字')}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              searchModel: event.target.value,
            }))
          }
        />
        <Select
          value={filters.searchGroup || '__all__'}
          onValueChange={(value) =>
            setFilters((current) => ({
              ...current,
              searchGroup: value === '__all__' ? '' : value,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('选择分组')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>{t('选择分组')}</SelectItem>
            {groupOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder={t('状态筛选')} />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            className='flex-1'
            onClick={onReset}
            disabled={loading || searching}
          >
            {t('重置')}
          </Button>
          <Button
            className='flex-1'
            onClick={onSearch}
            loading={loading || searching}
          >
            {t('查询')}
          </Button>
        </div>
      </div>
    </div>
  );
}
