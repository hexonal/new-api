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

import { calculateModelPrice, getModelPriceItems } from '../../../../helpers';
import { buildHailuoSkuPricingRows } from '../../../../helpers/hailuoSkuPricing';
import { PRICE_KEY_ORDER } from './constants';

export const splitTags = (text) =>
  String(text || '')
    .split(/[,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export const compactPriceValue = (rawValue = '') =>
  String(rawValue)
    .replace(/\s*\/\s*1([KMG])\s*Tokens?/gi, '/$1')
    .replace(/\s+/g, ' ')
    .trim();

export const parseModelDate = (value) => {
  if (!value && value !== 0) {
    return null;
  }
  const raw = Number(value);
  if (Number.isFinite(raw)) {
    const timestamp = raw > 1e12 ? raw : raw > 1e10 ? raw : raw * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const pickModelDate = (model) =>
  parseModelDate(model?.published_at) ||
  parseModelDate(model?.release_at) ||
  parseModelDate(model?.updated_at) ||
  parseModelDate(model?.updated_time) ||
  parseModelDate(model?.created_at) ||
  parseModelDate(model?.created_time);

export const formatModelDate = (model, locale) => {
  const date = pickModelDate(model);
  if (!date) {
    return '-';
  }
  return date.toLocaleDateString(locale || undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatModelTimestamp = (model) => {
  const date = pickModelDate(model);
  return date ? date.getTime() : 0;
};

export const buildPageNumbers = (current, total) => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }
  const pages = new Set([1, total, current, current - 1, current + 1]);
  return [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
};

export const getContextBadge = (model, modalities, t) => {
  const haystack = `${model?.model_name || ''} ${model?.tags || ''}`;
  const matched = haystack.match(/(\d+)\s*([kKmM])/);
  if (matched) {
    return `${matched[1]}${matched[2].toUpperCase()}`;
  }

  if (modalities.has('video')) {
    return `${t('视频')} ${t('模型')}`;
  }
  if (modalities.has('image')) {
    return `${t('图片')} ${t('模型')}`;
  }
  if (modalities.has('audio')) {
    return `${t('音频')} ${t('模型')}`;
  }
  if (modalities.has('embeddings')) {
    return t('向量');
  }

  return `${t('文本')} ${t('模型')}`;
};

export const getPrimaryModality = (modalities) => {
  const priority = ['text', 'image', 'video', 'audio', 'embeddings', 'rerank'];
  return priority.find((item) => modalities.has(item)) || 'text';
};

const resolveTargetGroup = ({ enabledGroups, selectedGroup, usableGroup }) => {
  const usableGroups = Object.keys(usableGroup || {}).filter(Boolean);
  if (
    selectedGroup &&
    selectedGroup !== 'all' &&
    enabledGroups.includes(selectedGroup)
  ) {
    return selectedGroup;
  }
  return (
    usableGroups.find((group) => enabledGroups.includes(group)) ||
    enabledGroups[0] ||
    selectedGroup ||
    'default'
  );
};

const sortPriceItems = (items) =>
  [...items].sort((a, b) => {
    const ai = PRICE_KEY_ORDER.indexOf(a.key);
    const bi = PRICE_KEY_ORDER.indexOf(b.key);
    const left = ai === -1 ? 100 : ai;
    const right = bi === -1 ? 100 : bi;
    return left - right;
  });

export const getPriceMeta = ({
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
}) => {
  const enabledGroups = Array.isArray(model?.enable_groups)
    ? model.enable_groups.filter(Boolean)
    : [];
  const targetGroup = resolveTargetGroup({
    enabledGroups,
    selectedGroup,
    usableGroup,
  });

  const priceData = calculateModelPrice({
    record: model,
    selectedGroup: targetGroup,
    groupRatio,
    groupModelRatio,
    tokenUnit,
    displayPrice,
    currency,
    quotaDisplayType: siteDisplayType,
  });

  const items = getModelPriceItems(priceData, t, siteDisplayType);
  const sortedItems = sortPriceItems(items);

  return sortedItems.slice(0, 2).map((item) => ({
    key: item.key,
    label: item.label,
    value: compactPriceValue(`${item.value}${item.suffix || ''}`),
  }));
};

export const buildDetailEndpoints = (detailModel, endpointMap) => {
  if (!detailModel) {
    return [];
  }
  const endpointTypes = Array.isArray(detailModel.supported_endpoint_types)
    ? detailModel.supported_endpoint_types
    : [];

  return endpointTypes.map((type) => {
    const endpointInfo = endpointMap?.[type] || {};
    let path = endpointInfo.path || '';
    if (path.includes('{model}')) {
      path = path.replaceAll('{model}', detailModel.model_name || '');
    }
    return {
      type,
      method: endpointInfo.method || 'POST',
      path,
    };
  });
};

const resolveDetailPricingGroups = ({ detailModel, selectedGroup, usableGroup }) => {
  const modelEnableGroups = Array.isArray(detailModel.enable_groups)
    ? detailModel.enable_groups.filter(Boolean)
    : [];
  const availableGroups = Object.keys(usableGroup || {})
    .filter((group) => group && group !== 'auto')
    .filter((group) => modelEnableGroups.includes(group));
  const fallbackGroups = [...modelEnableGroups.filter((group) => group !== 'auto')];

  if (
    fallbackGroups.length === 0 &&
    selectedGroup &&
    selectedGroup !== 'all' &&
    selectedGroup !== 'auto'
  ) {
    fallbackGroups.push(selectedGroup);
  }

  return availableGroups.length > 0 ? availableGroups : fallbackGroups;
};

const buildDetailPricingRow = ({
  currency,
  detailModel,
  displayPrice,
  group,
  groupModelRatio,
  groupRatio,
  siteDisplayType,
  t,
  tokenUnit,
}) => {
  const priceData = calculateModelPrice({
    record: detailModel,
    selectedGroup: group,
    groupRatio,
    groupModelRatio,
    tokenUnit,
    displayPrice,
    currency,
    quotaDisplayType: siteDisplayType,
  });

  const ratio =
    priceData && Number.isFinite(Number(priceData.usedGroupRatio))
      ? Number(priceData.usedGroupRatio)
      : Number(groupRatio?.[group] || 1);

  return {
    group,
    ratio,
    billingType: Number(detailModel?.quota_type) === 1 ? 'per_call' : 'usage',
    items: getModelPriceItems(priceData, t, siteDisplayType),
    hailuoSkuRows: buildHailuoSkuPricingRows({
      record: detailModel,
      selectedGroup: group,
      groupRatio,
      groupModelRatio,
    }),
  };
};

export const buildDetailPricingRows = ({
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
}) => {
  if (!detailModel) {
    return [];
  }
  const groups = resolveDetailPricingGroups({
    detailModel,
    selectedGroup,
    usableGroup,
  });

  return groups.map((group) =>
    buildDetailPricingRow({
      currency,
      detailModel,
      displayPrice,
      group,
      groupModelRatio,
      groupRatio,
      siteDisplayType,
      t,
      tokenUnit,
    }),
  );
};

export const buildDetailAutoChain = (detailModel, autoGroups) => {
  if (!detailModel || !Array.isArray(autoGroups)) {
    return [];
  }
  const modelEnableGroups = Array.isArray(detailModel.enable_groups)
    ? detailModel.enable_groups.filter(Boolean)
    : [];
  return autoGroups.filter((group) => modelEnableGroups.includes(group));
};
