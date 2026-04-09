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
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Grid3X3,
  List,
  Search,
} from 'lucide-react';
import { useModelPricingData } from '../../../hooks/model-pricing/useModelPricingData';
import { calculateModelPrice, getLobeHubIcon, stringToColor } from '../../../helpers';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../primitives/accordion';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { Card, CardContent } from '../../primitives/card';
import { Checkbox } from '../../primitives/checkbox';
import { Input } from '../../primitives/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../primitives/select';

const TOP_TABS = ['text', 'image', 'video', 'audio', 'embeddings', 'rerank'];

const SERIES_OPTIONS = ['GPT', 'Claude', 'Gemini', 'Seed', 'Kling', 'Vidu'];
const PROVIDER_ORDER = [
  'OpenAI',
  'Google',
  'Anthropic',
  'ByteDance',
  'MiniMax',
  'Kling',
  'Vidu',
  'PixVerse',
];

const parseTags = (value) =>
  String(value || '')
    .split(/[,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const getModelTimestamp = (model) => {
  const raw = model?.updated_time || model?.created_time || 0;
  const ts = Number(raw);
  if (!Number.isFinite(ts) || ts <= 0) {
    return 0;
  }
  return ts > 9999999999 ? ts : ts * 1000;
};

const formatDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const detectModalities = (model) => {
  const haystack = [
    model?.model_name || '',
    model?.description || '',
    model?.tags || '',
    ...(Array.isArray(model?.supported_endpoint_types)
      ? model.supported_endpoint_types
      : []),
  ]
    .join(' ')
    .toLowerCase();
  const set = new Set();
  if (
    haystack.includes('embedding') ||
    haystack.includes('embed') ||
    haystack.includes('text-embedding')
  ) {
    set.add('embeddings');
  }
  if (haystack.includes('rerank') || haystack.includes('re-rank')) {
    set.add('rerank');
  }
  if (
    haystack.includes('image') ||
    haystack.includes('vision') ||
    haystack.includes('midjourney') ||
    haystack.includes('dall') ||
    haystack.includes('flux') ||
    haystack.includes('seedream')
  ) {
    set.add('image');
  }
  if (
    haystack.includes('video') ||
    haystack.includes('sora') ||
    haystack.includes('kling') ||
    haystack.includes('vidu') ||
    haystack.includes('pixverse') ||
    haystack.includes('cogvideo')
  ) {
    set.add('video');
  }
  if (
    haystack.includes('audio') ||
    haystack.includes('speech') ||
    haystack.includes('voice') ||
    haystack.includes('whisper') ||
    haystack.includes('tts')
  ) {
    set.add('audio');
  }
  if (set.size === 0 || haystack.includes('chat') || haystack.includes('text')) {
    set.add('text');
  }
  return set;
};

const detectSeries = (model) => {
  const text = `${model?.model_name || ''} ${model?.description || ''}`.toLowerCase();
  if (text.includes('gpt')) return 'GPT';
  if (text.includes('claude')) return 'Claude';
  if (text.includes('gemini')) return 'Gemini';
  if (text.includes('seed')) return 'Seed';
  if (text.includes('kling')) return 'Kling';
  if (text.includes('vidu')) return 'Vidu';
  return null;
};

const extractContextLength = (model) => {
  const direct =
    Number(model?.context_length) ||
    Number(model?.max_tokens) ||
    Number(model?.max_context_tokens) ||
    Number(model?.max_input_tokens) ||
    0;
  if (direct > 0) {
    return direct;
  }
  const text = `${model?.model_name || ''} ${model?.description || ''}`.toLowerCase();
  const matched = text.match(/(\d+)\s*(k|m)\s*context/);
  if (!matched) {
    return 0;
  }
  const value = Number(matched[1]);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return matched[2] === 'm' ? value * 1000000 : value * 1000;
};

const formatContextBadge = (contextLength) => {
  if (!contextLength) return null;
  if (contextLength >= 1000000) {
    return `${Math.round(contextLength / 1000000)}M context`;
  }
  if (contextLength >= 1000) {
    return `${Math.round(contextLength / 1000)}K context`;
  }
  return `${contextLength} context`;
};

const parseNumericPrice = (value) => {
  const parsed = Number.parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
};

const getProviderName = (model) => model?.vendor_name || 'Unknown';

const FilterCheckboxItem = ({ label, count, checked, onCheckedChange }) => (
  <label className='flex cursor-pointer items-center justify-between py-1 text-sm'>
    <span className='flex items-center gap-2 text-foreground'>
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      {label}
    </span>
    <span className='text-xs text-muted-foreground'>{count}</span>
  </label>
);

const getModelLogoNode = (model) => {
  if (model?.icon) {
    return getLobeHubIcon(model.icon, 20);
  }
  if (model?.vendor_icon) {
    return getLobeHubIcon(model.vendor_icon, 20);
  }
  const letter = String(getProviderName(model)).slice(0, 1).toUpperCase();
  return <span className='text-xs font-semibold'>{letter}</span>;
};

const ModelsExplorerPage = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState('list');
  const [activeTopTab, setActiveTopTab] = useState('text');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedModalities, setSelectedModalities] = useState(['text']);
  const [selectedContextFilters, setSelectedContextFilters] = useState([]);
  const [selectedPricingFilters, setSelectedPricingFilters] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedProviders, setSelectedProviders] = useState([]);

  const {
    models,
    loading,
    searchValue,
    handleChange,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    selectedGroup,
    groupRatio,
    groupModelRatio,
    tokenUnit,
    displayPrice,
    copyText,
  } = useModelPricingData();

  useEffect(() => {
    if (pageSize !== 20) {
      setPageSize(20);
    }
  }, [pageSize, setPageSize]);

  const searchableModels = useMemo(() => {
    if (!searchValue) {
      return models || [];
    }
    const keyword = String(searchValue).toLowerCase().trim();
    return (models || []).filter((model) => {
      const text = [
        model?.model_name || '',
        model?.description || '',
        model?.tags || '',
        getProviderName(model),
      ]
        .join(' ')
        .toLowerCase();
      return text.includes(keyword);
    });
  }, [models, searchValue]);

  const providersWithCount = useMemo(() => {
    const counter = new Map();
    searchableModels.forEach((model) => {
      const provider = getProviderName(model);
      counter.set(provider, (counter.get(provider) || 0) + 1);
    });
    const sorted = [...counter.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    const prioritized = [
      ...PROVIDER_ORDER.map((name) => sorted.find((item) => item[0] === name)).filter(Boolean),
      ...sorted.filter((item) => !PROVIDER_ORDER.includes(item[0])),
    ];
    return prioritized.map(([name, count]) => ({ name, count }));
  }, [searchableModels]);

  const categoryWithCount = useMemo(() => {
    const counter = new Map();
    searchableModels.forEach((model) => {
      parseTags(model.tags).forEach((tag) => {
        counter.set(tag, (counter.get(tag) || 0) + 1);
      });
    });
    return [...counter.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [searchableModels]);

  const seriesWithCount = useMemo(() => {
    const counter = new Map();
    SERIES_OPTIONS.forEach((series) => counter.set(series, 0));
    searchableModels.forEach((model) => {
      const series = detectSeries(model);
      if (series) {
        counter.set(series, (counter.get(series) || 0) + 1);
      }
    });
    return [...counter.entries()].map(([name, count]) => ({ name, count }));
  }, [searchableModels]);

  const sideFilteredModels = useMemo(() => {
    return searchableModels.filter((model) => {
      const modalities = detectModalities(model);
      if (selectedModalities.length > 0) {
        const modalityMatched = selectedModalities.some((m) => modalities.has(m));
        if (!modalityMatched) return false;
      }

      if (selectedSeries.length > 0) {
        const series = detectSeries(model);
        if (!series || !selectedSeries.includes(series)) return false;
      }

      if (selectedProviders.length > 0) {
        if (!selectedProviders.includes(getProviderName(model))) return false;
      }

      if (selectedCategories.length > 0) {
        const tags = parseTags(model.tags).map((tag) => tag.toLowerCase());
        const hasCategory = selectedCategories.some((category) =>
          tags.includes(category.toLowerCase()),
        );
        if (!hasCategory) return false;
      }

      const contextLength = extractContextLength(model);
      if (selectedContextFilters.length > 0) {
        const contextMatched = selectedContextFilters.some((filterKey) => {
          if (filterKey === 'short') return contextLength > 0 && contextLength < 128000;
          if (filterKey === 'medium')
            return contextLength >= 128000 && contextLength < 512000;
          if (filterKey === 'long') return contextLength >= 512000;
          return true;
        });
        if (!contextMatched) return false;
      }

      if (selectedPricingFilters.length > 0) {
        const priceData = calculateModelPrice({
          record: model,
          selectedGroup,
          groupRatio,
          groupModelRatio,
          tokenUnit,
          displayPrice,
          currency: 'USD',
          quotaDisplayType: 'USD',
        });
        const input = parseNumericPrice(priceData?.inputPrice || model?.model_price);
        const matched = selectedPricingFilters.some((filterKey) => {
          if (filterKey === 'low') return input < 1;
          if (filterKey === 'mid') return input >= 1 && input < 10;
          if (filterKey === 'high') return input >= 10;
          return true;
        });
        if (!matched) return false;
      }

      return true;
    });
  }, [
    searchableModels,
    selectedModalities,
    selectedSeries,
    selectedProviders,
    selectedCategories,
    selectedContextFilters,
    selectedPricingFilters,
    selectedGroup,
    groupRatio,
    groupModelRatio,
    tokenUnit,
    displayPrice,
  ]);

  const topTabCounts = useMemo(() => {
    const counter = {
      text: 0,
      image: 0,
      video: 0,
      audio: 0,
      embeddings: 0,
      rerank: 0,
    };
    sideFilteredModels.forEach((model) => {
      const modalities = detectModalities(model);
      TOP_TABS.forEach((tab) => {
        if (modalities.has(tab)) {
          counter[tab] += 1;
        }
      });
    });
    return counter;
  }, [sideFilteredModels]);

  const modalityFilteredModels = useMemo(
    () =>
      sideFilteredModels.filter((model) =>
        detectModalities(model).has(activeTopTab),
      ),
    [sideFilteredModels, activeTopTab],
  );

  const sortedModels = useMemo(() => {
    const rows = [...modalityFilteredModels];
    if (sortBy === 'newest') {
      rows.sort((a, b) => getModelTimestamp(b) - getModelTimestamp(a));
    }
    return rows;
  }, [modalityFilteredModels, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedModels.length / 20));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchValue,
    activeTopTab,
    selectedModalities,
    selectedContextFilters,
    selectedPricingFilters,
    selectedSeries,
    selectedCategories,
    selectedProviders,
    setCurrentPage,
  ]);

  useEffect(() => {
    if (safePage !== currentPage) {
      setCurrentPage(safePage);
    }
  }, [safePage, currentPage, setCurrentPage]);

  const pagedModels = useMemo(() => {
    const offset = (safePage - 1) * 20;
    return sortedModels.slice(offset, offset + 20);
  }, [safePage, sortedModels]);

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + 4);
    const pages = [];
    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }
    return pages;
  }, [safePage, totalPages]);

  const toggleArrayValue = (setFn, value) => {
    setFn((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  };

  return (
    <div className='w-full bg-white font-["Geist","Inter","system-ui",-apple-system,sans-serif] text-foreground'>
      <div className='mx-auto flex w-full max-w-[1500px] gap-6 px-6 py-6'>
        <aside className='sticky top-20 h-[calc(100vh-6rem)] w-[220px] shrink-0 overflow-y-auto rounded-xl border border-border bg-[#f9fafb] p-3'>
          <Accordion
            type='multiple'
            defaultValue={[
              'modalities',
              'context',
              'pricing',
              'series',
              'categories',
              'providers',
            ]}
          >
            <AccordionItem value='modalities'>
              <AccordionTrigger>{t('Input Modalities')}</AccordionTrigger>
              <AccordionContent>
                {[
                  ['text', 'Text'],
                  ['image', 'Image'],
                  ['audio', 'Audio'],
                  ['video', 'Video'],
                ].map(([key, label]) => (
                  <FilterCheckboxItem
                    key={key}
                    label={label}
                    count={topTabCounts[key] || 0}
                    checked={selectedModalities.includes(key)}
                    onCheckedChange={() => toggleArrayValue(setSelectedModalities, key)}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* Context Length and Prompt Pricing filters removed — API does not return context/pricing filter data */}

            <AccordionItem value='series'>
              <AccordionTrigger>{t('Series')}</AccordionTrigger>
              <AccordionContent>
                {seriesWithCount.map((item) => (
                  <FilterCheckboxItem
                    key={item.name}
                    label={item.name}
                    count={item.count}
                    checked={selectedSeries.includes(item.name)}
                    onCheckedChange={() => toggleArrayValue(setSelectedSeries, item.name)}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value='categories'>
              <AccordionTrigger>{t('Categories')}</AccordionTrigger>
              <AccordionContent>
                {categoryWithCount.slice(0, 18).map((item) => (
                  <FilterCheckboxItem
                    key={item.name}
                    label={item.name}
                    count={item.count}
                    checked={selectedCategories.includes(item.name)}
                    onCheckedChange={() => toggleArrayValue(setSelectedCategories, item.name)}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value='providers'>
              <AccordionTrigger>{t('Providers')}</AccordionTrigger>
              <AccordionContent>
                {providersWithCount.map((item) => (
                  <FilterCheckboxItem
                    key={item.name}
                    label={item.name}
                    count={item.count}
                    checked={selectedProviders.includes(item.name)}
                    onCheckedChange={() => toggleArrayValue(setSelectedProviders, item.name)}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>

        <main className='min-w-0 flex-1'>
          <div className='mb-4 border-b border-border pb-4'>
            <h1 className='text-2xl font-extrabold tracking-tight'>{t('Models')}</h1>

            <div className='mt-3 flex flex-wrap items-center gap-2'>
              {TOP_TABS.map((tab) => (
                <button
                  key={tab}
                  type='button'
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    activeTopTab === tab
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-border bg-white text-foreground hover:border-indigo-300'
                  }`}
                  onClick={() => {
                    setActiveTopTab(tab);
                    if (!selectedModalities.includes(tab)) {
                      setSelectedModalities((prev) => [...prev, tab]);
                    }
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)} ({topTabCounts[tab] || 0})
                </button>
              ))}
            </div>

            <div className='mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
              <div className='w-full md:max-w-md'>
                <Input
                  value={searchValue}
                  onChange={(event) => handleChange(event.target.value)}
                  placeholder='Search models...'
                  icon={<Search className='h-4 w-4' />}
                />
              </div>

              <div className='flex items-center gap-2'>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className='h-9 w-[130px]'>
                    <SelectValue placeholder='Sort' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value='newest'>Newest</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Button
                  size='sm'
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className='h-4 w-4' />
                </Button>
                <Button
                  size='sm'
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  onClick={() => setViewMode('list')}
                >
                  <List className='h-4 w-4' />
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className='rounded-xl border border-border p-8 text-center text-sm text-muted-foreground'>
              {t('正在加载模型数据...')}
            </div>
          ) : null}

          {!loading && pagedModels.length === 0 ? (
            <div className='rounded-xl border border-border p-8 text-center text-sm text-muted-foreground'>
              {t('未找到符合条件的模型')}
            </div>
          ) : null}

          {!loading && pagedModels.length > 0 && viewMode === 'list' ? (
            <div className='rounded-xl border border-border bg-white'>
              {pagedModels.map((model, index) => {
                const priceData = calculateModelPrice({
                  record: model,
                  selectedGroup,
                  groupRatio,
                  groupModelRatio,
                  tokenUnit,
                  displayPrice,
                  currency: 'USD',
                  quotaDisplayType: 'USD',
                });
                return (
                  <div
                    key={model.key || model.model_name || index}
                    className='border-b border-border px-4 py-4 last:border-b-0'
                  >
                    <div className='flex items-start justify-between gap-4'>
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <h2 className='text-[18px] font-bold leading-6 text-foreground'>
                            {model.model_name}
                          </h2>
                          <Button
                            size='sm'
                            variant='outline'
                            className='h-7 px-2'
                            onClick={() => copyText(model.model_name)}
                          >
                            <Copy className='h-3.5 w-3.5' />
                          </Button>
                          {formatContextBadge(extractContextLength(model)) && (
                            <Badge variant='outline' className='rounded-full text-xs'>
                              {formatContextBadge(extractContextLength(model))}
                            </Badge>
                          )}
                        </div>

                        <p className='mt-1 line-clamp-2 text-sm text-muted-foreground'>
                          {model.description || '-'}
                        </p>

                        <p className='mt-2 text-xs text-muted-foreground'>
                          by {getProviderName(model)}
                          {formatDate(getModelTimestamp(model)) ? ` | ${formatDate(getModelTimestamp(model))}` : ''}
                          {' | '}{priceData?.inputPrice || '-'} /M input | {priceData?.completionPrice || '-'} /M output
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!loading && pagedModels.length > 0 && viewMode === 'grid' ? (
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {pagedModels.map((model, index) => {
                const priceData = calculateModelPrice({
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
                  <Card
                    key={model.key || model.model_name || index}
                    className='border-border bg-white'
                  >
                    <CardContent className='space-y-3 p-4'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='flex min-w-0 items-center gap-2'>
                          <div className='flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted'>
                            {getModelLogoNode(model)}
                          </div>
                          <div className='min-w-0'>
                            <p className='truncate font-semibold'>{model.model_name}</p>
                            <p className='text-xs text-muted-foreground'>{getProviderName(model)}</p>
                          </div>
                        </div>
                        <Button
                          size='sm'
                          variant='outline'
                          className='h-7 px-2'
                          onClick={() => copyText(model.model_name)}
                        >
                          <Copy className='h-3.5 w-3.5' />
                        </Button>
                      </div>

                      <div className='grid grid-cols-2 gap-2 text-sm'>
                        <div className='rounded-md border border-border p-2'>
                          <div className='text-xs text-muted-foreground'>Input</div>
                          <div className='font-semibold'>{priceData?.inputPrice || '-'}</div>
                        </div>
                        <div className='rounded-md border border-border p-2'>
                          <div className='text-xs text-muted-foreground'>Output</div>
                          <div className='font-semibold'>{priceData?.completionPrice || '-'}</div>
                        </div>
                      </div>

                      <p className='line-clamp-2 text-xs text-muted-foreground'>
                        {model.description || '-'}
                      </p>

                      <div className='flex flex-wrap gap-1.5'>
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
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}

          {!loading && totalPages > 1 ? (
            <div className='mt-6 flex items-center justify-center gap-1'>
              <Button
                size='sm'
                variant='outline'
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(safePage - 1)}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              {pageNumbers.map((page) => (
                <Button
                  key={page}
                  size='sm'
                  variant={safePage === page ? 'default' : 'outline'}
                  onClick={() => setCurrentPage(page)}
                  className='min-w-8'
                >
                  {page}
                </Button>
              ))}
              <Button
                size='sm'
                variant='outline'
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(safePage + 1)}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default ModelsExplorerPage;
