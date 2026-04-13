export const getTopNavDisplayState = (isMobile) => ({
  showBrandLabel: !isMobile,
  showSearch: !isMobile,
  showUserLabel: !isMobile,
});

export const getTopNavLinks = (t) => [
  { href: '/', label: t('首页') },
  { href: '/console', label: t('控制台') },
  { href: '/pricing', label: t('模型广场') },
  { href: '/about', label: t('文档') },
];

export const getLanguageSwitcherLabel = (t) => t('切换语言');
