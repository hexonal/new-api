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

import { useEffect, useMemo, useState } from 'react';
import { useModelPricingData } from '../../../../hooks/model-pricing/useModelPricingData';
import { getModelModalities, getModelSeries } from '../models-explorer-data';
import { BASE_MODALITY_KEYS, CATEGORY_PILLS, PAGE_SIZE } from './constants';
import {
  buildDetailAutoChain,
  buildDetailEndpoints,
  buildDetailPricingRows,
  buildPageNumbers,
  formatModelDate,
  formatModelTimestamp,
  getContextBadge,
  getPriceMeta,
  getPrimaryModality,
} from './helpers';

const buildCategoryCountMap = (modelRows) => {
  const countMap = Object.fromEntries(
    CATEGORY_PILLS.map((item) => [item.key, 0]),
  );
  modelRows.forEach((model) => {
    CATEGORY_PILLS.forEach((category) => {
      if (model.modalities.has(category.key)) {
        countMap[category.key] += 1;
      }
    });
  });
  return countMap;
};

const buildSortedOptions = (modelRows, field) => {
  const set = new Set();
  modelRows.forEach((model) => {
    if (model[field]) {
      set.add(model[field]);
    }
  });
  return [...set].sort((a, b) => a.localeCompare(b));
};

const useInjectExplorerFonts = () => {
  useEffect(() => {
    const fontLinkId = 'aurora-model-explorer-fonts';
    if (document.getElementById(fontLinkId)) {
      return undefined;
    }
    const link = document.createElement('link');
    link.id = fontLinkId;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap';
    document.head.appendChild(link);
    return undefined;
  }, []);
};

const toggleArrayItem = (values, target) =>
  values.includes(target)
    ? values.filter((item) => item !== target)
    : [...values, target];

const buildListToggleHandler = (setter) => (value) => {
  setter((prev) => toggleArrayItem(prev, value));
};

const resolveBillingLabel = (quotaType, t) => {
  const normalizedQuotaType = Number(quotaType);
  if (normalizedQuotaType === 1) {
    return t('按次计费');
  }
  if (normalizedQuotaType === 0) {
    return t('按量计费');
  }
  return '-';
};

const useExplorerSelections = () => {
  const [selectedModalities, setSelectedModalities] =
    useState(BASE_MODALITY_KEYS);
  const [selectedSeries, setSelectedSeries] = useState([]);
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('list');
  const [activeCategory, setActiveCategory] = useState('text');

  const toggleModality = (key) => {
    const next = toggleArrayItem(selectedModalities, key);
    setSelectedModalities(next);
    if (!selectedModalities.includes(key)) {
      setActiveCategory(key);
      return;
    }
    if (activeCategory === key) {
      setActiveCategory(next[0] || null);
    }
  };

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    if (
      BASE_MODALITY_KEYS.includes(category) &&
      !selectedModalities.includes(category)
    ) {
      setSelectedModalities((prev) => [...prev, category]);
    }
  };

  return {
    activeCategory,
    handleCategoryClick,
    searchKeyword,
    selectedModalities,
    selectedProviders,
    selectedSeries,
    setSearchKeyword,
    setSortBy,
    setViewMode,
    sortBy,
    toggleModality,
    toggleProvider: buildListToggleHandler(setSelectedProviders),
    toggleSeries: buildListToggleHandler(setSelectedSeries),
    viewMode,
  };
};

const buildModelRow = ({ language, model, t }) => {
  const modalities = getModelModalities(model);
  const provider = model?.vendor_name || t('未知供应商');
  const series = getModelSeries(model);
  return {
    ...model,
    provider,
    series,
    modalities,
    primaryModality: getPrimaryModality(modalities),
    badgeText: getContextBadge(model, modalities, t),
    billingLabel: resolveBillingLabel(model?.quota_type, t),
    timestamp: formatModelTimestamp(model),
    dateText: formatModelDate(model, language),
  };
};

const useExplorerRows = ({ models, language, t }) => {
  const modelRows = useMemo(() => {
    if (!Array.isArray(models)) {
      return [];
    }
    return models.map((model) => buildModelRow({ language, model, t }));
  }, [language, models, t]);

  return {
    categoryCountMap: useMemo(
      () => buildCategoryCountMap(modelRows),
      [modelRows],
    ),
    modelRows,
  };
};

const useExplorerOptionPanels = ({ modelRows }) => {
  const [expanded, setExpanded] = useState({ series: true, providers: true });

  const seriesOptions = useMemo(
    () => buildSortedOptions(modelRows, 'series'),
    [modelRows],
  );
  const providerOptions = useMemo(
    () => buildSortedOptions(modelRows, 'provider'),
    [modelRows],
  );

  return {
    expanded,
    providerOptions,
    setExpanded,
    seriesOptions,
    visibleProviders: providerOptions,
    visibleSeries: seriesOptions,
  };
};

