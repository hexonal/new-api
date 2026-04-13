export const getUniqueModelValues = (...groups) => {
  const seen = new Set();

  return groups
    .flat()
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      const normalized = item.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
};

export const getDefaultSelectedModalities = () => [
  'text',
  'image',
  'audio',
  'video',
];

export const buildModelBadges = ({
  billingLabel = '',
  tags = [],
  endpointTypes = [],
} = {}) => getUniqueModelValues(billingLabel, tags, endpointTypes);
