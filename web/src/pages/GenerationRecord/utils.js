const EMPTY_DISPLAY = '-';

export const formatGenerationRecordId = (value) => {
  const raw = String(value ?? '').trim();
  return raw ? `#${raw}` : EMPTY_DISPLAY;
};

export const formatGenerationTaskId = (record) => {
  const raw = String(record?.task_id ?? '').trim();
  return raw || EMPTY_DISPLAY;
};

export const formatTokenCount = (value) => {
  if (value === undefined || value === null || value === '') {
    return EMPTY_DISPLAY;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : EMPTY_DISPLAY;
};

export const formatQuota = (value) => {
  if (value === undefined || value === null || value === '') {
    return EMPTY_DISPLAY;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : EMPTY_DISPLAY;
};

export const formatNullableText = (value) => {
  const raw = String(value ?? '').trim();
  return raw || EMPTY_DISPLAY;
};
