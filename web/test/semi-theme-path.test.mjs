import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import { Logger, compileString } from 'sass';
import { resolveSemiThemePath } from '../vite/semi-theme-path.js';

const webRoot = path.resolve(import.meta.dirname, '..');
const anchorScssPath = path.join(
  webRoot,
  'node_modules/.pnpm/@douyinfe+semi-foundation@2.94.0/node_modules/@douyinfe/semi-foundation/lib/es/anchor/anchor.scss',
);

function compileWithTheme(themePath) {
  const source = fs.readFileSync(anchorScssPath, 'utf8');
  const scss = `@import "~${themePath}/scss/index.scss";\n$prefix: 'semi';\n${source}`;
  const nestedNodeModulesPath = anchorScssPath.match(/^(\S*\/node_modules\/)/)?.[0] ?? '';

  return compileString(scss, {
    importers: [
      {
        findFileUrl(url) {
          if (url.startsWith('~')) {
            return new URL(url.substring(1), pathToFileURL(nestedNodeModulesPath));
          }

          const resolvedPath = path.resolve(path.dirname(anchorScssPath), url);
          if (fs.existsSync(resolvedPath)) {
            return pathToFileURL(resolvedPath);
          }

          return null;
        },
      },
    ],
    logger: Logger.silent,
  });
}

test('resolveSemiThemePath returns a root path that compiles with vite-plugin-semi importer semantics', () => {
  const themePath = resolveSemiThemePath(webRoot);
  const result = compileWithTheme(themePath);

  assert.match(themePath, /web\/node_modules\/@douyinfe\/semi-theme-default$/);
  assert.ok(result.css.length > 0);
});
