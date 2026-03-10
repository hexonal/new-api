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
import { Modal } from '@douyinfe/semi-ui';

function formatPreviewContent(content) {
  if (typeof content !== 'string') {
    return content || '';
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch (error) {
    return content;
  }
}

const ContentPreviewModal = ({
  isPreviewModalOpen,
  setIsPreviewModalOpen,
  previewModalTitle,
  previewModalContent,
}) => {
  const formattedContent = formatPreviewContent(previewModalContent);
  return (
    <Modal
      title={previewModalTitle}
      visible={isPreviewModalOpen}
      onCancel={() => setIsPreviewModalOpen(false)}
      onOk={() => setIsPreviewModalOpen(false)}
      width={900}
      bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
    >
      <pre
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.6,
          fontSize: 13,
        }}
      >
        {formattedContent}
      </pre>
    </Modal>
  );
};

export default ContentPreviewModal;
