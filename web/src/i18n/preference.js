import { normalizeLanguage } from './language';

const parseUserSetting = (settingRaw) => {
  if (!settingRaw) return {};
  if (typeof settingRaw === 'object') return settingRaw;
  if (typeof settingRaw !== 'string') return {};

  try {
    return JSON.parse(settingRaw);
  } catch {
    return {};
  }
};

export const normalizeLanguageSelection = (language) =>
  normalizeLanguage(language) || 'zh-CN';

export const getPreferredLanguage = ({
  userSettingRaw,
  localStorageLanguage,
} = {}) => {
  const settings = parseUserSetting(userSettingRaw);
  const userLanguage = normalizeLanguage(settings.language);
  if (userLanguage) {
    return userLanguage;
  }

  const savedLanguage = normalizeLanguage(localStorageLanguage);
  if (savedLanguage) {
    return savedLanguage;
  }

  return '';
};
