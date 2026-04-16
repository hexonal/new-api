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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Video,
  AudioLines,
} from 'lucide-react';
import { useModelsData } from '../../../hooks/models/useModelsData';
import { cn } from '../../lib/cn';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../primitives/card';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Badge } from '../../primitives/badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import ModelProviderTabs from './components/ModelProviderTabs';
import MissingModelsModal from '../../../components/table/models/modals/MissingModelsModal';
import PrefillGroupManagement from '../../../components/table/models/modals/PrefillGroupManagement';

const parseCsvTags = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseEndpoints = (value) => {
  if (!value) {
    return [];
  }
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    }
    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed);
    }
    return [];
  } catch (_) {
    return [];
  }
};

const getBoundChannelLabel = (channel) => {
  const name = channel?.name || '-';
  const count = channel?.count ?? channel?.type;
  if (count === undefined || count === null || count === '') {
    return name;
  }
  return `${name}(${count})`;
};

const getModelTypeBadges = (row, t) => {
  const tags = parseCsvTags(row?.tags).map((item) => item.toLowerCase());
  const endpoints = parseEndpoints(row?.endpoints).map((item) => item.toLowerCase());
  const keyword = `${row?.model_name || ''} ${row?.description || ''}`.toLowerCase();
  const merged = [...tags, ...endpoints, keyword].join(' ');

  const result = [];
  const hasText =
    merged.includes('text') ||
    merged.includes('chat') ||
    merged.includes('gpt') ||
    merged.includes('claude') ||
    merged.includes('deepseek') ||
    merged.includes('qwen');
  const hasImage =
    merged.includes('image') ||
    merged.includes('vision') ||
    merged.includes('midjourney') ||
    merged.includes('flux') ||
    merged.includes('dall') ||
    merged.includes('sd');
  const hasVideo =
    merged.includes('video') ||
    merged.includes('sora') ||
    merged.includes('kling') ||
    merged.includes('seedance') ||
    merged.includes('veo') ||
    merged.includes('cogvideo');
  const hasAudio =
    merged.includes('audio') ||
    merged.includes('speech') ||
    merged.includes('voice') ||
    merged.includes('whisper') ||
    merged.includes('tts');

  if (hasText || (!hasImage && !hasVideo && !hasAudio)) {
    result.push({ key: 'text', icon: <FileText className='h-3.5 w-3.5' />, label: t('文本') });
  }
  if (hasImage) {
    result.push({ key: 'image', icon: <ImageIcon className='h-3.5 w-3.5' />, label: t('图片') });
  }
  if (hasVideo) {
    result.push({ key: 'video', icon: <Video className='h-3.5 w-3.5' />, label: t('视频') });
  }
  if (hasAudio) {
    result.push({ key: 'audio', icon: <AudioLines className='h-3.5 w-3.5' />, label: t('音频') });
  }

  return result;
};

const renderLimitedBadges = (items, max = 3) => {
  if (!items || items.length === 0) {
    return '-';
  }
  const visible = items.slice(0, max);
  const remain = items.length - visible.length;
  return (
    <div className='flex flex-wrap items-center gap-1'>
      {visible.map((item) => (
        <Badge key={item} variant='outline' className='rounded-full'>
          {item}
        </Badge>
      ))}
      {remain > 0 ? (
        <Badge variant='secondary' className='rounded-full'>
          +{remain}
        </Badge>
      ) : null}
    </div>
  );
};

