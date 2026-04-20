import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (file) => readFileSync(join(import.meta.dir, file), 'utf8');

describe('settings cards dom warning regression', () => {
  test('does not pass the unsupported hoverable prop to operation cards', () => {
    const headerNavSource = readSource('SettingsHeaderNavModules.jsx');
    const sidebarSource = readSource('SettingsSidebarModulesAdmin.jsx');

    expect(headerNavSource).not.toContain('hoverable');
    expect(sidebarSource).not.toContain('hoverable');
  });
});
