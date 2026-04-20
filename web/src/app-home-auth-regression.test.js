import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (file) => readFileSync(join(import.meta.dir, file), 'utf8');

describe('home auth regression', () => {
  test('uses the landing guest access decision before rendering the root route', () => {
    const source = readSource('App.jsx');

    expect(source).toContain('shouldRedirectHomeToLogin({');
    expect(source).toContain('isSystemHomeEnabled(headerNavModulesConfig)');
    expect(source).toContain("to='/login'");
    expect(source).toContain("to={isAuthenticated ? '/console' : '/login'}");
    expect(source).toContain('state={{ from: location }}');
    expect(source).toContain('landingPageEnabled ? <LandingPage /> : <Home />');
  });
});
