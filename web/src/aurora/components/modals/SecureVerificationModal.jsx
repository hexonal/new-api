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

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import { Input } from '../../primitives/input';
import { Button } from '../../primitives/button';

export default function SecureVerificationModal({
  open = false,
  onCancel = () => {},
  verificationMethods = {},
  verificationState = {},
  onVerify,
  onCodeChange,
  onMethodSwitch,
  title,
  description,
}) {
  const { t } = useTranslation();
  const [localCode, setLocalCode] = useState('');

  const has2FA = Boolean(verificationMethods.has2FA);
  const hasPasskey = Boolean(verificationMethods.hasPasskey);
  const passkeySupported = verificationMethods.passkeySupported !== false;
  const activeMethod = verificationState.method || (has2FA ? '2fa' : 'passkey');
  const code = verificationState.code ?? localCode;
  const loading = Boolean(verificationState.loading);

  const methodOptions = useMemo(() => {
    const list = [];
    if (has2FA) list.push({ id: '2fa', label: t('两步验证') });
    if (hasPasskey && passkeySupported)
      list.push({ id: 'passkey', label: t('Passkey') });
    return list;
  }, [has2FA, hasPasskey, passkeySupported, t]);

  const handleCode = (value) => {
    setLocalCode(value);
    onCodeChange?.(value);
  };

  const handleVerify = () => {
    onVerify?.(activeMethod, code);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : null)}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{title || t('安全验证')}</DialogTitle>
          <DialogDescription>
            {description || t('完成验证后才可继续执行敏感操作。')}
          </DialogDescription>
        </DialogHeader>

        {methodOptions.length === 0 ? (
          <div className='rounded-lg border border-border p-4 text-sm text-muted-foreground'>
            {t('当前账号未开启 2FA 或 Passkey，请先在个人设置中启用。')}
          </div>
        ) : (
          <div className='space-y-3'>
            <div className='flex gap-2'>
              {methodOptions.map((option) => (
                <Button
                  key={option.id}
                  size='sm'
                  variant={activeMethod === option.id ? 'default' : 'outline'}
                  onClick={() => onMethodSwitch?.(option.id)}
                  disabled={loading}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {activeMethod === '2fa' ? (
              <Input
                label={t('验证码')}
                placeholder={t('请输入6位验证码或备用码')}
                value={code}
                maxLength={8}
                onChange={(e) => handleCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && code) {
                    handleVerify();
                  }
                }}
              />
            ) : (
              <div className='rounded-lg border border-border p-4 text-sm text-muted-foreground'>
                {t('点击“验证”后将触发 Passkey 验证流程。')}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={onCancel} disabled={loading}>
            {t('取消')}
          </Button>
          <Button
            onClick={handleVerify}
            loading={loading}
            disabled={
              methodOptions.length === 0 ||
              (activeMethod === '2fa' && !code.trim())
            }
          >
            {t('验证')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
