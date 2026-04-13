import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApiEndpointKey,
  normalizeApiEndpoint,
} from '../src/aurora/pages/console/components/api-endpoint-utils.js';

test('normalizeApiEndpoint extracts url, route and description from object input', () => {
  const endpoint = normalizeApiEndpoint(
    {
      url: 'https://example.com',
      route: 'Main',
      description: 'Primary endpoint',
    },
    0,
  );

  assert.deepEqual(endpoint, {
    key: 'Main-https://example.com-0',
    url: 'https://example.com',
    route: 'Main',
    description: 'Primary endpoint',
  });
});

test('buildApiEndpointKey stays unique when duplicate urls are returned', () => {
  const firstKey = buildApiEndpointKey('https://example.com', 'Docs', 0);
  const secondKey = buildApiEndpointKey('https://example.com', 'Docs', 1);

  assert.notEqual(firstKey, secondKey);
});
