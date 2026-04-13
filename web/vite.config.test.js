import { describe, expect, test } from 'bun:test';
import viteConfig from './vite.config.js';

describe('vite dev server config', () => {
  test('uses fixed port 4000 with strict port handling', () => {
    const config =
      typeof viteConfig === 'function'
        ? viteConfig({ mode: 'development' })
        : viteConfig;

    expect(config.server?.port).toBe(4000);
    expect(config.server?.strictPort).toBe(true);
  });
});
