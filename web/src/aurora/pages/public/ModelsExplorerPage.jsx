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
import { Layers3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useModelPricingData } from '../../../hooks/model-pricing/useModelPricingData';
import { Button } from '../../primitives/button';
import { Card, CardContent } from '../../primitives/card';
import { Input } from '../../primitives/input';

const quotaTypeLabel = (quotaType, t) => {
  if (quotaType === 0) {
    return t('文本计费');
  }
  if (quotaType === 1) {
    return t('图像计费');
  }
  return t('未知');
};

const ModelsExplorerPage = () => {
  const { t } = useTranslation();
  const {
    searchValue,
    handleChange,
    filterGroup,
    setFilterGroup,
    filterQuotaType,
    setFilterQuotaType,
    filterEndpointType,
    setFilterEndpointType,
    filterVendor,
    setFilterVendor,
    filterTag,
    setFilterTag,
    usableGroup,
    endpointMap,
    models,
    filteredModels,
    loading,
    displayPrice,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
  } = useModelPricingData();

  const groups = React.useMemo(() => Object.keys(usableGroup || {}), [usableGroup]);
  const endpointKeys = React.useMemo(() => Object.keys(endpointMap || {}), [endpointMap]);
  const vendors = React.useMemo(() => {
    const vendorSet = new Set();
    (models || []).forEach((model) => {
      if (model.vendor_name) {
        vendorSet.add(model.vendor_name);
      }
    });
    return Array.from(vendorSet).sort((a, b) => a.localeCompare(b));
  }, [models]);
  const tags = React.useMemo(() => {
    const tagSet = new Set();
    (models || []).forEach((model) => {
      if (!model.tags) {
        return;
      }
      model.tags
        .split(/[,;|]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => tagSet.add(item));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [models]);

  const totalPages = Math.max(1, Math.ceil(filteredModels.length / pageSize));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const offset = (normalizedCurrentPage - 1) * pageSize;
  const pageModels = filteredModels.slice(offset, offset + pageSize);

  React.useEffect(() => {
    if (currentPage !== normalizedCurrentPage) {
      setCurrentPage(normalizedCurrentPage);
    }
  }, [currentPage, normalizedCurrentPage, setCurrentPage]);

  return (
    <div className='aurora-pricing-page'>
      <div className='aurora-pricing-header'>
        <h1>{t('模型价格一览')}</h1>
        <p>{t('左侧筛选，右侧浏览模型与定价信息')}</p>
      </div>
      <div className='grid gap-4 lg:grid-cols-[280px,1fr]'>
        <Card className='h-fit border-border bg-card lg:sticky lg:top-20'>
          <CardContent className='space-y-4 p-4'>
            <Input
              type='text'
              value={searchValue}
              onChange={(event) => handleChange(event.target.value)}
              placeholder={t('搜索模型 / 供应商 / 标签')}
            />

            <div className='space-y-2'>
              <p className='text-sm font-medium'>{t('分组')}</p>
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant={filterGroup === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterGroup('all')}
                >
                  {t('全部')}
                </Button>
                {groups.map((group) => (
                  <Button
                    key={group}
                    type='button'
                    size='sm'
                    variant={filterGroup === group ? 'default' : 'outline'}
                    onClick={() => setFilterGroup(group)}
                  >
                    {group}
                  </Button>
                ))}
              </div>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>{t('计费类型')}</p>
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant={filterQuotaType === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterQuotaType('all')}
                >
                  {t('全部')}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant={filterQuotaType === 0 ? 'default' : 'outline'}
                  onClick={() => setFilterQuotaType(0)}
                >
                  {t('文本')}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant={filterQuotaType === 1 ? 'default' : 'outline'}
                  onClick={() => setFilterQuotaType(1)}
                >
                  {t('图像')}
                </Button>
              </div>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>{t('端点类型')}</p>
              <select
                className='h-10 w-full rounded-lg border border-input bg-background px-3 text-sm'
                value={filterEndpointType}
                onChange={(event) => setFilterEndpointType(event.target.value)}
              >
                <option value='all'>{t('全部')}</option>
                {endpointKeys.map((endpoint) => (
                  <option key={endpoint} value={endpoint}>
                    {endpoint}
                  </option>
                ))}
              </select>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>{t('供应商')}</p>
              <select
                className='h-10 w-full rounded-lg border border-input bg-background px-3 text-sm'
                value={filterVendor}
                onChange={(event) => setFilterVendor(event.target.value)}
              >
                <option value='all'>{t('全部')}</option>
                <option value='unknown'>{t('未知供应商')}</option>
                {vendors.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>{t('标签')}</p>
              <select
                className='h-10 w-full rounded-lg border border-input bg-background px-3 text-sm'
                value={filterTag}
                onChange={(event) => setFilterTag(event.target.value)}
              >
                <option value='all'>{t('全部')}</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <div className='space-y-3'>
          <div className='flex items-center justify-between text-sm text-muted-foreground'>
            <span>
              {t('共 {{count}} 个模型', { count: filteredModels.length })}
            </span>
            <select
              className='h-8 rounded-md border border-input bg-background px-2 text-sm'
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              <option value={20}>20 / {t('页')}</option>
              <option value={40}>40 / {t('页')}</option>
              <option value={80}>80 / {t('页')}</option>
            </select>
          </div>

          {loading && (
            <Card className='border-border'>
              <CardContent className='p-6 text-center text-muted-foreground'>
                {t('正在加载模型数据...')}
              </CardContent>
            </Card>
          )}

          {!loading && pageModels.length === 0 && (
            <Card className='border-border'>
              <CardContent className='p-6 text-center text-muted-foreground'>
                {t('未找到符合筛选条件的模型')}
              </CardContent>
            </Card>
          )}

          {!loading && pageModels.length > 0 && (
            <div className='grid gap-3'>
              {pageModels.map((item) => (
                <Card key={item.key || item.model_name} className='border-border bg-card'>
                  <CardContent className='space-y-3 p-4'>
                    <div className='flex items-start justify-between gap-2'>
                      <div>
                        <h3 className='text-base font-semibold leading-6 text-foreground'>
                          {item.model_name || t('未知模型')}
                        </h3>
                        <p className='text-sm text-muted-foreground'>
                          {item.vendor_name || t('未知供应商')}
                        </p>
                      </div>
                      <span className='inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground'>
                        <Layers3 size={12} />
                        {quotaTypeLabel(item.quota_type, t)}
                      </span>
                    </div>

                    <div className='grid grid-cols-2 gap-3 text-sm'>
                      <div className='rounded-md border border-border p-2'>
                        <p className='text-muted-foreground'>{t('输入价格')}</p>
                        <p className='font-semibold text-foreground'>
                          {displayPrice(item.input || 0)}
                        </p>
                      </div>
                      <div className='rounded-md border border-border p-2'>
                        <p className='text-muted-foreground'>{t('输出价格')}</p>
                        <p className='font-semibold text-foreground'>
                          {displayPrice(item.output || 0)}
                        </p>
                      </div>
                    </div>

                    {Array.isArray(item.supported_endpoint_types) &&
                      item.supported_endpoint_types.length > 0 && (
                        <div className='flex flex-wrap gap-2'>
                          {item.supported_endpoint_types.map((endpoint) => (
                            <span
                              key={`${item.model_name}-${endpoint}`}
                              className='rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground'
                            >
                              {endpoint}
                            </span>
                          ))}
                        </div>
                      )}

                    {item.tags && (
                      <p className='text-xs text-muted-foreground'>{item.tags}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className='flex items-center justify-center gap-2 py-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={normalizedCurrentPage <= 1}
                onClick={() => setCurrentPage(normalizedCurrentPage - 1)}
              >
                {t('上一页')}
              </Button>
              <span className='text-sm text-muted-foreground'>
                {normalizedCurrentPage} / {totalPages}
              </span>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={normalizedCurrentPage >= totalPages}
                onClick={() => setCurrentPage(normalizedCurrentPage + 1)}
              >
                {t('下一页')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelsExplorerPage;
