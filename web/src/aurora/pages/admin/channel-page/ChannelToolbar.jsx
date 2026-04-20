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
  BadgePlus,
  ChevronDown,
  Columns3,
  Layers3,
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
    <div className='space-y-6'>
      <div className='grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start'>
        <div className='space-y-3'>
          <div className='inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-600'>
            <Layers3 className='h-3.5 w-3.5' />
            {t('渠道工作区')}
          </div>
          <div className='space-y-2'>
            <h1 className='text-3xl font-black tracking-[-0.05em] text-slate-900 md:text-4xl'>
              {t('渠道管理')}
            </h1>
            <p className='max-w-3xl text-sm font-medium leading-6 text-slate-500 md:text-[15px]'>
              {t('channels.description')}
            </p>
          </div>
        </div>

        <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end'>
          <Button
            variant='outline'
            className='justify-start border-slate-200 bg-white text-slate-600 sm:justify-center'
            onClick={onRefresh}
          >
            <RefreshCw className='mr-2 h-4 w-4' />
            {t('刷新能力')}
          </Button>
          <Button
            variant='outline'
            className='justify-start border-slate-200 bg-white text-slate-600 sm:justify-center'
            onClick={onOpenColumnSelector}
          >
            <Columns3 className='mr-2 h-4 w-4' />
            {t('列设置')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                className='justify-start border-slate-200 bg-white text-slate-600 sm:justify-center'
              >
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
          <Button
            className='justify-start rounded-xl px-5 shadow-[0_12px_28px_-16px_rgba(79,70,229,0.65)] sm:justify-center'
            onClick={onCreate}
          >
            <Plus className='mr-2 h-4 w-4' />
            {t('添加渠道')}
          </Button>
        </div>
      </div>

      <div className='rounded-[26px] border border-slate-200/90 bg-white/95 p-4 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.4)] md:p-5'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
            <div className='space-y-1'>
              <p className='text-xs font-semibold uppercase tracking-[0.22em] text-slate-400'>
                {t('渠道类型')}
              </p>
              <p className='text-sm text-slate-500'>
                {t('按提供商快速切换列表，减少筛选时的横向拥挤。')}
              </p>
            </div>
            <div className='inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500 lg:self-auto'>
              <BadgePlus className='h-3.5 w-3.5 text-slate-400' />
              {t('共 {{count}} 个类型分组', { count: tabs.length })}
            </div>
          </div>

          <Tabs value={activeTypeKey} onValueChange={onTypeChange}>
            <TabsList className='flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/80 p-2 text-slate-500'>
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className='shrink-0 rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold data-[state=active]:border-indigo-100 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-[0_10px_20px_-18px_rgba(79,70,229,0.7)]'
                >
                  <span>{tab.label}</span>
                  <span className='ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600'>
                    {tab.count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className='rounded-[26px] border border-slate-200/90 bg-white p-4 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.4)] md:p-5'>
        <div className='flex flex-col gap-5'>
          <div className='space-y-1'>
            <p className='text-xs font-semibold uppercase tracking-[0.22em] text-slate-400'>
              {t('筛选与搜索')}
            </p>
            <p className='text-sm text-slate-500'>
              {t(
                '优先使用搜索框，再配合分组和状态缩小范围，避免控件全部挤在一行。',
              )}
            </p>
          </div>

          <div className='grid gap-3 xl:grid-cols-2'>
            <Input
              icon={<Search className='h-4 w-4' />}
              className='h-11 rounded-xl border-slate-200 bg-white'
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
              className='h-11 rounded-xl border-slate-200 bg-white'
              value={filters.searchModel}
              placeholder={t('模型关键字')}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  searchModel: event.target.value,
                }))
              }
            />
          </div>

          <div className='grid gap-3 lg:grid-cols-[220px_180px_minmax(0,1fr)]'>
            <Select
              value={filters.searchGroup || '__all__'}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  searchGroup: value === '__all__' ? '' : value,
                }))
              }
            >
              <SelectTrigger className='h-11 rounded-xl border-slate-200 bg-white'>
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
              <SelectTrigger className='h-11 rounded-xl border-slate-200 bg-white'>
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
            <div className='flex flex-col gap-2 sm:flex-row sm:justify-end'>
              <Button
                variant='outline'
                className='h-11 rounded-xl border-slate-200 px-5 text-slate-600'
                onClick={onReset}
                disabled={loading || searching}
              >
                {t('重置')}
              </Button>
              <Button
                className='h-11 rounded-xl px-5 shadow-[0_12px_28px_-16px_rgba(79,70,229,0.65)]'
                onClick={onSearch}
                loading={loading || searching}
              >
                {t('查询')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
