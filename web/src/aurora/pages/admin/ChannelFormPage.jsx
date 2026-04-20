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

import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import EditChannelModal from '../../../components/table/channels/modals/EditChannelModal';

/**
 * Aurora 渠道路由态编辑页。
 *
 * 这里直接复用旧版 EditChannelModal 作为路由态编辑器，
 * 保证字段、回填和提交逻辑与旧版完全一致，避免 Aurora 精简表单遗漏字段。
 *
 * @returns {JSX.Element}
 */
export default function ChannelFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const editingChannel = useMemo(
    () => ({
      id: id ? Number(id) : undefined,
    }),
    [id],
  );

  const handleClose = () => {
    navigate('/console/channel');
  };

  return (
    <EditChannelModal
      visible={true}
      routeMode={true}
      mask={false}
      width={1080}
      placement='right'
      editingChannel={editingChannel}
      refresh={() => undefined}
      handleClose={handleClose}
    />
  );
}
