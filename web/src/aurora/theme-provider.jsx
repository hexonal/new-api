/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const ThemeModeContext = createContext({
  mode: 'light',
  resolvedMode: 'light',
  setMode: () => {},
});

export const useAuroraTheme = () => useContext(ThemeModeContext);

const getSystemMode = () => {
  if (typeof window === 'undefined') return 'light';
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const AuroraThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    try {
      const persisted = localStorage.getItem('aurora-color-mode');
      return persisted || 'auto';
    } catch {
      return 'auto';
    }
  });
  const [systemMode, setSystemMode] = useState(getSystemMode);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      setSystemMode(event.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedMode = useMemo(
    () => (mode === 'auto' ? systemMode : mode),
    [mode, systemMode],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (resolvedMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedMode]);

  const updateMode = useCallback((nextMode) => {
    const value = nextMode || 'auto';
    try {
      localStorage.setItem('aurora-color-mode', value);
    } catch {
      // no-op
    }
    setMode(value);
  }, []);

  return (
    <ThemeModeContext.Provider
      value={{
        mode,
        resolvedMode,
        setMode: updateMode,
      }}
    >
      {children}
    </ThemeModeContext.Provider>
  );
};

export const ThemeProvider = ({ children }) => {
  return <AuroraThemeProvider>{children}</AuroraThemeProvider>;
};
