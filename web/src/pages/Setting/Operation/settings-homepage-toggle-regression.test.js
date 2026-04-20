import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (file) => readFileSync(join(import.meta.dir, file), 'utf8');

describe('settings homepage toggle regression', () => {
  test('keeps landing and home switches synchronized in header nav settings', () => {
    const source = readSource('SettingsHeaderNavModules.jsx');

    expect(source).toContain("moduleKey === 'landing' || moduleKey === 'home'");
    expect(source).toContain('newModules.home = checked;');
    expect(source).toContain('newModules.landing = {');
    expect(source).toContain("headerNavModules.landing?.enabled &&");
  });
});
