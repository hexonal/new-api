const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const formatInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }
  return String(Math.trunc(parsed)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export function parseImaProBillingSku(sku) {
  const text = String(sku || '').trim();
  if (!text) {
    return { inputMode: '', resolutionBucket: '' };
  }
  const parts = text.toLowerCase().split('-');
  const resolutionBucket = ['480p', '720p', '1080p'].includes(parts[parts.length - 1])
    ? parts[parts.length - 1]
    : '';
  const inputMode = ['novideo', 'withvideo'].includes(parts[parts.length - 2])
    ? parts[parts.length - 2]
    : '';
  return { inputMode, resolutionBucket };
}

export function getImaProInputModeLabel(inputMode, labels = {}) {
  if (inputMode === 'novideo') {
    return labels.novideo || '无参考视频';
  }
  if (inputMode === 'withvideo') {
    return labels.withvideo || '含参考视频';
  }
  return inputMode || '';
}

export function resolveImaProBillingInfo(other = {}) {
  const sku = String(other?.billing_sku || other?.model_variant || '').trim();
  const parsed = parseImaProBillingSku(sku);
  const inputMode = String(other?.input_mode || parsed.inputMode || '').trim();
  const resolutionBucket = String(
    other?.resolution_bucket || parsed.resolutionBucket || '',
  ).trim();
  const ratePerM =
    toPositiveNumber(other?.rate_per_m) ||
    toPositiveNumber(other?.model_ratio) * 2;
  const modelRatio =
    toPositiveNumber(other?.model_ratio) || (ratePerM > 0 ? ratePerM / 2 : 0);
  const groupRatio = Number(other?.group_ratio);
  const isImaProLike =
    Boolean(sku) ||
    Boolean(inputMode) ||
    Boolean(resolutionBucket) ||
    toPositiveNumber(other?.rate_per_m) > 0;

  if (!isImaProLike || ratePerM <= 0) {
    return null;
  }

  return {
    sku,
    inputMode,
    resolutionBucket,
    ratePerM,
    modelRatio,
    groupRatio: Number.isFinite(groupRatio) ? groupRatio : 1,
    usedFallback: Boolean(other?.used_fallback),
  };
}

export function buildImaProBillingLines({
  other,
  totalTokens,
  billedQuota,
  quotaPerUnit = 500000,
  finalCostText,
  labels = {},
}) {
  const info = resolveImaProBillingInfo(other);
  if (!info) {
    return [];
  }

  const lines = [];
  if (info.sku) {
    lines.push(`${labels.sku || '计费 SKU'}：${info.sku}`);
  }

  const tier = [
    getImaProInputModeLabel(info.inputMode, labels),
    info.resolutionBucket,
  ]
    .filter(Boolean)
    .join(' / ');
  if (tier) {
    lines.push(`${labels.tier || '计费档位'}：${tier}`);
  }

  if (totalTokens > 0) {
    lines.push(
      `${labels.tokens || '计费 Tokens'}：${formatInteger(totalTokens)}`,
    );
  }

  lines.push(
    `${labels.rate || 'SKU 单价'}：$${info.ratePerM.toFixed(6)} / 1M tokens`,
  );
  lines.push(
    `${labels.groupRatio || '分组倍率（模型覆盖）'}：${info.groupRatio.toFixed(4)}`,
  );

  if (totalTokens > 0 && finalCostText) {
    const quotaValue =
      toPositiveNumber(billedQuota) ||
      Math.trunc(totalTokens * info.modelRatio * info.groupRatio);
    const quotaUnit = toPositiveNumber(quotaPerUnit) || 500000;
    lines.push(
      `${labels.formula || '计费公式'}：(${formatInteger(totalTokens)} tokens * SKU倍率 ${info.modelRatio.toFixed(6)} * ${labels.groupRatio || '分组倍率（模型覆盖）'} ${info.groupRatio.toFixed(4)}) = ${formatInteger(quotaValue)} quota；(${formatInteger(quotaValue)} quota / ${formatInteger(quotaUnit)} quota/USD) = ${finalCostText}`,
    );
  }

  if (info.usedFallback) {
    lines.push(
      labels.fallback || '计费提示：SKU 未命中，已使用模型基础价格兜底',
    );
  }

  return lines;
}
