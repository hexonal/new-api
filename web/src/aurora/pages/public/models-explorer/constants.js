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

export const PAGE_SIZE = 12;

export const MODALITY_OPTIONS = [
  { key: 'text', labelKey: '文本' },
  { key: 'image', labelKey: '图片' },
  { key: 'audio', labelKey: '音频' },
  { key: 'video', labelKey: '视频' },
];

export const CATEGORY_PILLS = [
  { key: 'all', labelKey: '全部' },
  { key: 'video', labelKey: '视频' },
  { key: 'image', labelKey: '图片' },
  { key: 'text', labelKey: '文本' },
  { key: 'audio', labelKey: '音频' },
  { key: 'embeddings', labelKey: '向量' },
  { key: 'rerank', labelKey: '重排' },
];

export const PRICE_KEY_ORDER = [
  'input',
  'completion',
  'thought',
  'fixed',
  'starting',
];

export const CONTEXT_BADGE_COLOR = {
  text: 'bg-indigo-50 text-indigo-700',
  image: 'bg-green-50 text-green-700',
  video: 'bg-purple-50 text-purple-700',
  audio: 'bg-cyan-50 text-cyan-700',
  embeddings: 'bg-blue-50 text-blue-700',
  rerank: 'bg-orange-50 text-orange-700',
};

export const BASE_MODALITY_KEYS = MODALITY_OPTIONS.map((item) => item.key);
