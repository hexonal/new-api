// Shim for antd — satisfies all transitive imports from @lobehub/icons and antd-style
// without bundling the full antd library.
const noop = () => ({});
const noopToken = () => ({ token: {}, hashId: '' });

// antd-style: import { theme } from 'antd'
export const theme = {
  useToken: noopToken,
  defaultAlgorithm: noop,
  darkAlgorithm: noop,
  compactAlgorithm: noop,
};

// antd-style: import { ConfigProvider } from 'antd'
export const ConfigProvider = ({ children }) => children;

// antd-style: import { App } from 'antd'
export const App = ({ children }) => children;

// antd-style: import { Grid } from 'antd'
export const Grid = { useBreakpoint: () => ({}) };

// antd-style: import { message, Modal, notification } from 'antd'
export const message = { success: noop, error: noop, info: noop, warning: noop, open: noop };
export const Modal = { confirm: noop, info: noop, warning: noop, error: noop, success: noop };
export const notification = { success: noop, error: noop, info: noop, warning: noop, open: noop };

// antd-style: import { version } from 'antd'
export const version = '0.0.0';

// antd-style: import { MappingAlgorithm, ThemeConfig } from 'antd' (type-only, but keep for Rollup)
export const MappingAlgorithm = undefined;
export const ThemeConfig = undefined;

// @lobehub/icons: import { Divider, Segmented } from 'antd'
export const Divider = ({ children }) => children;
export const Segmented = noop;

export default {};
