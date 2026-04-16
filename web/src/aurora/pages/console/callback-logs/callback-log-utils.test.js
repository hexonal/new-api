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

import assert from 'node:assert/strict';
import test from 'node:test';

function createElementStub() {
  return {
    style: {},
    children: [],
    setAttribute() {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild() {},
    addEventListener() {},
    removeEventListener() {},
    getContext() {
      return {};
    },
    getElementsByTagName() {
      return [];
    },
    cloneNode() {
      return createElementStub();
    },
  };
}

if (!globalThis.window) {
  globalThis.window = globalThis;
}

if (!globalThis.document) {
  globalThis.document = {
    body: createElementStub(),
    head: createElementStub(),
    createElement: createElementStub,
    createElementNS() {
      return createElementStub();
    },
    getElementsByTagName() {
      return [];
    },
    querySelector() {
      return null;
    },
  };
}

if (!globalThis.navigator) {
  globalThis.navigator = { userAgent: 'bun' };
}

if (!globalThis.self) {
  globalThis.self = globalThis;
}

let cachedUtilsPromise;

async function loadUtils() {
  if (!cachedUtilsPromise) {
    cachedUtilsPromise = import('./callback-log-utils.js');
  }
  return cachedUtilsPromise;
}

test('canRetryCallbackEvent blocks successful http callbacks', async () => {
  const { canRetryCallbackEvent, getRetryDisabledReason } = await loadUtils();

  assert.equal(
    canRetryCallbackEvent({
      id: 1,
      status: 'succeeded',
      last_http_status: 200,
    }),
    false,
  );

  assert.equal(
    getRetryDisabledReason({
      id: 1,
      status: 'succeeded',
      last_http_status: 200,
    }),
    'HTTP 200-299 的成功回调禁止重试',
  );
});

test('canRetryCallbackEvent allows failed callbacks', async () => {
  const { canRetryCallbackEvent } = await loadUtils();

  assert.equal(
    canRetryCallbackEvent({
      id: 2,
      status: 'dead',
      last_http_status: 500,
    }),
    true,
  );
});

test('formatJSONBlock serializes object payloads for details panel', async () => {
  const { formatJSONBlock } = await loadUtils();

  assert.equal(
    formatJSONBlock({
      card: {
        title: 'callback',
      },
    }),
    '{\n  "card": {\n    "title": "callback"\n  }\n}',
  );
});
