import { describe, expect, test } from 'bun:test';
import { getPreferredLanguage, normalizeLanguageSelection } from './preference';

describe('i18n preference helpers', () => {
  test('prefers user setting language over local storage', () => {
    expect(
      getPreferredLanguage({
        userSettingRaw: JSON.stringify({ language: 'en' }),
        localStorageLanguage: 'zh-CN',
      }),
    ).toBe('en');
  });

  test('falls back to local storage language when user setting is absent', () => {
    expect(
      getPreferredLanguage({
        userSettingRaw: '',
        localStorageLanguage: 'fr',
      }),
    ).toBe('fr');
  });

  test('normalizes shorthand chinese language selection', () => {
    expect(normalizeLanguageSelection('zh')).toBe('zh-CN');
  });
});
