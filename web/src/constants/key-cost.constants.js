import { CHART_CONFIG, CARD_PROPS } from './dashboard.constants';

export { CHART_CONFIG, CARD_PROPS };

export const GRANULARITY_OPTIONS = [
  { label: '天', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
];

export const COMPARE_COLORS = [
  '#3370FF',
  '#F53F3F',
  '#00B42A',
  '#FF7D00',
  '#722ED1',
];

export const MAX_COMPARE_KEYS = 5;
export const TOP_N_MODELS = 10;
export const DEFAULT_PAGE_SIZE = 20;
