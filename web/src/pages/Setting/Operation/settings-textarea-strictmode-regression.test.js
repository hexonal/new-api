import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readSource = (file) => readFileSync(join(import.meta.dir, file), 'utf8');

describe('settings textarea strict mode regression', () => {
  test('sensitive words textarea avoids autosize resize-observer wiring', () => {
    const source = readSource('SettingsSensitiveWords.jsx');

    expect(source).not.toContain('autosize={{');
    expect(source).toContain('rows={8}');
  });

  test('operation monitoring textareas also avoid autosize resize-observer wiring', () => {
    const source = readSource('SettingsMonitoring.jsx');

    expect(source).not.toContain('autosize={{');
    expect(source).toContain('rows={8}');
    expect(source).toContain('rows={4}');
  });
});
