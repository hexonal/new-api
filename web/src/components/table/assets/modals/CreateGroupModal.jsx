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

import React, { useEffect, useState } from 'react';
import { Form, Modal } from '@douyinfe/semi-ui';
import { showError } from '../../../../helpers';

const CreateGroupModal = ({ visible, onCancel, onSubmit, loading, t }) => {
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!visible) {
      setCompany('');
      setName('');
    }
  }, [visible]);

  return (
    <Modal
      title={t('Create Group')}
      visible={visible}
      onCancel={onCancel}
      onOk={async () => {
        const trimmedCompany = company.trim();
        const trimmedName = name.trim();
        if (!trimmedCompany) {
          showError(t('公司不能为空'));
          return;
        }
        if (!trimmedName) {
          showError(t('名称不能为空'));
          return;
        }
        await onSubmit({
          name: `${trimmedCompany}-${trimmedName}`,
          description: '',
        });
      }}
      okText={t('Create')}
      cancelText={t('Cancel')}
      confirmLoading={loading}
      closeOnEsc
    >
      <Form>
        <Form.Input
          field='group-company'
          label={t('Company')}
          value={company}
          onChange={setCompany}
          placeholder={t('Enter company')}
          showClear
        />
        <Form.Input
          field='group-name'
          label={t('Name')}
          value={name}
          onChange={setName}
          placeholder={t('Enter name')}
          showClear
        />
      </Form>
    </Modal>
  );
};

export default CreateGroupModal;
