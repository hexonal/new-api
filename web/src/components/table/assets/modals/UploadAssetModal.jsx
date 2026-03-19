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

import React, { useEffect, useMemo, useState } from 'react';
import { Form, Modal, Select } from '@douyinfe/semi-ui';
import { showError } from '../../../../helpers';

const UploadAssetModal = ({
  visible,
  onCancel,
  onSubmit,
  groups,
  billingTokens,
  loading,
  t,
}) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState(null);
  const [billingTokenId, setBillingTokenId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!visible) {
      setUrl('');
      setName('');
      setGroupId(null);
      setBillingTokenId(null);
      setPreviewUrl('');
    }
  }, [visible]);

  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        label: group.name || `${t('分组')} #${group.id}`,
        value: group.id,
      })),
    [groups, t],
  );

  const tokenOptions = useMemo(
    () =>
      (billingTokens || []).map((token) => ({
        label: token.name ? `${token.name} (#${token.id})` : `#${token.id}`,
        value: token.id,
      })),
    [billingTokens],
  );

  return (
    <Modal
      title={t('上传素材')}
      visible={visible}
      onCancel={onCancel}
      onOk={async () => {
        const normalizedUrl = url.trim();
        if (!normalizedUrl) {
          showError(t('素材 URL 不能为空'));
          return;
        }
        if (!groupId) {
          showError(t('请选择分组'));
          return;
        }
        if (!billingTokenId) {
          showError(t('请选择扣费密钥'));
          return;
        }
        await onSubmit({
          url: normalizedUrl,
          name: name.trim(),
          groupId,
          billingTokenId,
        });
      }}
      okText={t('上传')}
      cancelText={t('取消')}
      confirmLoading={loading}
      closeOnEsc
    >
      <Form>
        <Form.Input
          field='asset-url'
          label={t('素材 URL')}
          value={url}
          onChange={setUrl}
          onBlur={() => setPreviewUrl(url.trim())}
          placeholder={t('请输入图片 URL')}
          showClear
        />
        <Form.Input
          field='asset-name'
          label={t('素材名称')}
          value={name}
          onChange={setName}
          placeholder={t('请输入素材名称（可选）')}
          showClear
        />
        <Form.Slot label={t('所属分组')}>
          <Select
            value={groupId}
            optionList={groupOptions}
            onChange={setGroupId}
            placeholder={t('请选择分组')}
          />
        </Form.Slot>
        <Form.Slot label={t('扣费密钥')}>
          <Select
            value={billingTokenId}
            optionList={tokenOptions}
            onChange={setBillingTokenId}
            placeholder={t('请选择用于扣费的密钥')}
            emptyContent={t('暂无可用密钥')}
            filter
          />
        </Form.Slot>

        {previewUrl && (
          <div className='mt-3 rounded-xl overflow-hidden border border-[var(--semi-color-border)]'>
            <img
              src={previewUrl}
              alt={t('素材预览')}
              className='w-full max-h-56 object-contain bg-[var(--semi-color-fill-0)]'
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default UploadAssetModal;
