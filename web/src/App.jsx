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

import React, { lazy, Suspense, useContext, useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Loading from './components/common/ui/Loading';
import User from './pages/User';
import { AuthRedirect, PrivateRoute, AdminRoute } from './helpers';
import RegisterForm from './components/auth/RegisterForm';
import LoginForm from './components/auth/LoginForm';
import NotFound from './pages/NotFound';
import Forbidden from './pages/Forbidden';
import Setting from './pages/Setting';
import GroupManagement from './pages/Setting/GroupManagement';
import { StatusContext } from './context/Status';
import { useThemeStore } from './aurora/store/theme-store';

import PasswordResetForm from './components/auth/PasswordResetForm';
import PasswordResetConfirm from './components/auth/PasswordResetConfirm';
import Channel from './pages/Channel';
import Token from './pages/Token';
import Redemption from './pages/Redemption';
import TopUp from './pages/TopUp';
import Log from './pages/Log';
import CallbackLog from './pages/CallbackLog';
import Chat from './pages/Chat';
import Chat2Link from './pages/Chat2Link';
import Midjourney from './pages/Midjourney';
import Pricing from './pages/Pricing';
import Task from './pages/Task';
import ModelPage from './pages/Model';
import ModelDeploymentPage from './pages/ModelDeployment';
import Playground from './pages/Playground';
import Subscription from './pages/Subscription';
import OAuth2Callback from './components/auth/OAuth2Callback';
import PersonalSetting from './components/settings/PersonalSetting';
import Setup from './pages/Setup';
import SetupCheck from './components/layout/SetupCheck';
import LandingPage from './aurora/pages/public/LandingPage';
import LoginPage from './aurora/pages/public/LoginPage';
import RegisterPage from './aurora/pages/public/RegisterPage';
import ResetPasswordPage from './aurora/pages/public/ResetPasswordPage';
import ModelsExplorerPage from './aurora/pages/public/ModelsExplorerPage';
import NotFoundPage from './aurora/pages/public/NotFoundPage';
import ForbiddenPage from './aurora/pages/public/ForbiddenPage';
import {
  isLandingPageEnabled,
  isSystemHomeEnabled,
  shouldRedirectHomeToLogin,
} from './aurora/layout/top-nav-utils';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const KeyCostAnalysis = lazy(() => import('./pages/KeyCostAnalysis'));
const About = lazy(() => import('./pages/About'));
const UserAgreement = lazy(() => import('./pages/UserAgreement'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Asset = lazy(() => import('./pages/Asset'));
const AuroraApp = lazy(() => import('./aurora'));
const AuroraDashboardPage = lazy(() => import('./aurora/pages/console/DashboardPage'));
const AuroraTokenListPage = lazy(() => import('./aurora/pages/console/TokenListPage'));
const AuroraUsageLogsPage = lazy(() => import('./aurora/pages/console/UsageLogsPage'));
const AuroraKeyCostPage = lazy(() => import('./aurora/pages/console/KeyCostPage'));
const AuroraCallbackLogsPage = lazy(() => import('./aurora/pages/console/CallbackLogsPage'));
const AuroraMjLogsPage = lazy(() => import('./aurora/pages/console/MjLogsPage'));
const AuroraTaskLogsPage = lazy(() => import('./aurora/pages/console/TaskLogsPage'));
const AuroraModelDeploymentPage = lazy(() =>
  import('./aurora/pages/console/ModelDeploymentPage'),
);
const AuroraChannelListPage = lazy(() => import('./aurora/pages/admin/ChannelListPage'));
const AuroraChannelFormPage = lazy(() => import('./aurora/pages/admin/ChannelFormPage'));
const AuroraModelListPage = lazy(() => import('./aurora/pages/admin/ModelListPage'));
const AuroraModelFormPage = lazy(() => import('./aurora/pages/admin/ModelFormPage'));
const AuroraUserListPage = lazy(() => import('./aurora/pages/admin/UserListPage'));
const AuroraGroupManagementPage = lazy(() => import('./aurora/pages/admin/GroupManagementPage'));
const AuroraSubscriptionPage = lazy(() => import('./aurora/pages/admin/SubscriptionPage'));
const AuroraRedemptionPage = lazy(() => import('./aurora/pages/admin/RedemptionPage'));
const AuroraSettingPage = lazy(() => import('./aurora/pages/settings/SettingsPage'));
const AuroraPersonalSettingsPage = lazy(() => import('./aurora/pages/account/PersonalSettingsPage'));
const AuroraTopUpPage = lazy(() => import('./aurora/pages/account/TopUpPage'));

function DynamicOAuth2Callback() {
  const { provider } = useParams();
  return <OAuth2Callback type={provider} />;
}

export function LegacyApp({ isAuroraTheme = false }) {
  const location = useLocation();
  const [statusState] = useContext(StatusContext);
  const headerNavModulesConfig = statusState?.status?.HeaderNavModules;
  const isAuthenticated =
    typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('user'));

  // 获取模型广场权限配置
  const pricingRequireAuth = useMemo(() => {
    if (headerNavModulesConfig) {
      try {
        const modules = JSON.parse(headerNavModulesConfig);

        // 处理向后兼容性：如果pricing是boolean，默认不需要登录
        if (typeof modules.pricing === 'boolean') {
          return false; // 默认不需要登录鉴权
        }

        // 如果是对象格式，使用requireAuth配置
        return modules.pricing?.requireAuth === true;
      } catch (error) {
        console.error('解析顶栏模块配置失败:', error);
        return false; // 默认不需要登录
      }
    }
    return false; // 默认不需要登录
  }, [headerNavModulesConfig]);

  const landingPageEnabled = useMemo(() => {
    return isLandingPageEnabled(headerNavModulesConfig);
  }, [headerNavModulesConfig]);

  const homePageEnabled = useMemo(() => {
    return isSystemHomeEnabled(headerNavModulesConfig);
  }, [headerNavModulesConfig]);

  const shouldRedirectHome = useMemo(() => {
    return shouldRedirectHomeToLogin({
      headerNavModulesConfig,
      isAuthenticated,
    });
  }, [headerNavModulesConfig, isAuthenticated]);

  return (
    <SetupCheck>
      <Routes>
        <Route
          path='/'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              {shouldRedirectHome ? (
                <Navigate
                  to='/login'
                  replace
                  state={{ from: location }}
                />
              ) : !landingPageEnabled && !homePageEnabled ? (
                <Navigate
                  to={isAuthenticated ? '/console' : '/login'}
                  replace
                  state={{ from: location }}
                />
              ) : isAuroraTheme ? (
                landingPageEnabled ? <LandingPage /> : <Home />
              ) : homePageEnabled ? (
                <Home />
              ) : (
                <Navigate
                  to={isAuthenticated ? '/console' : '/login'}
                  replace
                  state={{ from: location }}
                />
              )}
            </Suspense>
          }
        />
        <Route
          path='/setup'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <Setup />
            </Suspense>
          }
        />
        <Route
          path='/forbidden'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              {isAuroraTheme ? <ForbiddenPage /> : <Forbidden />}
            </Suspense>
          }
        />
        <Route
          path='/console/models'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraModelListPage />
                </Suspense>
              ) : (
                <ModelPage />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/models/create'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraModelFormPage />
                </Suspense>
              ) : (
                <ModelPage />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/models/:id/edit'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraModelFormPage />
                </Suspense>
              ) : (
                <ModelPage />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/deployment'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraModelDeploymentPage />
                </Suspense>
              ) : (
                <ModelDeploymentPage />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/subscription'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraSubscriptionPage />
                </Suspense>
              ) : (
                <Subscription />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/channel'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraChannelListPage />
                </Suspense>
              ) : (
                <Channel />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/channel/create'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraChannelFormPage />
                </Suspense>
              ) : (
                <Channel />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/channel/:id/edit'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraChannelFormPage />
                </Suspense>
              ) : (
                <Channel />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/token'
          element={
            <PrivateRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraTokenListPage />
                </Suspense>
              ) : (
                <Token />
              )}
            </PrivateRoute>
          }
        />
        <Route
          path='/console/asset'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <Asset />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/playground'
          element={
            <PrivateRoute>
              <Playground />
            </PrivateRoute>
          }
        />
        <Route
          path='/console/redemption'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraRedemptionPage />
                </Suspense>
              ) : (
                <Redemption />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/user'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraUserListPage />
                </Suspense>
              ) : (
                <User />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/user/reset'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              {isAuroraTheme ? <ResetPasswordPage /> : <PasswordResetConfirm />}
            </Suspense>
          }
        />
        <Route
          path='/login'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              {isAuroraTheme ? (
                <LoginPage />
              ) : (
                <AuthRedirect>
                  <LoginForm />
                </AuthRedirect>
              )}
            </Suspense>
          }
        />
        <Route
          path='/register'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              {isAuroraTheme ? (
                <RegisterPage />
              ) : (
                <AuthRedirect>
                  <RegisterForm />
                </AuthRedirect>
              )}
            </Suspense>
          }
        />
        <Route
          path='/reset'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              {isAuroraTheme ? <ResetPasswordPage /> : <PasswordResetForm />}
            </Suspense>
          }
        />
        <Route
          path='/oauth/github'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <OAuth2Callback type='github'></OAuth2Callback>
            </Suspense>
          }
        />
        <Route
          path='/oauth/discord'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <OAuth2Callback type='discord'></OAuth2Callback>
            </Suspense>
          }
        />
        <Route
          path='/oauth/oidc'
          element={
            <Suspense fallback={<Loading></Loading>}>
              <OAuth2Callback type='oidc'></OAuth2Callback>
            </Suspense>
          }
        />
        <Route
          path='/oauth/linuxdo'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <OAuth2Callback type='linuxdo'></OAuth2Callback>
            </Suspense>
          }
        />
        <Route
          path='/oauth/:provider'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <DynamicOAuth2Callback />
            </Suspense>
          }
        />
        <Route
          path='/console/setting'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraSettingPage />
                </Suspense>
              ) : (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <Setting />
                </Suspense>
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/setting/group-management'
          element={
            <AdminRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraGroupManagementPage />
                </Suspense>
              ) : (
                <GroupManagement />
              )}
            </AdminRoute>
          }
        />
        <Route
          path='/console/personal'
          element={
            <PrivateRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraPersonalSettingsPage />
                </Suspense>
              ) : (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <PersonalSetting />
                </Suspense>
              )}
            </PrivateRoute>
          }
        />
        <Route
          path='/console/topup'
          element={
            <PrivateRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraTopUpPage />
                </Suspense>
              ) : (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <TopUp />
                </Suspense>
              )}
            </PrivateRoute>
          }
        />
        <Route
          path='/console/log'
          element={
            <PrivateRoute>
              {isAuroraTheme ? (
                <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                  <AuroraUsageLogsPage />
                </Suspense>
              ) : (
                <Log />
              )}
            </PrivateRoute>
          }
        />
        <Route
          path='/console/key-cost'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                {isAuroraTheme ? <AuroraKeyCostPage /> : <KeyCostAnalysis />}
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                {isAuroraTheme ? <AuroraDashboardPage /> : <Dashboard />}
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/midjourney'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                {isAuroraTheme ? <AuroraMjLogsPage /> : <Midjourney />}
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/task'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                {isAuroraTheme ? <AuroraTaskLogsPage /> : <Task />}
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path='/console/callback'
          element={
            <AdminRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                {isAuroraTheme ? <AuroraCallbackLogsPage /> : <CallbackLog />}
              </Suspense>
            </AdminRoute>
          }
        />
        <Route
          path='/pricing'
          element={
            isAuroraTheme ? (
              <ModelsExplorerPage />
            ) : pricingRequireAuth ? (
              <PrivateRoute>
                <Suspense
                  fallback={<Loading></Loading>}
                  key={location.pathname}
                >
                  <Pricing />
                </Suspense>
              </PrivateRoute>
            ) : (
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <Pricing />
              </Suspense>
            )
          }
        />
        <Route
          path='/about'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <About />
            </Suspense>
          }
        />
        <Route
          path='/user-agreement'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <UserAgreement />
            </Suspense>
          }
        />
        <Route
          path='/privacy-policy'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <PrivacyPolicy />
            </Suspense>
          }
        />
        <Route
          path='/console/chat/:id?'
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              <Chat />
            </Suspense>
          }
        />
        {/* 方便使用chat2link直接跳转聊天... */}
        <Route
          path='/chat2link'
          element={
            <PrivateRoute>
              <Suspense fallback={<Loading></Loading>} key={location.pathname}>
                <Chat2Link />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path={String.fromCharCode(42)}
          element={
            <Suspense fallback={<Loading></Loading>} key={location.pathname}>
              {isAuroraTheme ? <NotFoundPage /> : <NotFound />}
            </Suspense>
          }
        />
      </Routes>
    </SetupCheck>
  );
}

function App() {
  const theme = useThemeStore((state) => state.theme);
  const hydrateTheme = useThemeStore((state) => state.hydrateTheme);

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  if (theme === 'aurora') {
    return (
      <Suspense fallback={<Loading></Loading>}>
        <AuroraApp />
      </Suspense>
    );
  }

  return <LegacyApp />;
}

export default App;
