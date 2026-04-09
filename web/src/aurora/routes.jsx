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

export const auroraRoutePaths = {
  public: [
    '/',
    '/forbidden',
    '/login',
    '/register',
    '/reset',
    '/user/reset',
    '/pricing',
    '/about',
    '/user-agreement',
    '/privacy-policy',
    '/oauth/github',
    '/oauth/discord',
    '/oauth/oidc',
    '/oauth/linuxdo',
    '/oauth/:provider',
  ],
  private: [
    '/console',
    '/console/channel',
    '/console/channel/create',
    '/console/channel/:id/edit',
    '/console/models',
    '/console/models/create',
    '/console/models/:id/edit',
    '/console/deployment',
    '/console/token',
    '/console/redemption',
    '/console/user',
    '/console/setting',
    '/console/setting/group-management',
    '/console/personal',
    '/console/topup',
    '/console/log',
    '/console/key-cost',
    '/console/callback',
    '/console/midjourney',
    '/console/task',
    '/console/assets',
    '/console/asset',
  ],
  auth: ['/console/chat/:id?'],
};

export const auroraRouteMap = {
  'landing': 'LandingPage',
  'forbidden': 'ForbiddenPage',
  'login': 'LoginPage',
  'register': 'RegisterPage',
  'reset': 'ResetPasswordPage',
  'dashboard': 'AuroraDashboard',
  'asset': 'Asset',
  'model-list': 'AuroraModelListPage',
  'token-list': 'AuroraTokenListPage',
  'channel-list': 'AuroraChannelListPage',
  'setting': 'AuroraSettingPage',
  'topup': 'AuroraTopUpPage',
};

