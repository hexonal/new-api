export const getTokenFormInitialValues = () => ({
  name: '',
  remain_quota: '0',
  expired_time: '',
  unlimited_quota: true,
  model_limits: [],
  allow_ips: '',
  group: '',
  cross_group_retry: false,
  tokenCount: '1',
});

export const resolveDefaultGroupValue = (groupOptions = []) => {
  if (!Array.isArray(groupOptions) || groupOptions.length === 0) {
    return '';
  }

  const nonAutoGroups = groupOptions.filter((item) => item.value !== 'auto');
  if (nonAutoGroups.length === 1) {
    return nonAutoGroups[0].value;
  }

  if (groupOptions.length === 1) {
    return groupOptions[0].value;
  }

  return '';
};

export const toDateTimeLocalValue = (unixSeconds) => {
  if (!unixSeconds || Number(unixSeconds) === -1) {
    return '';
  }

  const date = new Date(Number(unixSeconds) * 1000);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const parseExpiryTime = (value) => {
  if (!value) {
    return -1;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.ceil(parsed / 1000);
};

const normalizeModelLimits = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean);
  }

  return `${value || ''}`
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeTokenFormPayload = (values) => {
  const expiredTime = parseExpiryTime(values.expired_time);
  if (expiredTime === null) {
    return null;
  }

  const modelLimits = normalizeModelLimits(values.model_limits);

  return {
    name: `${values.name || ''}`.trim(),
    remain_quota: Number.parseInt(values.remain_quota || 0, 10) || 0,
    expired_time: expiredTime,
    unlimited_quota: Boolean(values.unlimited_quota),
    model_limits_enabled: modelLimits.length > 0,
    model_limits: modelLimits.join(','),
    allow_ips: `${values.allow_ips || ''}`.trim(),
    group: `${values.group || ''}`.trim(),
    cross_group_retry: Boolean(values.cross_group_retry),
  };
};

export const buildTokenCreatePayloads = (values, generateSuffix) => {
  const count = Math.max(1, Number.parseInt(values.tokenCount || 1, 10) || 1);
  const payload = normalizeTokenFormPayload(values);

  if (!payload) {
    return null;
  }

  const baseName = payload.name.trim() || 'default';

  return Array.from({ length: count }, (_, index) => ({
    ...payload,
    name:
      index === 0 && payload.name.trim()
        ? payload.name.trim()
        : `${baseName}-${generateSuffix()}`,
  }));
};
