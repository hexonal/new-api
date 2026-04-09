import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Copy, RefreshCw, Search } from 'lucide-react';
import { useChannelsData } from '../../../hooks/channels/useChannelsData';
import { CHANNEL_OPTIONS } from '../../../constants';
import { cn } from '../../lib/cn';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../primitives/card';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Badge } from '../../primitives/badge';
import { Switch } from '../../primitives/switch';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import ChannelTypeTab from './components/ChannelTypeTab';

const typeLabelMap = new Map(CHANNEL_OPTIONS.map((item) => [String(item.value), item.label]));

const getTypeLabel = (type) => {
  const key = String(type);
  return typeLabelMap.get(key) || key;
};

export default function ChannelListPage() {
  const navigate = useNavigate();
  const channelsData = useChannelsData();
  const [keyword, setKeyword] = useState('');

  const {
    channels,
    loading,
    searching,
    activeTypeKey,
    setActiveTypeKey,
    channelTypeCounts,
    availableTypeKeys,
    handlePageChange,
    handlePageSizeChange,
    activePage,
    pageSize,
    channelCount,
    idSort,
    enableTagMode,
    statusFilter,
    loadChannels,
    manageChannel,
    copySelectedChannel,
    updateChannelBalance,
    updateAllChannelsBalance,
    refresh,
    t,
  } = channelsData;

  const typeOptions = useMemo(() => {
    return availableTypeKeys.map((key) => ({
      value: key,
      label: key === 'all' ? t('全部') : `${getTypeLabel(key)} (${channelTypeCounts[key] || 0})`,
    }));
  }, [availableTypeKeys, channelTypeCounts, t]);

  const filteredRows = useMemo(() => {
    const list = Array.isArray(channels) ? channels : [];
    if (!keyword.trim()) {
      return list;
    }
    const lower = keyword.toLowerCase();
    return list.filter((item) => {
      const name = String(item?.name || '').toLowerCase();
      const group = String(item?.group || '').toLowerCase();
      const type = String(item?.type || '').toLowerCase();
      return name.includes(lower) || group.includes(lower) || type.includes(lower);
    });
  }, [channels, keyword]);

  const totalPages = Math.max(1, Math.ceil((channelCount || 0) / Math.max(1, pageSize || 10)));

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-base'>{t('渠道管理')}</CardTitle>
          <CardDescription>{t('支持类型筛选、状态切换、复制渠道与余额刷新')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
            <ChannelTypeTab
              value={activeTypeKey}
              options={typeOptions}
              onChange={(nextKey) => {
                setActiveTypeKey(nextKey);
                loadChannels(1, pageSize, idSort, enableTagMode, nextKey, statusFilter);
              }}
            />
            <div className='flex flex-wrap items-center gap-2'>
              <Button variant='outline' size='sm' onClick={() => refresh()}>
                <RefreshCw className='mr-1 h-3.5 w-3.5' />
                {t('刷新')}
              </Button>
              <Button variant='outline' size='sm' onClick={() => updateAllChannelsBalance()}>
                <RefreshCw className='mr-1 h-3.5 w-3.5' />
                {t('刷新全部余额')}
              </Button>
              <Button size='sm' onClick={() => navigate('/console/channel/create')}>
                <Plus className='mr-1 h-3.5 w-3.5' />
                {t('新建渠道')}
              </Button>
            </div>
          </div>

          <div className='max-w-sm'>
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t('按名称 / 分组 / 类型过滤当前页')}
              icon={<Search className='h-4 w-4' />}
            />
          </div>

          <div className='rounded-lg border border-border'>
            <Table>
              <Thead>
                <Tr>
                  <Th>{t('名称')}</Th>
                  <Th>{t('分组')}</Th>
                  <Th>{t('类型')}</Th>
                  <Th>{t('状态')}</Th>
                  <Th>{t('余额')}</Th>
                  <Th className='text-right'>{t('操作')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredRows.map((row) => {
                  const isEnabled = row.status === 1;
                  const isTagRow = Array.isArray(row.children);
                  return (
                    <Tr key={row.key || row.id} className={cn(!isEnabled && 'bg-muted/40')}>
                      <Td>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>{row.name || `#${row.id}`}</span>
                          {isTagRow ? <Badge variant='secondary'>{t('标签聚合')}</Badge> : null}
                        </div>
                      </Td>
                      <Td className='text-muted-foreground'>{row.group || '-'}</Td>
                      <Td>
                        <Badge variant='outline'>{isTagRow ? t('聚合') : getTypeLabel(row.type)}</Badge>
                      </Td>
                      <Td>
                        <div className='flex items-center gap-2'>
                          <Switch
                            checked={isEnabled}
                            disabled={isTagRow}
                            onCheckedChange={(checked) =>
                              manageChannel(
                                row.id,
                                checked ? 'enable' : 'disable',
                                row,
                              )
                            }
                          />
                          <span className='text-xs text-muted-foreground'>
                            {isEnabled ? t('启用') : t('禁用')}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <div className='text-sm'>
                          {typeof row.balance === 'number' ? row.balance.toFixed(4) : '-'}
                        </div>
                      </Td>
                      <Td>
                        <div className='flex justify-end gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            disabled={isTagRow}
                            onClick={() => copySelectedChannel(row)}
                          >
                            <Copy className='mr-1 h-3.5 w-3.5' />
                            {t('复制')}
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            disabled={isTagRow}
                            onClick={() => updateChannelBalance(row)}
                          >
                            <RefreshCw className='mr-1 h-3.5 w-3.5' />
                            {t('余额')}
                          </Button>
                          <Button
                            size='sm'
                            disabled={isTagRow}
                            onClick={() => navigate(`/console/channel/${row.id}/edit`)}
                          >
                            {t('编辑')}
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} className='py-8 text-center text-sm text-muted-foreground'>
                      {t('暂无渠道数据')}
                    </Td>
                  </Tr>
                ) : null}
              </Tbody>
            </Table>
          </div>

          <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div className='text-xs text-muted-foreground'>
              {t('共 {{count}} 条', { count: channelCount || 0 })}
              {(loading || searching) ? ` · ${t('加载中...')}` : ''}
            </div>
            <div className='flex items-center gap-2'>
              <select
                className='h-9 rounded border border-input bg-background px-2 text-sm'
                value={pageSize}
                onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
              <Button
                variant='outline'
                size='sm'
                disabled={activePage <= 1}
                onClick={() => handlePageChange(activePage - 1)}
              >
                {t('上一页')}
              </Button>
              <span className='text-xs text-muted-foreground'>
                {activePage} / {totalPages}
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={activePage >= totalPages}
                onClick={() => handlePageChange(activePage + 1)}
              >
                {t('下一页')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
