export const QUICK_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/console', label: 'Console' },
  { href: '/pricing', label: 'Models' },
  { href: '/about', label: 'Docs' },
];

const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/login$/,
  /^\/register$/,
  /^\/reset$/,
  /^\/user\/reset$/,
  /^\/pricing$/,
  /^\/forbidden$/,
  /^\/about$/,
  /^\/privacy-policy$/,
  /^\/user-agreement$/,
  /^\/oauth(?:\/.*)?$/,
];

export function isPublicRoute(pathname = '') {
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function shouldShowMobileMenu({ isCompact = false, pathname = '' } = {}) {
  if (isCompact) {
    return true;
  }

  return !isPublicRoute(pathname);
}
