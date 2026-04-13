import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPublicRoute,
  shouldShowMobileMenu,
} from '../src/aurora/layout/navigation-config.js';

test('isPublicRoute recognizes public entry pages', () => {
  assert.equal(isPublicRoute('/'), true);
  assert.equal(isPublicRoute('/pricing'), true);
  assert.equal(isPublicRoute('/console'), false);
});

test('shouldShowMobileMenu keeps a menu entry point on compact public pages', () => {
  assert.equal(shouldShowMobileMenu({ isCompact: true, pathname: '/' }), true);
  assert.equal(shouldShowMobileMenu({ isCompact: false, pathname: '/' }), false);
  assert.equal(shouldShowMobileMenu({ isCompact: false, pathname: '/console' }), true);
});
