import assert from 'node:assert/strict';
import test from 'node:test';

import viteConfig from '../vite.config.js';

test('vite dev server defaults to port 4000', () => {
  const originalPort = process.env.VITE_PORT;
  delete process.env.VITE_PORT;

  try {
    const config = viteConfig({ mode: 'development' });
    assert.equal(config.server.port, 4000);
  } finally {
    if (originalPort === undefined) {
      delete process.env.VITE_PORT;
    } else {
      process.env.VITE_PORT = originalPort;
    }
  }
});

test('vite proxy target respects VITE_API_PROXY_TARGET', () => {
  const originalTarget = process.env.VITE_API_PROXY_TARGET;
  process.env.VITE_API_PROXY_TARGET = 'http://123.56.96.202:3000';

  try {
    const config = viteConfig({ mode: 'development' });
    assert.equal(config.server.proxy['/api'].target, 'http://123.56.96.202:3000');
    assert.equal(config.server.proxy['/mj'].target, 'http://123.56.96.202:3000');
    assert.equal(config.server.proxy['/pg'].target, 'http://123.56.96.202:3000');
  } finally {
    if (originalTarget === undefined) {
      delete process.env.VITE_API_PROXY_TARGET;
    } else {
      process.env.VITE_API_PROXY_TARGET = originalTarget;
    }
  }
});
