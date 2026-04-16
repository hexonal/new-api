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

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from 'react';

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

const ActualThemeContext = createContext(null);
export const useActualTheme = () => useContext(ActualThemeContext);

const SetThemeContext = createContext(null);
export const useSetTheme = () => useContext(SetThemeContext);

// 原逻辑（保留注释）：
// const getSystemTheme = () => {
//   if (typeof window !== 'undefined' && window.matchMedia) {
//     return window.matchMedia('(prefers-color-scheme: dark)').matches
//       ? 'dark'
//       : 'light';
//   }
//   return 'light';
// };
//
// 当前需求：强制使用浅色主题，不跟随系统深色模式
const getSystemTheme = () => 'light';

export const ThemeProvider = ({ children }) => {
  const [theme, _setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme-mode') || 'auto';
    } catch {
      return 'auto';
    }
  });

  const [systemTheme, setSystemTheme] = useState(getSystemTheme());

  // 统一使用浅色样式
  const actualTheme = 'light';

  // 原逻辑（保留注释）：
  // useEffect(() => {
  //   if (typeof window !== 'undefined' && window.matchMedia) {
  //     const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  //
  //     const handleSystemThemeChange = (e) => {
  //       setSystemTheme(e.matches ? 'dark' : 'light');
  //     };
  //
  //     mediaQuery.addEventListener('change', handleSystemThemeChange);
  //
  //     return () => {
  //       mediaQuery.removeEventListener('change', handleSystemThemeChange);
  //     };
  //   }
  // }, []);
  useEffect(() => {
    if (systemTheme !== 'light') {
      setSystemTheme('light');
    }
  }, [systemTheme]);

  // 应用主题到DOM
  useEffect(() => {
    const body = document.body;
    if (actualTheme === 'dark') {
      body.setAttribute('theme-mode', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      body.removeAttribute('theme-mode');
      document.documentElement.classList.remove('dark');
    }
  }, [actualTheme]);

  const setTheme = useCallback((newTheme) => {
    let themeValue;

    if (typeof newTheme === 'boolean') {
      // 向后兼容原有的 boolean 参数
      themeValue = newTheme ? 'dark' : 'light';
    } else if (typeof newTheme === 'string') {
      // 新的字符串参数支持 'light', 'dark', 'auto'
      themeValue = newTheme;
    } else {
      themeValue = 'auto';
    }

    _setTheme(themeValue);
    localStorage.setItem('theme-mode', themeValue);
  }, []);

  return (
    <SetThemeContext.Provider value={setTheme}>
      <ActualThemeContext.Provider value={actualTheme}>
        <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
      </ActualThemeContext.Provider>
    </SetThemeContext.Provider>
  );
};
