const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSKUPrices = (record = {}) => {
  if (!Array.isArray(record?.sku_prices)) {
    return [];
  }
  return record.sku_prices.filter((item) => {
    const price = toFiniteNumber(item?.model_price);
    return (
      typeof item?.sku === 'string' && item.sku && price !== null && price > 0
    );
  });
};

const resolveCandidateGroups = ({
  record,
  selectedGroup,
  groupRatio = {},
  groupModelRatio = {},
}) => {
  if (selectedGroup && selectedGroup !== 'all') {
    return [selectedGroup];
  }

  if (Array.isArray(record?.enable_groups) && record.enable_groups.length > 0) {
    return record.enable_groups.filter(Boolean);
  }

  const groups = new Set();
  Object.keys(groupRatio || {}).forEach((group) => {
    if (group) {
      groups.add(group);
    }
  });
  Object.keys(groupModelRatio || {}).forEach((group) => {
    if (group) {
      groups.add(group);
    }
  });

  return Array.from(groups);
};

const resolveHailuoGroupRatio = ({
  baseModelName,
  sku,
  selectedGroup,
  groupRatio = {},
  groupModelRatio = {},
}) => {
  if (!selectedGroup) {
    return 1;
  }

  const byGroup = groupModelRatio?.[selectedGroup];
  if (byGroup && typeof byGroup === 'object') {
    const skuRatio = toFiniteNumber(byGroup?.[sku]);
    if (skuRatio !== null) {
      return skuRatio;
    }
    const baseRatio = toFiniteNumber(byGroup?.[baseModelName]);
    if (baseRatio !== null) {
      return baseRatio;
    }
  }

  const defaultRatio = toFiniteNumber(groupRatio?.[selectedGroup]);
  return defaultRatio !== null ? defaultRatio : 1;
};

export const buildHailuoSkuPricingRows = ({
  record,
  selectedGroup,
  groupRatio,
  groupModelRatio,
}) => {
  const baseModelName =
    record?.model || record?.model_name || record?.name || '';

  return normalizeSKUPrices(record).map((item) => {
    const ratio = resolveHailuoGroupRatio({
      baseModelName,
      sku: item.sku,
      selectedGroup,
      groupRatio,
      groupModelRatio,
    });
    const unitPrice = Number(item.model_price);
    return {
      ...item,
      groupRatio: ratio,
      unitPrice,
      finalPrice: unitPrice * ratio,
    };
  });
};

export const getHailuoStartingPrice = ({
  record,
  selectedGroup,
  groupRatio,
  groupModelRatio,
}) => {
  const candidateGroups = resolveCandidateGroups({
    record,
    selectedGroup,
    groupRatio,
    groupModelRatio,
  });
  const pricedRows = candidateGroups.flatMap((group) =>
    buildHailuoSkuPricingRows({
      record,
      selectedGroup: group,
      groupRatio,
      groupModelRatio,
    }).map((row) => ({
      ...row,
      usedGroup: group,
    })),
  );

  if (pricedRows.length === 0) {
    return null;
  }
  return pricedRows.reduce((minRow, currentRow) => {
    if (currentRow.finalPrice < minRow.finalPrice) {
      return currentRow;
    }
    if (
      currentRow.finalPrice === minRow.finalPrice &&
      currentRow.unitPrice < minRow.unitPrice
    ) {
      return currentRow;
    }
    return minRow;
  });
};
