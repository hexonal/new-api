import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (...segments) =>
  readFileSync(join(import.meta.dir, ...segments), 'utf8');

describe('settings page admin regression', () => {
  test('aurora settings page is gated by admin instead of root', () => {
    const source = readSource('SettingsPage.jsx');

    expect(source).toContain("import { isAdmin } from '../../../helpers';");
    expect(source).toContain('if (!isAdmin()) {');
    expect(source).not.toContain('if (!isRoot()) {');
  });

  test('legacy settings page also builds tabs for administrators', () => {
    const source = readSource('..', '..', '..', 'pages', 'Setting', 'index.jsx');

    expect(source).toContain("import { isAdmin } from '../../helpers';");
    expect(source).toContain('if (isAdmin()) {');
    expect(source).not.toContain('if (isRoot()) {');
  });
});
