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

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, LayoutGrid, List, Search } from 'lucide-react';
import { useModelPricingData } from '../../../hooks/model-pricing/useModelPricingData';
import { usePricingFilterCounts } from '../../../hooks/model-pricing/usePricingFilterCounts';
import { calculateModelPrice, getLobeHubIcon, stringToColor } from '../../../helpers';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { Card, CardContent } from '../../primitives/card';
import { Input } from '../../primitives/input';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../primitives/table';

const parseTags = (value) => {
  if (!value) {
    return [];
  }
  return String(value)
    .split(/[,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseEndpointTypes = (model) => {
  if (!Array.isArray(model?.supported_endpoint_types)) {
    return [];
  }
  return model.supported_endpoint_types
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const FilterSection = ({ title, options, value, onChange }) => (
  <div className='space-y-2'>
    <p className='text-sm font-medium text-foreground'>{title}</p>
    <div className='flex flex-wrap gap-2'>
      {options.map((option) => (
        <Button
          key={option.value}
          size='sm'
          variant={value === option.value ? 'default' : 'outline'}
          className='rounded-full'
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  </div>
);

const getBillingBadge = (quotaType, t) => {
  if (quotaType === 0) {
    return (
      <Badge variant='secondary' className='rounded-full'>
        {t('按量计费')}
      </Badge>
    );
  }
  if (quotaType === 1) {
    return (
      <Badge variant='outline' className='rounded-full'>
        {t('按次计费')}
      </Badge>
    );
  }
  return (
    <Badge variant='outline' className='rounded-full'>
      {t('未知计费')}
    </Badge>
  );
};

const ModelLogo = ({ model }) => {
  if (model?.icon) {
    return (
      <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-muted'>
        {getLobeHubIcon(model.icon, 24)}
      </div>
    );
  }
  if (model?.vendor_icon) {
    return (
      <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-muted'>
        {getLobeHubIcon(model.vendor_icon, 24)}
      </div>
    );
  }
  const letter = String(model?.vendor_name || model?.model_name || '?').slice(0, 1).toUpperCase();
  return (
    <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-secondary-foreground'>
      {letter}
    </div>
  );
};

const ModelCard = ({
  model,
  selectedGroup,
  groupRatio,
  groupModelRatio,
  tokenUnit,
  displayPrice,
  copyText,
  t,
}) => {
  const price = calculateModelPrice({
    record: model,
    selectedGroup,
    groupRatio,
    groupModelRatio,
    tokenUnit,
    displayPrice,
    currency: 'USD',
    quotaDisplayType: 'USD',
  });
  const inputPrice = price?.inputPrice || '-';
  const outputPrice = price?.completionPrice || '-';
  const tags = parseTags(model.tags);

  return (
    <Card className='border-border bg-card'>
      <CardContent className='space-y-3 p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex items-start gap-3'>
            <ModelLogo model={model} />
            <div>
              <p className='text-base font-bold text-foreground'>{model.model_name}</p>
              <p className='text-xs text-muted-foreground'>{model.vendor_name || t('未知供应商')}</p>
            </div>
          </div>
          <Button size='sm' variant='outline' onClick={() => copyText(model.model_name)}>
            <Copy className='h-3.5 w-3.5' />
          </Button>
        </div>

        <div className='grid grid-cols-2 gap-2'>
          <div className='rounded-lg border border-border p-2'>
            <p className='text-xs text-muted-foreground'>{t('输入价格')}</p>
            <p className='text-sm font-semibold'>{inputPrice} / 1M Tokens</p>
          </div>
          <div className='rounded-lg border border-border p-2'>
            <p className='text-xs text-muted-foreground'>{t('补全价格')}</p>
            <p className='text-sm font-semibold'>{outputPrice} / 1M Tokens</p>
          </div>
        </div>

        <p className='line-clamp-2 text-xs text-muted-foreground'>{model.description || '-'}</p>

        <div className='flex flex-wrap items-center gap-1.5'>
          {getBillingBadge(model.quota_type, t)}
          {tags.slice(0, 4).map((tag) => (
            <Badge
              key={`${model.model_name}-tag-${tag}`}
              variant='outline'
              className='rounded-full'
              style={{ borderColor: `${stringToColor(tag)}66` }}
            >
              {tag}
            </Badge>
          ))}
          {tags.length > 4 ? (
            <Badge variant='secondary' className='rounded-full'>
              +{tags.length - 4}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

const ModelListRow = ({
  model,
  selectedGroup,
  groupRatio,
  groupModelRatio,
  tokenUnit,
  displayPrice,
  copyText,
  t,
}) => {
  const price = calculateModelPrice({
    record: model,
    selectedGroup,
    groupRatio,
    groupModelRatio,
    tokenUnit,
    displayPrice,
    currency: 'USD',
    quotaDisplayType: 'USD',
  });
  const tags = parseTags(model.tags);

  return (
    <Tr>
      <Td>
        <div className='flex items-center gap-2'>
          <ModelLogo model={model} />
          <div>
            <p className='font-semibold'>{model.model_name}</p>
            <p className='text-xs text-muted-foreground'>{model.vendor_name || t('未知供应商')}</p>
          </div>
        </div>
      </Td>
      <Td className='text-sm'>{price?.inputPrice || '-'} / 1M</Td>
      <Td className='text-sm'>{price?.completionPrice || '-'} / 1M</Td>
      <Td className='max-w-[320px] text-xs text-muted-foreground'>
        <div className='line-clamp-2'>{model.description || '-'}</div>
      </Td>
      <Td>
        <div className='flex flex-wrap gap-1'>
          {getBillingBadge(model.quota_type, t)}
          {tags.slice(0, 3).map((tag) => (
            <Badge key={`${model.model_name}-list-tag-${tag}`} variant='outline' className='rounded-full'>
              {tag}
            </Badge>
          ))}
          {tags.length > 3 ? (
            <Badge variant='secondary' className='rounded-full'>
              +{tags.length - 3}
            </Badge>
          ) : null}
        </div>
      </Td>
      <Td className='text-right'>
        <Button size='sm' variant='outline' onClick={() => copyText(model.model_name)}>
          <Copy className='h-3.5 w-3.5' />
        </Button>
      </Td>
    </Tr>
  );
};

const ModelsExplorerPage = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState('card');
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
    handleGroupClick,
    usableGroup,
    models,
    filteredModels,
    loading,
    displayPrice,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    groupRatio,
    groupModelRatio,
    selectedGroup,
    tokenUnit,
    copyText,
  } = useModelPricingData();

  useEffect(() => {
    if (pageSize !== 20) {
      setPageSize(20);
    }
  }, [pageSize, setPageSize]);

  const {
    quotaTypeModels,
    endpointTypeModels,
    vendorModels,
    tagModels,
    groupCountModels,
  } = usePricingFilterCounts({
    models,
    filterGroup,
    filterQuotaType,
    filterEndpointType,
    filterVendor,
    filterTag,
    searchValue,
  });

  const vendors = useMemo(() => {
    const counter = {};
    (vendorModels || []).forEach((model) => {
      const key = model.vendor_name || 'unknown';
      counter[key] = (counter[key] || 0) + 1;
    });
    const sorted = Object.entries(counter).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return sorted.map(([key, count]) => ({
      value: key,
      label: key === 'unknown' ? `${t('未知供应商')}(${count})` : `${key}(${count})`,
    }));
  }, [vendorModels, t]);

  const groupOptions = useMemo(() => {
    const allCount = (groupCountModels || []).length;
    const options = [{ value: 'all', label: `${t('全部')}(${allCount})` }];
    Object.keys(usableGroup || {}).forEach((group) => {
      const count = (groupCountModels || []).filter((model) =>
        Array.isArray(model.enable_groups) && model.enable_groups.includes(group),
      ).length;
      options.push({ value: group, label: `${group}(${count})` });
    });
    return options;
  }, [usableGroup, groupCountModels, t]);

  const quotaTypeOptions = useMemo(() => {
    const total = (quotaTypeModels || []).length;
    const amount = (quotaTypeModels || []).filter((model) => model.quota_type === 0).length;
    const count = (quotaTypeModels || []).filter((model) => model.quota_type === 1).length;
    return [
      { value: 'all', label: `${t('全部')}(${total})` },
      { value: 0, label: `${t('按量计费')}(${amount})` },
      { value: 1, label: `${t('按次计费')}(${count})` },
    ];
  }, [quotaTypeModels, t]);

  const tagOptions = useMemo(() => {
    const counter = {};
    (tagModels || []).forEach((model) => {
      parseTags(model.tags).forEach((tag) => {
        const key = tag.toLowerCase();
        counter[key] = (counter[key] || 0) + 1;
      });
    });
    const sorted = Object.entries(counter).sort((a, b) => a[0].localeCompare(b[0]));
    return [
      { value: 'all', label: `${t('全部')}(${(tagModels || []).length})` },
      ...sorted.map(([tag, count]) => ({ value: tag, label: `${tag}(${count})` })),
    ];
  }, [tagModels, t]);

  const endpointOptions = useMemo(() => {
    const counter = {};
    (endpointTypeModels || []).forEach((model) => {
      parseEndpointTypes(model).forEach((endpoint) => {
        counter[endpoint] = (counter[endpoint] || 0) + 1;
      });
    });
    const sorted = Object.entries(counter).sort((a, b) => a[0].localeCompare(b[0]));
    return [
      { value: 'all', label: `${t('全部')}(${(endpointTypeModels || []).length})` },
      ...sorted.map(([endpoint, count]) => ({
        value: endpoint,
        label: `${endpoint}(${count})`,
      })),
    ];
  }, [endpointTypeModels, t]);

  const vendorOptions = useMemo(
    () => [{ value: 'all', label: `${t('全部供应商')}(${(vendorModels || []).length})` }, ...vendors],
    [vendors, vendorModels, t],
  );

  const totalPages = Math.max(1, Math.ceil((filteredModels || []).length / 20));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const start = (normalizedCurrentPage - 1) * 20;
  const pageModels = (filteredModels || []).slice(start, start + 20);

  useEffect(() => {
    if (currentPage !== normalizedCurrentPage) {
      setCurrentPage(normalizedCurrentPage);
    }
  }, [currentPage, normalizedCurrentPage, setCurrentPage]);

  return (
    <div className='space-y-4'>
      <div className='rounded-xl bg-blue-600 px-4 py-3 text-blue-50'>
        <p className='text-sm font-semibold'>
          {filterVendor === 'all' ? t('全部供应商') : filterVendor} · {t('共 {{count}} 个模型', {
            count: (filteredModels || []).length,
          })}
        </p>
      </div>

      <div className='grid gap-4 lg:grid-cols-[320px,1fr]'>
        <Card className='h-fit border-border bg-card'>
          <CardContent className='space-y-4 p-4'>
            <FilterSection
              title={t('供应商')}
              options={vendorOptions}
              value={filterVendor}
              onChange={setFilterVendor}
            />
            <FilterSection
              title={t('可用令牌分组')}
              options={groupOptions}
              value={filterGroup || 'all'}
              onChange={(group) => {
                if (group === 'all') {
                  setFilterGroup('all');
                  return;
                }
                handleGroupClick(group);
              }}
            />
            <FilterSection
              title={t('计费类型')}
              options={quotaTypeOptions}
              value={filterQuotaType}
              onChange={setFilterQuotaType}
            />
            <FilterSection
              title={t('标签')}
              options={tagOptions}
              value={filterTag}
              onChange={setFilterTag}
            />
            <FilterSection
              title={t('端点类型')}
              options={endpointOptions}
              value={filterEndpointType}
              onChange={setFilterEndpointType}
            />
          </CardContent>
        </Card>

        <div className='space-y-3'>
          <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div className='w-full md:max-w-md'>
              <Input
                value={searchValue}
                onChange={(event) => handleChange(event.target.value)}
                placeholder={t('模糊搜索模型名称')}
                icon={<Search className='h-4 w-4' />}
              />
            </div>
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                variant={viewMode === 'card' ? 'default' : 'outline'}
                onClick={() => setViewMode('card')}
              >
                <LayoutGrid className='mr-1 h-3.5 w-3.5' />
                {t('卡片视图')}
              </Button>
              <Button
                size='sm'
                variant={viewMode === 'list' ? 'default' : 'outline'}
                onClick={() => setViewMode('list')}
              >
                <List className='mr-1 h-3.5 w-3.5' />
                {t('列表视图')}
              </Button>
            </div>
          </div>

          {loading ? (
            <Card className='border-border'>
              <CardContent className='p-8 text-center text-sm text-muted-foreground'>
                {t('正在加载模型数据...')}
              </CardContent>
            </Card>
          ) : null}

          {!loading && pageModels.length === 0 ? (
            <Card className='border-border'>
              <CardContent className='p-8 text-center text-sm text-muted-foreground'>
                {t('未找到符合筛选条件的模型')}
              </CardContent>
            </Card>
          ) : null}

          {!loading && pageModels.length > 0 && viewMode === 'card' ? (
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {pageModels.map((model) => (
                <ModelCard
                  key={model.key || model.model_name}
                  model={model}
                  selectedGroup={selectedGroup}
                  groupRatio={groupRatio}
                  groupModelRatio={groupModelRatio}
                  tokenUnit={tokenUnit}
                  displayPrice={displayPrice}
                  copyText={copyText}
                  t={t}
                />
              ))}
            </div>
          ) : null}

          {!loading && pageModels.length > 0 && viewMode === 'list' ? (
            <div className='rounded-lg border border-border'>
              <Table>
                <Thead>
                  <Tr>
                    <Th>{t('模型')}</Th>
                    <Th>{t('输入价格 / 1M')}</Th>
                    <Th>{t('补全价格 / 1M')}</Th>
                    <Th>{t('描述')}</Th>
                    <Th>{t('标签')}</Th>
                    <Th className='text-right'>{t('复制')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pageModels.map((model) => (
                    <ModelListRow
                      key={`list-${model.key || model.model_name}`}
                      model={model}
                      selectedGroup={selectedGroup}
                      groupRatio={groupRatio}
                      groupModelRatio={groupModelRatio}
                      tokenUnit={tokenUnit}
                      displayPrice={displayPrice}
                      copyText={copyText}
                      t={t}
                    />
                  ))}
                </Tbody>
              </Table>
            </div>
          ) : null}

          {!loading && totalPages > 1 ? (
            <div className='flex items-center justify-center gap-2 pt-2'>
              <Button
                size='sm'
                variant='outline'
                disabled={normalizedCurrentPage <= 1}
                onClick={() => setCurrentPage(normalizedCurrentPage - 1)}
              >
                {t('上一页')}
              </Button>
              <span className='text-xs text-muted-foreground'>
                {normalizedCurrentPage} / {totalPages}
              </span>
              <Button
                size='sm'
                variant='outline'
                disabled={normalizedCurrentPage >= totalPages}
                onClick={() => setCurrentPage(normalizedCurrentPage + 1)}
              >
                {t('下一页')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ModelsExplorerPage;
