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

export const getTopNavDisplayState = (isMobile) => ({
  showBrandLabel: !isMobile,
  showSearch: !isMobile,
  showUserLabel: !isMobile,
});

export const getDefaultHeaderNavModules = () => ({
  landing: { enabled: true, publicAccess: true },
  home: true,
  console: true,
  pricing: { enabled: true, requireAuth: false },
  docs: true,
  about: true,
});

const DEFAULT_TOP_NAV_MODULES = Object.freeze(getDefaultHeaderNavModules());

const getWindowOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost';
};

const normalizePricingModule = (pricingModule) => {
  if (pricingModule && typeof pricingModule === 'object') {
    return {
      enabled: pricingModule.enabled !== false,
      requireAuth: pricingModule.requireAuth === true,
    };
  }

  return {
    enabled: pricingModule !== false,
    requireAuth: false,
  };
};

const normalizeLandingModule = (landingModule) => {
  if (landingModule && typeof landingModule === 'object') {
    return {
      enabled: landingModule.enabled !== false,
      publicAccess:
        typeof landingModule.publicAccess === 'boolean'
          ? landingModule.publicAccess
          : landingModule.requireAuth !== true,
    };
  }

  return {
    enabled: landingModule !== false,
    publicAccess: true,
  };
};

const isTopNavModuleEnabled = (modules, key) => {
  if (key === 'pricing') {
    return normalizePricingModule(modules.pricing).enabled;
  }

  return modules[key] !== false;
};

const isExternalTopNavLink = (href) => {
  try {
    const origin = getWindowOrigin();
    return new URL(href, origin).origin !== origin;
  } catch {
    return false;
  }
};

export const parseHeaderNavModulesConfig = (config) => {
  if (!config) {
    return null;
  }

  try {
    const modules = JSON.parse(config);
    return {
      ...modules,
      landing: normalizeLandingModule(modules.landing),
      pricing: normalizePricingModule(modules.pricing),
    };
  } catch {
    return null;
  }
};

export const isLandingPageEnabled = (config) => {
  return parseHeaderNavModulesConfig(config)?.landing?.enabled ?? true;
};

export const isSystemHomeEnabled = (config) => {
  return parseHeaderNavModulesConfig(config)?.home ?? true;
};

export const isLandingPagePublicAccessEnabled = (config) => {
  return parseHeaderNavModulesConfig(config)?.landing?.publicAccess ?? true;
};

export const shouldRedirectHomeToLogin = ({
  headerNavModulesConfig,
  isAuthenticated,
}) => {
  const landingModule =
    parseHeaderNavModulesConfig(headerNavModulesConfig)?.landing ||
    normalizeLandingModule();
  const homeEnabled = isSystemHomeEnabled(headerNavModulesConfig);

  return (
    !isAuthenticated &&
    (!landingModule.publicAccess || (!landingModule.enabled && !homeEnabled))
  );
};

export const getResolvedDocsLink = (status) => {
  const docsLink =
    typeof status?.docs_link === 'string' ? status.docs_link.trim() : '';

  if (docsLink) {
    return docsLink;
  }

  if (typeof localStorage === 'undefined') {
    return '';
  }

  return localStorage.getItem('docs_link') || '';
};

export const getTopNavLinks = (t, options = {}) => {
  const modules = options.headerNavModules || DEFAULT_TOP_NAV_MODULES;
  const docsLink = options.docsLink?.trim() || '';
  const links = [
    { key: 'home', href: '/', label: t('首页') },
    { key: 'console', href: '/console', label: t('控制台') },
    { key: 'pricing', href: '/pricing', label: t('模型广场') },
    { key: 'docs', href: docsLink || '/about', label: t('文档') },
  ];

  return links
    .filter((link) => isTopNavModuleEnabled(modules, link.key))
    .map((link) => ({
      href: link.href,
      label: link.label,
      external: isExternalTopNavLink(link.href),
    }));
};

export const getLanguageSwitcherLabel = (t) => t('切换语言');
