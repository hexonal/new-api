const CONSOLE_SECTION_LABEL_KEYS = {
  WORKSPACE: '工作区',
  ACCOUNT: '账户',
  ADMIN: '管理',
};

const CONSOLE_SIDEBAR_GROUP_CONFIG = {
  workspace: [
    { key: 'dashboard', href: '/console', labelKey: '工作区' },
    { key: 'api-keys', href: '/console/token', labelKey: 'API 密钥' },
    { key: 'usage-logs', href: '/console/log', labelKey: '使用日志' },
    { key: 'key-cost', href: '/console/key-cost', labelKey: '密钥消耗分析' },
    { key: 'callback-logs', href: '/console/callback', labelKey: '回调日志' },
    { key: 'midjourney', href: '/console/midjourney', labelKey: '绘图日志' },
    { key: 'task-logs', href: '/console/task', labelKey: '任务日志' },
  ],
  account: [
    { key: 'wallet', href: '/console/topup', labelKey: '钱包' },
    { key: 'personal', href: '/console/personal', labelKey: '个人设置' },
  ],
  admin: [
    { key: 'channel', href: '/console/channel', labelKey: '渠道管理' },
    { key: 'subscription', href: '/console/subscription', labelKey: '订阅' },
    { key: 'models', href: '/console/models', labelKey: '模型管理' },
    { key: 'deployment', href: '/console/deployment', labelKey: '模型部署' },
    { key: 'redemption', href: '/console/redemption', labelKey: '兑换码' },
    { key: 'users', href: '/console/user', labelKey: '用户管理' },
    {
      key: 'groups',
      href: '/console/setting/group-management',
      labelKey: '分组管理',
    },
  ],
};

const PAGE_TITLE_KEY_BY_PATH = {
  '/': '首页',
  '/console': '控制台',
  '/console/token': 'API 密钥',
  '/console/log': '使用日志',
  '/console/key-cost': '密钥消耗分析',
  '/console/callback': '回调日志',
  '/console/midjourney': '绘图日志',
  '/console/task': '任务日志',
  '/console/topup': '钱包',
  '/console/personal': '个人设置',
  '/console/channel': '渠道管理',
  '/console/subscription': '订阅',
  '/console/models': '模型管理',
  '/console/deployment': '模型部署',
  '/console/redemption': '兑换码',
  '/console/user': '用户管理',
  '/console/setting/group-management': '分组管理',
  '/console/setting': '系统设置',
  '/pricing': '模型广场',
  '/about': '关于',
  '/privacy-policy': '隐私政策',
  '/user-agreement': '用户协议',
};

export const getConsoleSectionLabels = (t) => ({
  WORKSPACE: t(CONSOLE_SECTION_LABEL_KEYS.WORKSPACE),
  ACCOUNT: t(CONSOLE_SECTION_LABEL_KEYS.ACCOUNT),
  ADMIN: t(CONSOLE_SECTION_LABEL_KEYS.ADMIN),
});

export const getConsoleSidebarGroups = (t) => ({
  workspace: CONSOLE_SIDEBAR_GROUP_CONFIG.workspace.map((item) => ({
    ...item,
    label: t(item.labelKey),
  })),
  account: CONSOLE_SIDEBAR_GROUP_CONFIG.account.map((item) => ({
    ...item,
    label: t(item.labelKey),
  })),
  admin: CONSOLE_SIDEBAR_GROUP_CONFIG.admin.map((item) => ({
    ...item,
    label: t(item.labelKey),
  })),
});

export const getPageShellTitle = (path, t) => {
  if (path.startsWith('/console/chat/')) {
    return t('聊天');
  }

  const titleKey = PAGE_TITLE_KEY_BY_PATH[path];
  return titleKey ? t(titleKey) : 'IMA Router';
};

export const getPageShellBreadcrumb = (path, t) => {
  if (path.startsWith('/console/chat/')) {
    const chatId = path.replace('/console/chat/', '');
    const detailLabel = chatId
      ? `${t('聊天')} ${decodeURIComponent(chatId)}`
      : t('聊天');

    return [
      { label: t('首页'), href: '/' },
      { label: t('控制台'), href: '/console' },
      { label: detailLabel },
    ];
  }

  if (path === '/') {
    return [{ label: t('首页'), href: '/' }];
  }

  if (path === '/console') {
    return [
      { label: t('首页'), href: '/' },
      { label: t('控制台'), href: '/console' },
    ];
  }

  const pageTitle = getPageShellTitle(path, t);
  const root = path.startsWith('/console')
    ? { label: t('控制台'), href: '/console' }
    : null;

  return [
    { label: t('首页'), href: '/' },
    ...(root ? [root] : []),
    ...(pageTitle === 'IMA Router' ? [] : [{ label: pageTitle, href: path }]),
  ];
};