const modelMatchesKeyword = (model, keyword) =>
  [
    model.model_name,
    model.description,
    model.provider,
    model.tags,
    model.series,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(keyword);

const modelPassesFilters = ({
  activeCategory,
  model,
  selectedModalitySet,
  selectedProviderSet,
  selectedSeriesSet,
  shouldApplyBaseModalityFilter,
}) => {
  if (
    shouldApplyBaseModalityFilter &&
    ![...selectedModalitySet].some((modality) => model.modalities.has(modality))
  ) {
    return false;
  }
  if (activeCategory && !model.modalities.has(activeCategory)) {
    return false;
  }
  if (selectedSeriesSet.size > 0 && !selectedSeriesSet.has(model.series)) {
    return false;
  }
  return !(
    selectedProviderSet.size > 0 && !selectedProviderSet.has(model.provider)
  );
};

const getSortOrder = (model) => {
  const value = Number(model?.sort_order ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const sortModels = (models, sortBy) => {
  models.sort((a, b) => {
    const orderDiff = getSortOrder(b) - getSortOrder(a);
    if (orderDiff !== 0) {
      return orderDiff;
    }

    if (sortBy === 'name') {
      return String(a.model_name || '').localeCompare(
        String(b.model_name || ''),
      );
    }
    return (
      b.timestamp - a.timestamp ||
      String(a.model_name || '').localeCompare(String(b.model_name || ''))
    );
  });
  return models;
};

const filterModels = ({
  activeCategory,
  modelRows,
  searchKeyword,
  selectedModalities,
  selectedProviders,
  selectedSeries,
  sortBy,
}) => {
  const keyword = searchKeyword.trim().toLowerCase();
  const selectedModalitySet = new Set(selectedModalities);
  const selectedSeriesSet = new Set(selectedSeries);
  const selectedProviderSet = new Set(selectedProviders);
  const shouldApplyBaseModalityFilter =
    selectedModalitySet.size > 0 &&
    (!activeCategory || BASE_MODALITY_KEYS.includes(activeCategory));

  const results = modelRows.filter((model) => {
    const passesFilters = modelPassesFilters({
      activeCategory,
      model,
      selectedModalitySet,
      selectedProviderSet,
      selectedSeriesSet,
      shouldApplyBaseModalityFilter,
    });
    if (!passesFilters) {
      return false;
    }
    return !keyword || modelMatchesKeyword(model, keyword);
  });

  return sortModels(results, sortBy);
};

const useExplorerFilteredModels = ({
  activeCategory,
  modelRows,
  searchKeyword,
  selectedModalities,
  selectedProviders,
  selectedSeries,
  sortBy,
}) =>
  useMemo(
    () =>
      filterModels({
        activeCategory,
        modelRows,
        searchKeyword,
        selectedModalities,
        selectedProviders,
        selectedSeries,
        sortBy,
      }),
    [
      activeCategory,
      modelRows,
      searchKeyword,
      selectedModalities,
      selectedProviders,
      selectedSeries,
      sortBy,
    ],
  );

const useExplorerPagination = (filteredModels) => {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredModels.length]);

  const totalPages = Math.max(1, Math.ceil(filteredModels.length / PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageNumbers = useMemo(
    () => buildPageNumbers(currentPageSafe, totalPages),
    [currentPageSafe, totalPages],
  );
  const pagedModels = useMemo(() => {
    const start = (currentPageSafe - 1) * PAGE_SIZE;
    return filteredModels.slice(start, start + PAGE_SIZE);
  }, [currentPageSafe, filteredModels]);

  return {
    currentPageSafe,
    pageNumbers,
    pagedModels,
    setCurrentPage,
    totalPages,
  };
};

const useExplorerPriceMeta = ({
  currency,
  displayPrice,
  groupModelRatio,
  groupRatio,
  modelRows,
  selectedGroup,
  siteDisplayType,
  t,
  tokenUnit,
  usableGroup,
}) =>
  useMemo(() => {
    const map = new Map();
    modelRows.forEach((model) => {
      map.set(
        model.model_name,
        getPriceMeta({
          model,
          selectedGroup,
          usableGroup,
          groupRatio,
          groupModelRatio,
          tokenUnit,
          currency,
          siteDisplayType,
          displayPrice,
          t,
        }),
      );
    });
    return map;
  }, [
    currency,
    displayPrice,
    groupModelRatio,
    groupRatio,
    modelRows,
    selectedGroup,
    siteDisplayType,
    t,
    tokenUnit,
    usableGroup,
  ]);

const useDetailEndpointsMemo = (detailModel, endpointMap) =>
  useMemo(
    () => buildDetailEndpoints(detailModel, endpointMap),
    [detailModel, endpointMap],
  );

const useDetailPricingRowsMemo = ({
  currency,
  detailModel,
  displayPrice,
  groupModelRatio,
  groupRatio,
  selectedGroup,
  siteDisplayType,
  t,
  tokenUnit,
  usableGroup,
}) =>
  useMemo(
    () =>
      buildDetailPricingRows({
        detailModel,
        selectedGroup,
        usableGroup,
        groupRatio,
        groupModelRatio,
        tokenUnit,
        currency,
        siteDisplayType,
        displayPrice,
        t,
      }),
    [
      currency,
      detailModel,
      displayPrice,
      groupModelRatio,
      groupRatio,
      selectedGroup,
      siteDisplayType,
      t,
      tokenUnit,
      usableGroup,
    ],
  );

const useDetailAutoChainMemo = (detailModel, autoGroups) =>
  useMemo(
    () => buildDetailAutoChain(detailModel, autoGroups),
    [autoGroups, detailModel],
  );

const useExplorerDetail = ({
  autoGroups,
  currency,
  displayPrice,
  endpointMap,
  groupModelRatio,
  groupRatio,
  selectedGroup,
  siteDisplayType,
  t,
  tokenUnit,
  usableGroup,
}) => {
  const [detailModel, setDetailModel] = useState(null);
  return {
    detailAutoChain: useDetailAutoChainMemo(detailModel, autoGroups),
    detailEndpoints: useDetailEndpointsMemo(detailModel, endpointMap),
    detailModel,
    detailPricingRows: useDetailPricingRowsMemo({
      currency,
      detailModel,
      displayPrice,
      groupModelRatio,
      groupRatio,
      selectedGroup,
      siteDisplayType,
      t,
      tokenUnit,
      usableGroup,
    }),
    setDetailModel,
  };
};

const buildExplorerPageStateResult = ({
  categoryCountMap,
  copyText,
  detail,
  displayPrice,
  filteredModels,
  loading,
  optionPanels,
  pagination,
  priceMetaMap,
  selections,
}) => ({
  categoryCountMap,
  copyText,
  detail,
  displayPrice,
  filteredModels,
  loading,
  optionPanels,
  pagination,
  priceMetaMap,
  selections,
});

const useExplorerBaseState = ({ language, t }) => {
  const pricingData = useModelPricingData();
  const selections = useExplorerSelections();
  const { categoryCountMap, modelRows } = useExplorerRows({
    models: pricingData.models,
    language,
    t,
  });

  const optionPanels = useExplorerOptionPanels({ modelRows });

  return {
    categoryCountMap,
    modelRows,
    optionPanels,
    pricingData,
    selections,
  };
};

const useExplorerFilteredState = ({ modelRows, selections }) =>
  useExplorerFilteredModels({
    activeCategory: selections.activeCategory,
    modelRows,
    searchKeyword: selections.searchKeyword,
    selectedModalities: selections.selectedModalities,
    selectedProviders: selections.selectedProviders,
    selectedSeries: selections.selectedSeries,
    sortBy: selections.sortBy,
  });

const useExplorerPricingAndDetailState = ({
  filteredModels,
  modelRows,
  pricingData,
  t,
}) => {
  const detail = useExplorerDetail({
    autoGroups: pricingData.autoGroups,
    currency: pricingData.currency,
    displayPrice: pricingData.displayPrice,
    endpointMap: pricingData.endpointMap,
    groupModelRatio: pricingData.groupModelRatio,
    groupRatio: pricingData.groupRatio,
    selectedGroup: pricingData.selectedGroup,
    siteDisplayType: pricingData.siteDisplayType,
    t,
    tokenUnit: pricingData.tokenUnit,
    usableGroup: pricingData.usableGroup,
  });

  const pagination = useExplorerPagination(filteredModels);
  const priceMetaMap = useExplorerPriceMeta({
    currency: pricingData.currency,
    displayPrice: pricingData.displayPrice,
    groupModelRatio: pricingData.groupModelRatio,
    groupRatio: pricingData.groupRatio,
    modelRows,
    selectedGroup: pricingData.selectedGroup,
    siteDisplayType: pricingData.siteDisplayType,
    t,
    tokenUnit: pricingData.tokenUnit,
    usableGroup: pricingData.usableGroup,
  });

  return { detail, pagination, priceMetaMap };
};

export const useModelsExplorerPageState = ({ language, t }) => {
  useInjectExplorerFonts();

  const baseState = useExplorerBaseState({ language, t });
  const filteredModels = useExplorerFilteredState({
    modelRows: baseState.modelRows,
    selections: baseState.selections,
  });
  const pricingAndDetail = useExplorerPricingAndDetailState({
    filteredModels,
    modelRows: baseState.modelRows,
    pricingData: baseState.pricingData,
    t,
  });

  return buildExplorerPageStateResult({
    categoryCountMap: baseState.categoryCountMap,
    copyText: baseState.pricingData.copyText,
    detail: pricingAndDetail.detail,
    displayPrice: baseState.pricingData.displayPrice,
    filteredModels,
    loading: baseState.pricingData.loading,
    optionPanels: baseState.optionPanels,
    pagination: pricingAndDetail.pagination,
    priceMetaMap: pricingAndDetail.priceMetaMap,
    selections: baseState.selections,
  });
};
