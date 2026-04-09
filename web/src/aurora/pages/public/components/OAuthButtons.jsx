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

import React from 'react';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';
import { IconGithubLogo } from '@douyinfe/semi-icons';
import { Icon } from '@douyinfe/semi-ui';
import OIDCIcon from '../../../../components/common/logo/OIDCIcon';
import LinuxDoIcon from '../../../../components/common/logo/LinuxDoIcon';
import WeChatIcon from '../../../../components/common/logo/WeChatIcon';
import { Button } from '../../primitives/button';

const OAuthButtons = ({
  hasOAuthLoginOptions,
  status,
  handlers,
  disabledMap = {},
  isLoading = false,
  className = '',
}) => {
  const { t } = useTranslation();
  if (!hasOAuthLoginOptions) {
    return null;
  }

  const githubButtonText = isLoading ? t('正在跳转 GitHub...') : t('使用 GitHub 继续');

  return (
    <div className={`aurora-oauth-buttons ${className}`}>
      {status.wechat_login && (
        <Button
          type='button'
          variant='outline'
          size='lg'
          onClick={handlers.onWeChatLoginClicked}
          disabled={disabledMap.wechat}
          className='aurora-auth-cta-btn'
        >
          <Icon style={{ color: '#07C160' }} svg={<WeChatIcon />} />
          <span>{t('使用 微信 继续')}</span>
        </Button>
      )}

      {status.github_oauth && (
        <Button
          type='button'
          variant='outline'
          size='lg'
          onClick={handlers.onGitHubLoginClicked}
          disabled={disabledMap.github}
          className='aurora-auth-cta-btn'
        >
          <IconGithubLogo size='large' />
          <span>{githubButtonText}</span>
        </Button>
      )}

      {status.discord_oauth && (
        <Button
          type='button'
          variant='outline'
          size='lg'
          onClick={handlers.onDiscordLoginClicked}
          disabled={disabledMap.discord}
          className='aurora-auth-cta-btn'
        >
          <SiDiscord style={{ color: '#5865F2' }} />
          <span>{t('使用 Discord 继续')}</span>
        </Button>
      )}

      {status.oidc_enabled && (
        <Button
          type='button'
          variant='outline'
          size='lg'
          onClick={handlers.onOIDCLoginClicked}
          className='aurora-auth-cta-btn'
        >
          <OIDCIcon style={{ color: '#1877F2' }} />
          <span>{t('使用 OIDC 继续')}</span>
        </Button>
      )}

      {status.linuxdo_oauth && (
        <Button
          type='button'
          variant='outline'
          size='lg'
          onClick={handlers.onLinuxDOLoginClicked}
          className='aurora-auth-cta-btn'
        >
          <LinuxDoIcon style={{ color: '#E95420' }} />
          <span>{t('使用 LinuxDO 继续')}</span>
        </Button>
      )}

      {(status.custom_oauth_providers || []).map((provider) => (
        <Button
          key={provider.slug}
          type='button'
          variant='outline'
          size='lg'
          onClick={() => handlers.onCustomOAuthLoginClicked(provider)}
          loading={disabledMap.customOAuth === provider.slug}
          className='aurora-auth-cta-btn'
        >
          {provider.icon ? <span>{provider.icon}</span> : null}
          <span>{t('使用')} {provider.name} {t('继续')}</span>
        </Button>
      ))}
    </div>
  );
};

export default OAuthButtons;
