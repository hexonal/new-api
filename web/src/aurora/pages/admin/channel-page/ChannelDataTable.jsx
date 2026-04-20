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

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy,
  Cpu,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Shield,
  TestTube2,
  Trash2,
  Wallet,
} from 'lucide-react';
import { CHANNEL_OPTIONS } from '../../../../constants';
import { getChannelIcon } from '../../../../helpers';
import { Badge } from '../../../primitives/badge';
import { Button } from '../../../primitives/button';
import { Checkbox } from '../../../primitives/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../primitives/dropdown-menu';
import { Input } from '../../../primitives/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '../../../primitives/table';
import {
  buildChannelStatusMeta,
  flattenChannelRows,
  formatChannelBalance,
  formatChannelLatency,
  sanitizeChannelMetricValue,
} from './channel-view-model';

const typeLabelMap = new Map(
  CHANNEL_OPTIONS.map((option) => [Number(option.value), option.label]),
);

const getToneClassName = (tone) => {
  if (tone === 'success')
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (tone === 'danger') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
};

const isChannelSelected = (selectedChannels, recordId) =>
  selectedChannels.some((channel) => channel.id === recordId);

const renderPageButtons = (currentPage, totalPages, onChange) => {
  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages.map((page) => (
    <button
      key={page}
      type='button'
      className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-semibold ${
        page === currentPage
          ? 'bg-indigo-600 text-white'
          : 'border border-slate-200 bg-white text-slate-600'
      }`}
      onClick={() => onChange(page)}
    >
      {page}
    </button>
  ));
};

const getLeafRows = (rows) => rows.filter((row) => !row._isTagGroup);

const getRowKey = (record, index) => {
  if (record._isTagGroup) {
    return `tag-${sanitizeChannelMetricValue(record.tag, 'untagged')}-${index}`;
  }

  const parentTag = sanitizeChannelMetricValue(record._parentTag, 'root');
  return `channel-${sanitizeChannelMetricValue(record.id, 'unknown')}-${parentTag}-${index}`;
};

/**
 * 渲染 Aurora 原生渠道表格。
 * @param {Record<string, unknown>} props - 表格属性
 * @returns {JSX.Element}
 */
export default function ChannelDataTable(props) {
  const navigate = useNavigate();
  const {
    channels,
    selectedChannels,
    setSelectedChannels,
    t,
    manageChannel,
    manageTag,
    updateChannelBalance,
    copySelectedChannel,
    setCurrentTestChannel,
    setShowModelTestModal,
    setCurrentMultiKeyChannel,
    setShowMultiKeyManageModal,
    detectChannelUpstreamUpdates,
    openUpstreamUpdateModal,
    setShowEditTag,
    setEditingTag,
    activePage,
    pageSize,
    channelCount,
    handlePageChange,
    handlePageSizeChange,
  } = props;

  const rows = useMemo(() => flattenChannelRows(channels), [channels]);
  const leafRows = useMemo(() => getLeafRows(rows), [rows]);
  const allSelected =
    leafRows.length > 0 && selectedChannels.length === leafRows.length;
  const totalPages = Math.max(
    1,
    Math.ceil((channelCount || 0) / Math.max(pageSize || 10, 1)),
  );

  const toggleAllRows = (checked) => {
    setSelectedChannels(checked ? leafRows : []);
  };

  const toggleRow = (checked, record) => {
    const nextRows = checked
      ? [...selectedChannels, record]
      : selectedChannels.filter((channel) => channel.id !== record.id);
    setSelectedChannels(nextRows);
  };

  const openModelTest = (record) => {
    setCurrentTestChannel(record);
    setShowModelTestModal(true);
  };

  const openTagEdit = (record) => {
    setEditingTag(record.tag || '');
    setShowEditTag(true);
  };

  return (
    <div className='rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.32)]'>
      <div className='overflow-x-auto'>
        <Table className='min-w-[720px] table-fixed md:min-w-[760px] xl:min-w-0'>
        <Thead className='border-b border-slate-100 bg-slate-50/70'>
          <Tr className='hover:bg-transparent'>
            <Th className='w-12'>
              <Checkbox checked={allSelected} onCheckedChange={toggleAllRows} />
            </Th>
            <Th className='w-[230px]'>{t('渠道')}</Th>
            <Th className='w-[170px]'>{t('类型')}</Th>
            <Th className='w-[120px]'>{t('状态')}</Th>
            <Th className='hidden xl:table-cell w-[320px]'>{t('分组')}</Th>
            <Th className='hidden 2xl:table-cell w-[260px]'>{t('模型')}</Th>
            <Th className='hidden xl:table-cell w-[110px]'>{t('响应时间')}</Th>
            <Th className='hidden xl:table-cell w-[140px]'>{t('余额')}</Th>
            <Th className='hidden 2xl:table-cell w-[100px]'>{t('优先级')}</Th>
            <Th className='hidden 2xl:table-cell w-[100px]'>{t('权重')}</Th>
            <Th className='w-[76px] text-right'>{t('操作')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((record, index) => {
            const statusMeta = buildChannelStatusMeta({ ...record, t });
            const typeValue = Number(record.type);
            const typeLabel = record._isTagGroup
              ? t('标签聚合')
              : typeLabelMap.get(typeValue) || t('未知类型');
            const modelsText = sanitizeChannelMetricValue(record.models);
            const balanceText = formatChannelBalance(record.balance);
            const latencyText = formatChannelLatency(record.response_time, t);
            const isSelected = isChannelSelected(selectedChannels, record.id);

            return (
              <Tr
                key={getRowKey(record, index)}
                className={record.status !== 1 ? 'bg-slate-50/70' : ''}
              >
                <Td>
                  <Checkbox
                    checked={isSelected}
                    disabled={record._isTagGroup}
                    onCheckedChange={(checked) =>
                      toggleRow(Boolean(checked), record)
                    }
                  />
                </Td>
                <Td>
                  <div className={`space-y-0.5 ${record._depth ? 'pl-4' : ''}`}>
                    <div className='flex items-start gap-2'>
                      {record._isTagGroup ? (
                        <Badge variant='secondary' className='rounded-full'>
                          {t('标签')}
                        </Badge>
                      ) : (
                        getChannelIcon(typeValue)
                      )}
                      <span className='line-clamp-2 text-[15px] font-semibold leading-6 text-slate-900'>
                        {sanitizeChannelMetricValue(record.name)}
                      </span>
                    </div>
                    <div className='text-xs leading-5 text-slate-500'>
                      ID {sanitizeChannelMetricValue(record.id)}
                    </div>
                    <div className='truncate text-xs leading-5 text-slate-500 xl:hidden'>
                      {sanitizeChannelMetricValue(record.group)}
                    </div>
                  </div>
                </Td>
                <Td>
                  <div className='flex items-center gap-2 text-sm text-slate-700'>
                    {!record._isTagGroup ? (
                      getChannelIcon(typeValue)
                    ) : (
                      <Shield className='h-4 w-4 text-slate-400' />
                    )}
                    <span className='line-clamp-2'>{typeLabel}</span>
                  </div>
                </Td>
                <Td>
                  <Badge
                    variant='outline'
                    className={`rounded-full whitespace-nowrap ${getToneClassName(statusMeta.tone)}`}
                  >
                    {statusMeta.label}
                    {statusMeta.detail ? ` ${statusMeta.detail}` : ''}
                  </Badge>
                </Td>
                <Td className='hidden xl:table-cell'>
                  <div className='truncate text-sm leading-6 text-slate-700'>
                    {sanitizeChannelMetricValue(record.group)}
                  </div>
                </Td>
                <Td className='hidden 2xl:table-cell'>
                  <div className='truncate text-sm text-slate-600'>
                    {modelsText}
                  </div>
                </Td>
                <Td className='hidden xl:table-cell whitespace-nowrap text-sm text-slate-700'>
                  {latencyText}
                </Td>
                <Td className='hidden xl:table-cell whitespace-nowrap text-sm font-medium text-slate-800'>
                  {balanceText}
                </Td>
                <Td className='hidden 2xl:table-cell'>
                  {record._isTagGroup ? (
                    <span className='text-slate-400'>—</span>
                  ) : (
                    <Input
                      className='h-8 w-16'
                      defaultValue={sanitizeChannelMetricValue(
                        record.priority,
                        '',
                      )}
                      onBlur={(event) =>
                        manageChannel(
                          record.id,
                          'priority',
                          record,
                          event.target.value,
                        )
                      }
                    />
                  )}
                </Td>
                <Td className='hidden 2xl:table-cell'>
                  {record._isTagGroup ? (
                    <span className='text-slate-400'>—</span>
                  ) : (
                    <Input
                      className='h-8 w-16'
                      defaultValue={sanitizeChannelMetricValue(
                        record.weight,
                        '',
                      )}
                      onBlur={(event) =>
                        manageChannel(
                          record.id,
                          'weight',
                          record,
                          event.target.value,
                        )
                      }
                    />
                  )}
                </Td>
                <Td className='text-right'>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='ghost' size='icon'>
                        <MoreHorizontal className='h-4 w-4' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end' className='w-56'>
                      {record._isTagGroup ? (
                        <>
                          <DropdownMenuItem onClick={() => openTagEdit(record)}>
                            <Pencil className='mr-2 h-4 w-4' />
                            {t('编辑标签')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => manageTag(record.tag, 'enable')}
                          >
                            <Shield className='mr-2 h-4 w-4' />
                            {t('启用标签')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => manageTag(record.tag, 'disable')}
                          >
                            <Shield className='mr-2 h-4 w-4' />
                            {t('禁用标签')}
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/console/channel/${record.id}/edit`)
                            }
                          >
                            <Pencil className='mr-2 h-4 w-4' />
                            {t('编辑渠道')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => copySelectedChannel(record)}
                          >
                            <Copy className='mr-2 h-4 w-4' />
                            {t('复制渠道')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openModelTest(record)}
                          >
                            <TestTube2 className='mr-2 h-4 w-4' />
                            {t('模型测试')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateChannelBalance(record)}
                          >
                            <Wallet className='mr-2 h-4 w-4' />
                            {t('更新余额')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setCurrentMultiKeyChannel(record);
                              setShowMultiKeyManageModal(true);
                            }}
                          >
                            <Cpu className='mr-2 h-4 w-4' />
                            {t('多密钥管理')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => detectChannelUpstreamUpdates(record)}
                          >
                            <RotateCcw className='mr-2 h-4 w-4' />
                            {t('检测上游更新')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openUpstreamUpdateModal(record)}
                          >
                            <RotateCcw className='mr-2 h-4 w-4' />
                            {t('处理上游更新')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              manageChannel(
                                record.id,
                                Number(record.status) === 1
                                  ? 'disable'
                                  : 'enable',
                                record,
                              )
                            }
                          >
                            <Shield className='mr-2 h-4 w-4' />
                            {Number(record.status) === 1
                              ? t('禁用渠道')
                              : t('启用渠道')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className='text-red-600 focus:text-red-600'
                            onClick={() =>
                              manageChannel(record.id, 'delete', record)
                            }
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            {t('删除渠道')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
        </Table>
      </div>

      <div className='flex flex-col gap-4 border-t border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between'>
        <div className='text-sm text-slate-500'>
          {t('已选择')} {selectedChannels.length} {t('个渠道')}
        </div>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-center'>
          <div className='flex items-center gap-2 text-sm text-slate-500'>
            <span>{t('每页')}</span>
            <select
              className='h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700'
              value={pageSize}
              onChange={(event) =>
                handlePageSizeChange(Number(event.target.value))
              }
            >
              {[10, 20, 50, 100].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className='flex items-center gap-2 overflow-x-auto pb-1'>
            <Button
              variant='outline'
              disabled={activePage <= 1}
              onClick={() => handlePageChange(activePage - 1)}
            >
              {t('上一页')}
            </Button>
            {renderPageButtons(activePage, totalPages, handlePageChange)}
            <Button
              variant='outline'
              disabled={activePage >= totalPages}
              onClick={() => handlePageChange(activePage + 1)}
            >
              {t('下一页')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
