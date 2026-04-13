const DYNAMIC_PER_CALL_RATIO_KEYS = [
  'duration',
  'quality',
  'resolution',
  'audio',
  'seconds',
  'size',
  'speed_ratio',
];

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatRatioValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  if (Number.isInteger(numeric)) {
    return numeric.toFixed(2);
  }
  const twoDecimal = numeric.toFixed(2);
  if (Math.abs(numeric - Number(twoDecimal)) < 1e-9) {
    return twoDecimal;
  }
  return numeric.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
};

export const extractDynamicPerCallRatios = (otherRatios = {}) => {
  const extracted = {};
  for (const key of DYNAMIC_PER_CALL_RATIO_KEYS) {
    const value = toFiniteNumber(otherRatios?.[key]);
    if (value === null || value <= 0 || value === 1) {
      continue;
    }
    extracted[key] = value;
  }
  return extracted;
};

export const hasDynamicPerCallRatios = (otherRatios = {}) =>
  Object.keys(extractDynamicPerCallRatios(otherRatios)).length > 0;

export const calculateDynamicPerCallPrice = ({
  modelPrice,
  groupRatio = 1,
  otherRatios = {},
}) => {
  const basePrice = toFiniteNumber(modelPrice);
  if (basePrice === null || basePrice <= 0) {
    return null;
  }

  const normalizedGroupRatio = toFiniteNumber(groupRatio);
  const effectiveGroupRatio =
    normalizedGroupRatio !== null && normalizedGroupRatio >= 0
      ? normalizedGroupRatio
      : 1;
  const dynamicRatios = extractDynamicPerCallRatios(otherRatios);
  const ratioEntries = Object.entries(dynamicRatios);
  const ratioMultiplier = ratioEntries.reduce(
    (product, [, value]) => product * value,
    1,
  );
  const finalPrice = basePrice * ratioMultiplier * effectiveGroupRatio;

  return {
    basePrice,
    finalPrice,
    groupRatio: effectiveGroupRatio,
    ratioEntries,
  };
};

export const buildDynamicPerCallFormula = ({
  basePrice,
  finalPrice,
  groupRatio = 1,
  otherRatios = {},
  symbol = '$',
  rate = 1,
  labels = {},
}) => {
  const dynamicRatios = extractDynamicPerCallRatios(otherRatios);
  const ratioEntries = Object.entries(dynamicRatios);
  if (ratioEntries.length === 0) {
    return '';
  }

  const baseLabel = labels.basePrice || '基础单价';
  const groupLabel = labels.groupRatio || '分组倍率';
  const perCallLabel = labels.perCall || '次';
  const effectiveGroupRatio = toFiniteNumber(groupRatio);
  const safeGroupRatio =
    effectiveGroupRatio !== null && effectiveGroupRatio >= 0
      ? effectiveGroupRatio
      : 1;

  const formatPrice = (value) =>
    `${symbol}${(Number(value) * rate).toFixed(6)}`;
  const ratioText = ratioEntries
    .map(([key, value]) => `${labels[key] || key} ${formatRatioValue(value)}`)
    .join(' * ');

  return `${baseLabel} ${formatPrice(basePrice)} / ${perCallLabel} * (${ratioText}) * ${groupLabel} ${safeGroupRatio.toFixed(4)} = ${formatPrice(finalPrice)}`;
};

export const buildDynamicPerCallParameterText = (otherRatios = {}) => {
  const ratioEntries = Object.entries(extractDynamicPerCallRatios(otherRatios));
  if (ratioEntries.length === 0) {
    return '';
  }
  return ratioEntries
    .map(([key, value]) => `${key}=${formatRatioValue(value)}`)
    .join(', ');
};

export const getBillingSKU = (other = {}) => {
  const sku = other?.billing_sku;
  return typeof sku === 'string' ? sku.trim() : '';
};

export const formatDirectPerCallPrice = (
  value,
  { symbol = '$', digits = 6 } = {},
) => {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return `${symbol}0.000000`;
  }
  return `${symbol}${numeric.toFixed(digits)}`;
};

export const derivePerCallUnitPriceFromQuota = ({
  billedQuota,
  groupRatio = 1,
  quotaPerUnit,
}) => {
  const numericQuota = toFiniteNumber(billedQuota);
  const numericGroupRatio = toFiniteNumber(groupRatio);
  const numericQuotaPerUnit = toFiniteNumber(quotaPerUnit);

  if (
    numericQuota === null ||
    numericQuota <= 0 ||
    numericGroupRatio === null ||
    numericGroupRatio <= 0 ||
    numericQuotaPerUnit === null ||
    numericQuotaPerUnit <= 0
  ) {
    return 0;
  }

  return numericQuota / numericQuotaPerUnit / numericGroupRatio;
};

export const calculateFixedPerCallPrice = ({ modelPrice, groupRatio = 1 }) => {
  const unitPrice = toFiniteNumber(modelPrice);
  if (unitPrice === null || unitPrice <= 0) {
    return null;
  }

  const normalizedGroupRatio = toFiniteNumber(groupRatio);
  const effectiveGroupRatio =
    normalizedGroupRatio !== null && normalizedGroupRatio >= 0
      ? normalizedGroupRatio
      : 1;

  return {
    unitPrice,
    finalPrice: unitPrice * effectiveGroupRatio,
    groupRatio: effectiveGroupRatio,
  };
};

export const buildFixedPerCallFormula = ({
  unitPrice,
  finalPrice,
  groupRatio = 1,
  symbol = '$',
  rate = 1,
  labels = {},
}) => {
  const modelLabel = labels.modelPrice || '模型单价';
  const groupLabel = labels.groupRatio || '分组倍率';
  const perCallLabel = labels.perCall || '次';
  const effectiveGroupRatio = toFiniteNumber(groupRatio);
  const safeGroupRatio =
    effectiveGroupRatio !== null && effectiveGroupRatio >= 0
      ? effectiveGroupRatio
      : 1;
  const formatPrice = (value) =>
    `${symbol}${(Number(value) * rate).toFixed(6)}`;

  return `(${modelLabel} ${formatPrice(unitPrice)} / ${perCallLabel}) * ${groupLabel} ${safeGroupRatio.toFixed(4)} = ${formatPrice(finalPrice)}`;
};

export const buildCreditsSettlementFormula = ({
  credits,
  groupRatio = 1,
  finalPrice,
  symbol = '$',
  rate = 1,
  labels = {},
}) => {
  const creditsValue = toFiniteNumber(credits);
  const settledPrice = toFiniteNumber(finalPrice);
  if (creditsValue === null || creditsValue <= 0 || settledPrice === null) {
    return '';
  }

  const creditsLabel = labels.credits || '上游消耗';
  const groupLabel = labels.groupRatio || '分组倍率';
  const creditsUnit = labels.creditsUnit || 'credits';
  const effectiveGroupRatio = toFiniteNumber(groupRatio);
  const safeGroupRatio =
    effectiveGroupRatio !== null && effectiveGroupRatio >= 0
      ? effectiveGroupRatio
      : 1;
  const formatPrice = (value) =>
    `${symbol}${(Number(value) * rate).toFixed(6)}`;

  return `(${creditsLabel} ${creditsValue} ${creditsUnit}) * ${groupLabel} ${safeGroupRatio.toFixed(4)} = ${formatPrice(settledPrice)}`;
};
