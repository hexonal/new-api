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

import { API } from '../../helpers';
import { create } from 'zustand';

const DEFAULT_THEME = 'aurora';

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

  hydrateTheme: async () => {
    try {
      const response = await API.get('/api/option/');
      const { success, data } = response.data || {};

      if (!success || !Array.isArray(data)) {
        if (get().theme === 'legacy') return;
        set({ theme: DEFAULT_THEME });
        return;
      }

      const rawTheme = data.find(
        (item) => item?.key && item.key.toLowerCase() === 'theme',
      )?.value;

      const resolvedTheme = normalizeThemeValue(rawTheme);
      set({ theme: resolvedTheme });
      return resolvedTheme;
    } catch (error) {
      if (get().theme !== DEFAULT_THEME) {
        set({ theme: DEFAULT_THEME });
      }
      return get().theme;
    }
  },
}));
