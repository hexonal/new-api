import assert from 'node:assert/strict';
import test from 'node:test';

import { getTopNavDisplayState } from '../src/aurora/layout/top-nav-utils.js';
import { getModelsExplorerLayoutClasses } from '../src/aurora/pages/public/models-explorer-layout.js';

test('getTopNavDisplayState hides non-essential elements on mobile', () => {
  assert.deepEqual(getTopNavDisplayState(true), {
    showBrandLabel: false,
    showSearch: false,
    showUserLabel: false,
  });
});

test('getTopNavDisplayState keeps full navigation chrome on desktop', () => {
  assert.deepEqual(getTopNavDisplayState(false), {
    showBrandLabel: true,
    showSearch: true,
    showUserLabel: true,
  });
});

test('getModelsExplorerLayoutClasses stacks filters above content on mobile', () => {
  const result = getModelsExplorerLayoutClasses(true);

  assert.equal(result.wrapperClassName, 'flex w-full flex-col gap-4 px-4 py-4');
  assert.equal(
    result.asideClassName,
    'w-full shrink-0 rounded-xl border border-border bg-[#f9fafb] p-3',
  );
  assert.equal(result.mainClassName, 'min-w-0 w-full');
});

test('getModelsExplorerLayoutClasses keeps desktop split layout', () => {
  const result = getModelsExplorerLayoutClasses(false);

  assert.equal(
    result.wrapperClassName,
    'flex w-full gap-6 px-8 py-6 2xl:px-12',
  );
  assert.equal(
    result.asideClassName,
    'sticky top-20 h-[calc(100vh-6rem)] w-60 shrink-0 overflow-y-auto rounded-xl border border-border bg-[#f9fafb] p-3',
  );
  assert.equal(result.mainClassName, 'flex-1 min-w-0');
});
