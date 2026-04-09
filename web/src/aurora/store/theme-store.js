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

import { create } from 'zustand';

// Theme is determined at build time via VITE_THEME env var (set in Dockerfile).
// Default: 'aurora'. Set VITE_THEME=legacy to use old UI.
const DEFAULT_THEME = import.meta.env.VITE_THEME || 'aurora';

const normalizeThemeValue = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'aurora' || normalized.includes('aurora')
    ? 'aurora'
    : 'legacy';
};

export const useThemeStore = create((set, get) => ({
  theme: DEFAULT_THEME,

  setTheme: (theme) =>
    set({
      theme: normalizeThemeValue(theme),
    }),

  hydrateTheme: () => {
    // Theme is static, determined at build time via VITE_THEME env var.
    // No API call needed. Set in Dockerfile: ENV VITE_THEME=aurora
    const resolved = normalizeThemeValue(DEFAULT_THEME);
    set({ theme: resolved });
    return resolved;
  },
}));
