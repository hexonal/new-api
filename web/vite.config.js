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

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, transformWithEsbuild } from 'vite';
import pkg from '@douyinfe/vite-plugin-semi';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveSemiThemePath } from './vite/semi-theme-path.js';
import { MANUAL_CHUNKS } from './vite/manual-chunks.js';
const { vitePluginSemi } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = (env.VITE_API_PROXY_TARGET || '').trim() || 'http://localhost:3000';
  const serverPort = Number((env.VITE_PORT || '').trim()) || 4000;
  const semiThemePath = resolveSemiThemePath(__dirname);

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      {
        name: 'treat-js-files-as-jsx',
        async transform(code, id) {
          if (!/src\/.*\.js$/.test(id)) {
            return null;
          }

          // Use the exposed transform from vite, instead of directly
          // transforming with esbuild
          return transformWithEsbuild(code, id, {
            loader: 'jsx',
            jsx: 'automatic',
          });
        },
      },
      react(),
      vitePluginSemi({
        cssLayer: false,
        theme: semiThemePath,
      }),
    ],
    optimizeDeps: {
      force: true,
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
          '.json': 'json',
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: MANUAL_CHUNKS,
        },
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'legacy',
          importer: [
            function(url) {
              if (url.startsWith('~')) {
                return { file: url.substring(1) };
              }
              return null;
            },
          ],
          loadPaths: [path.resolve(__dirname, 'node_modules')],
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: serverPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          cookieDomainRewrite: 'localhost',
        },
        '/mj': {
          target: apiProxyTarget,
          changeOrigin: true,
          cookieDomainRewrite: 'localhost',
        },
        '/pg': {
          target: apiProxyTarget,
          changeOrigin: true,
          cookieDomainRewrite: 'localhost',
        },
      },
    },
  };
});
