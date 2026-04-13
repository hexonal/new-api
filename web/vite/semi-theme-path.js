import path from 'node:path';

export function resolveSemiThemePath(webRoot) {
  return path.resolve(webRoot, 'node_modules/@douyinfe/semi-theme-default');
}
