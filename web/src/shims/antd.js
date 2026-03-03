// Shim for antd — satisfies imports from @lobehub/icons and antd-style
// without bundling the full antd library.
const noop = () => ({});
const noopToken = () => ({ token: {}, hashId: '' });

export const theme = {
  useToken: noopToken,
  defaultAlgorithm: noop,
  darkAlgorithm: noop,
  compactAlgorithm: noop,
};

export const ConfigProvider = ({ children }) => children;
export const App = ({ children }) => children;

export default {};
