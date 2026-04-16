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

const INVALID_DISPLAY_TOKENS = new Set(['N/A', 'NA', 'NAN']);

/**
 * 归一化 dashboard 卡片展示值，避免远端脏数据直接渲染为 NaN/NA。
 * @param {unknown} value
 * @returns {string | number}
 */
export function sanitizeDashboardDisplayValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : '—';
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return '—';
    }

    if (INVALID_DISPLAY_TOKENS.has(normalizedValue.toUpperCase())) {
      return '—';
    }

    return normalizedValue;
  }

  return value ?? '—';
}

/**
 * 将图表数值归一化为有限数，非法值统一回退到 0。
 * @param {unknown} value
 * @returns {number}
 */
export function sanitizeDashboardMetricNumber(value) {
  const normalizedValue =
    typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));

  return Number.isFinite(normalizedValue) ? normalizedValue : 0;
}