export default function ModelListPage() {
  const navigate = useNavigate();
  const modelsData = useModelsData();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchVendor, setSearchVendor] = useState('');
  const [showMissingModels, setShowMissingModels] = useState(false);
  const [showPrefillGroupManagement, setShowPrefillGroupManagement] = useState(false);
  const formValuesRef = useRef({
    searchKeyword: '',
    searchVendor: '',
  });

  const {
    models,
    loading,
    searching,
    syncing,
    previewing,
    activePage,
    pageSize,
    modelCount,
    vendors,
    vendorCounts,
    activeVendorKey,
    setActiveVendorKey,
    handlePageChange,
    handlePageSizeChange,
    manageModel,
    refresh,
    compactMode,
    setCompactMode,
    syncUpstream,
    setFormApi,
    t,
  } = modelsData;

  useEffect(() => {
    formValuesRef.current = {
      searchKeyword,
      searchVendor,
    };
  }, [searchKeyword, searchVendor]);

  useEffect(() => {
    setFormApi({
      getValues: () => formValuesRef.current,
      reset: () => {
        setSearchKeyword('');
        setSearchVendor('');
      },
    });
  }, [setFormApi]);

  const providerOptions = useMemo(() => {
    const dynamic = (vendors || []).map((item) => ({
      value: String(item.id),
      label: `${item.name} (${vendorCounts[item.id] || 0})`,
    }));
    return [{ value: 'all', label: `${t('全部')} (${vendorCounts.all || modelCount || 0})` }, ...dynamic];
  }, [vendors, vendorCounts, modelCount, t]);

  const totalPages = Math.max(1, Math.ceil((modelCount || 0) / Math.max(1, pageSize || 10)));

  return (
    <div className='space-y-4'>
      <MissingModelsModal
        visible={showMissingModels}
        onClose={() => setShowMissingModels(false)}
        onConfigureModel={(name) => {
          navigate(`/console/models/create?name=${encodeURIComponent(name)}`);
          setShowMissingModels(false);
        }}
        t={t}
      />
      <PrefillGroupManagement
        visible={showPrefillGroupManagement}
        onClose={() => setShowPrefillGroupManagement(false)}
      />

      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-base'>{t('模型管理')}</CardTitle>
          <CardDescription>{t('支持供应商标签筛选、状态切换与快速编辑')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col gap-3'>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
              <ModelProviderTabs
                value={String(activeVendorKey)}
                options={providerOptions}
                onChange={(value) => {
                  setActiveVendorKey(value);
                  handlePageChange(1);
                }}
              />
              <div className='flex flex-wrap items-center gap-2'>
                <Button variant='outline' size='sm' onClick={() => refresh()}>
                  <RefreshCw className='mr-1 h-3.5 w-3.5' />
                  {t('刷新')}
                </Button>
                <Button variant='outline' size='sm' onClick={() => setShowMissingModels(true)}>
                  {t('未配置模型')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => syncUpstream({ locale: 'zh' })}
                  loading={syncing || previewing}
                >
                  {t('同步')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setShowPrefillGroupManagement(true)}
                >
                  {t('预填组管理')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setCompactMode(!compactMode)}
                >
                  {t('紧凑列表')}
                </Button>
                <Button size='sm' onClick={() => navigate('/console/models/create')}>
                  <Plus className='mr-1 h-3.5 w-3.5' />
                  {t('新增模型')}
                </Button>
              </div>
            </div>

            <div className='grid w-full max-w-2xl grid-cols-1 gap-2 md:grid-cols-2'>
              <Input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder={t('搜索模型名称')}
                icon={<Search className='h-4 w-4' />}
              />
              <Input
                value={searchVendor}
                onChange={(event) => setSearchVendor(event.target.value)}
                placeholder={t('搜索供应商')}
                icon={<Search className='h-4 w-4' />}
              />
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => modelsData.searchModels()}
                loading={loading || searching}
              >
                {t('查询')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setSearchKeyword('');
                  setSearchVendor('');
                  formValuesRef.current = {
                    searchKeyword: '',
                    searchVendor: '',
                  };
                  modelsData.searchModels();
                }}
              >
                {t('重置')}
              </Button>
            </div>
          </div>

          <div className='rounded-lg border border-border'>
            <Table>
              <Thead>
                <Tr>
                  <Th>{t('图标')}</Th>
                  <Th>{t('模型名称')}</Th>
                  <Th>{t('匹配类型')}</Th>
                  <Th>{t('参与官方同步')}</Th>
                  <Th>{t('供应商')}</Th>
                  <Th>{t('描述')}</Th>
                  <Th>{t('标签')}</Th>
                  <Th>{t('端点')}</Th>
                  <Th>{t('已绑定渠道')}</Th>
                  <Th>{t('状态')}</Th>
                  <Th className='text-right'>{t('操作')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(models || []).map((row) => {
                  const enabled = row.status === 1;
                  const types = getModelTypeBadges(row, t);
                  const tags = parseCsvTags(row.tags);
                  const endpoints = parseEndpoints(row.endpoints);
                  const channels = Array.isArray(row.bound_channels) ? row.bound_channels : [];
                  return (
                    <Tr key={row.id} className={cn(!enabled && 'bg-muted/40')}>
                      <Td className={compactMode ? 'py-1.5' : ''}>
                        <div className='flex flex-wrap items-center gap-1'>
                          {types.map((item) => (
                            <Badge key={item.key} variant='outline' className='rounded-full px-1.5'>
                              <span className='inline-flex items-center gap-1'>
                                {item.icon}
                                <span className='text-[10px]'>{item.label}</span>
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </Td>
                      <Td className={compactMode ? 'py-1.5' : ''}>
                        <div className='font-medium'>{row.model_name}</div>
                      </Td>
                      <Td className={compactMode ? 'py-1.5' : ''}>
                        <Badge variant='secondary' className='bg-emerald-100 text-emerald-700'>
                          {t('精确')}
                        </Badge>
                      </Td>
                      <Td className={compactMode ? 'py-1.5' : ''}>
                        <Badge variant={Number(row.sync_official) === 1 ? 'secondary' : 'outline'}>
                          {Number(row.sync_official) === 1 ? t('是') : t('否')}
                        </Badge>
                      </Td>
                      <Td className={compactMode ? 'py-1.5' : ''}>
                        <Badge variant='outline'>{row.vendor || '-'}</Badge>
                      </Td>
                      <Td className={cn('max-w-[280px] text-sm text-muted-foreground', compactMode ? 'py-1.5' : '')}>
                        <div className='line-clamp-2'>{row.description || '-'}</div>
                      </Td>
                      <Td className={compactMode ? 'py-1.5' : ''}>{renderLimitedBadges(tags, 3)}</Td>
                      <Td className={compactMode ? 'py-1.5' : ''}>{renderLimitedBadges(endpoints, 3)}</Td>
                      <Td className={compactMode ? 'py-1.5' : ''}>
                        {channels.length === 0 ? (
                          '-'
                        ) : (
                          <div className='flex flex-wrap items-center gap-1'>
                            {channels.slice(0, 3).map((channel, idx) => (
                              <Button
                                key={`${channel?.id || channel?.name || 'channel'}-${idx}`}
                                size='sm'
                                variant='link'
                                className='h-auto px-0 text-xs'
                                onClick={() => navigate('/console/channel')}
                              >
                                {getBoundChannelLabel(channel)}
                              </Button>
                            ))}
                            {channels.length > 3 ? (
                              <Badge variant='secondary' className='rounded-full'>
                                +{channels.length - 3}
                              </Badge>
                            ) : null}
                          </div>
                        )}
                      </Td>
                      <Td className={compactMode ? 'py-1.5' : ''}>
                        <Badge variant={enabled ? 'secondary' : 'destructive'}>
                          {enabled ? t('启用') : t('禁用')}
                        </Badge>
                      </Td>
                      <Td className={compactMode ? 'py-1.5' : ''}>
                        <div className='flex justify-end gap-2'>
                          {enabled ? (
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => manageModel(row.id, 'disable', row)}
                            >
                              {t('禁用')}
                            </Button>
                          ) : (
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => manageModel(row.id, 'enable', row)}
                            >
                              {t('启用')}
                            </Button>
                          )}
                          <Button size='sm' onClick={() => navigate(`/console/models/${row.id}/edit`)}>
                            {t('编辑')}
                          </Button>
                          <Button
                            variant='destructive'
                            size='sm'
                            onClick={() => manageModel(row.id, 'delete', row)}
                          >
                            {t('删除')}
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
                {(models || []).length === 0 ? (
                  <Tr>
                    <Td colSpan={11} className='py-8 text-center text-sm text-muted-foreground'>
                      {t('暂无模型数据')}
                    </Td>
                  </Tr>
                ) : null}
              </Tbody>
            </Table>
          </div>

          <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div className='text-xs text-muted-foreground'>
              {t('共 {{count}} 条', { count: modelCount || 0 })}
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
