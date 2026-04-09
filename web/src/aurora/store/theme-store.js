/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import { API } from '../../helpers';
import { create } from 'zustand';

const normalizeThemeValue = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'aurora' ? 'aurora' : 'legacy';
};

export const useThemeStore = create((set, get) => ({
  theme: 'legacy',

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
        set({ theme: 'legacy' });
        return;
      }

      const rawTheme = data.find(
        (item) => item?.key && item.key.toLowerCase() === 'theme',
      )?.value;

      set({ theme: normalizeThemeValue(rawTheme) });
      return normalizeThemeValue(rawTheme);
    } catch (error) {
      if (get().theme !== 'legacy') {
        set({ theme: 'legacy' });
      }
      return 'legacy';
    }
  },
}));

