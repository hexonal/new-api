import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { useModelsData } from '../../../hooks/models/useModelsData';
import { cn } from '../../lib/cn';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../primitives/card';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Badge } from '../../primitives/badge';
import { Switch } from '../../primitives/switch';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';
import ModelProviderTabs from './components/ModelProviderTabs';

const numberFormat = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) {
    return '-';
  }
  return num.toLocaleString();
};

export default function ModelListPage() {
  const navigate = useNavigate();
  const modelsData = useModelsData();
  const [keyword, setKeyword] = useState('');

  const {
    models,
    loading,
    searching,
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
    t,
  } = modelsData;

  const providerOptions = useMemo(() => {
    const dynamic = (vendors || []).map((item) => ({
      value: String(item.id),
      label: `${item.name} (${vendorCounts[item.id] || 0})`,
    }));
    return [{ value: 'all', label: `${t('全部')} (${vendorCounts.all || modelCount || 0})` }, ...dynamic];
  }, [vendors, vendorCounts, modelCount, t]);

  const filteredRows = useMemo(() => {
    if (!keyword.trim()) {
      return models;
    }
    const lower = keyword.toLowerCase();
    return (models || []).filter((item) => {
      const modelName = String(item.model_name || '').toLowerCase();
      const vendorName = String(item.vendor || '').toLowerCase();
      const desc = String(item.description || '').toLowerCase();
      return modelName.includes(lower) || vendorName.includes(lower) || desc.includes(lower);
    });
  }, [models, keyword]);

  const totalPages = Math.max(1, Math.ceil((modelCount || 0) / Math.max(1, pageSize || 10)));

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-base'>{t('模型管理')}</CardTitle>
          <CardDescription>{t('支持供应商标签筛选、状态切换与快速编辑')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
            <ModelProviderTabs
              value={String(activeVendorKey)}
              options={providerOptions}
              onChange={(value) => {
                setActiveVendorKey(value);
                handlePageChange(1);
              }}
            />
            <div className='flex items-center gap-2'>
              <Button variant='outline' size='sm' onClick={() => refresh()}>
                <RefreshCw className='mr-1 h-3.5 w-3.5' />
                {t('刷新')}
              </Button>
              <Button size='sm' onClick={() => navigate('/console/models/create')}>
                <Plus className='mr-1 h-3.5 w-3.5' />
                {t('新增模型')}
              </Button>
            </div>
          </div>

          <div className='max-w-sm'>
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t('按模型名称 / 供应商 / 描述过滤当前页')}
              icon={<Search className='h-4 w-4' />}
            />
          </div>

          <div className='rounded-lg border border-border'>
            <Table>
              <Thead>
                <Tr>
                  <Th>{t('模型名称')}</Th>
                  <Th>{t('供应商')}</Th>
                  <Th>{t('匹配规则')}</Th>
                  <Th>{t('状态')}</Th>
                  <Th>{t('上下文')}</Th>
                  <Th className='text-right'>{t('操作')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(filteredRows || []).map((row) => {
                  const enabled = row.status === 1;
                  return (
                    <Tr key={row.id} className={cn(!enabled && 'bg-muted/40')}>
                      <Td>
                        <div className='font-medium'>{row.model_name}</div>
                        {row.description ? (
                          <div className='text-xs text-muted-foreground mt-0.5 line-clamp-1'>{row.description}</div>
                        ) : null}
                      </Td>
                      <Td>
                        <Badge variant='outline'>{row.vendor || '-'}</Badge>
                      </Td>
                      <Td>
                        <Badge variant='secondary'>{row.name_rule ?? '-'}</Badge>
                      </Td>
                      <Td>
                        <div className='flex items-center gap-2'>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) =>
                              manageModel(row.id, checked ? 'enable' : 'disable', row)
                            }
                          />
                          <span className='text-xs text-muted-foreground'>{enabled ? t('启用') : t('禁用')}</span>
                        </div>
                      </Td>
                      <Td className='text-sm text-muted-foreground'>{numberFormat(row.max_tokens)}</Td>
                      <Td>
                        <div className='flex justify-end gap-2'>
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
                {(filteredRows || []).length === 0 ? (
                  <Tr>
                    <Td colSpan={6} className='py-8 text-center text-sm text-muted-foreground'>
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
