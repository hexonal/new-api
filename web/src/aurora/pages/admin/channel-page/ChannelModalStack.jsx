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
import BatchTagModal from '../../../../components/table/channels/modals/BatchTagModal';
import ModelTestModal from '../../../../components/table/channels/modals/ModelTestModal';
import ColumnSelectorModal from '../../../../components/table/channels/modals/ColumnSelectorModal';
import EditTagModal from '../../../../components/table/channels/modals/EditTagModal';
import MultiKeyManageModal from '../../../../components/table/channels/modals/MultiKeyManageModal';
import ChannelUpstreamUpdateModal from '../../../../components/table/channels/modals/ChannelUpstreamUpdateModal';

/**
 * 复用旧版关键弹窗，确保 Aurora 页面先对齐业务能力。
 * @param {Record<string, unknown>} props - 旧版 hook 状态与动作
 * @returns {JSX.Element}
 */
export default function ChannelModalStack(props) {
  return (
    <>
      <ColumnSelectorModal {...props} />
      <EditTagModal
        visible={props.showEditTag}
        tag={props.editingTag}
        handleClose={() => props.setShowEditTag(false)}
        refresh={props.refresh}
      />
      <BatchTagModal {...props} />
      <ModelTestModal {...props} />
      <MultiKeyManageModal
        visible={props.showMultiKeyManageModal}
        onCancel={() => props.setShowMultiKeyManageModal(false)}
        channel={props.currentMultiKeyChannel}
        onRefresh={props.refresh}
      />
      <ChannelUpstreamUpdateModal
        visible={props.showUpstreamUpdateModal}
        addModels={props.upstreamUpdateAddModels}
        removeModels={props.upstreamUpdateRemoveModels}
        preferredTab={props.upstreamUpdatePreferredTab}
        confirmLoading={props.upstreamApplyLoading}
        onConfirm={props.applyUpstreamUpdates}
        onCancel={props.closeUpstreamUpdateModal}
      />
    </>
  );
}
