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
import { IconCopy } from '@douyinfe/semi-icons';
import { getLogOther, renderNumber } from '../../../../helpers';
import {
  buildDetailPreviewLines,
  getCopyableText,
  getDetailRecordValue,
  renderDetailValue,
} from './page-utils';

const buildSummaryCards = (log, requestId, channelInfo, ipInfo, requestPath) => [
  {
    label: 'Request ID',
    value: requestId,
    tone: 'font-mono',
  },
  {
    label: 'Model',
    value: log?.model_name || '-',
  },
  {
    label: 'User',
    value: log?.username || '-',
  },
  {
    label: 'Channel',
    value: channelInfo,
  },
  {
    label: 'IP Address',
    value: ipInfo,
  },
  {
    label: 'Request Path',
    value: requestPath,
    tone: 'font-mono',
  },
];

const buildDetailRows = (details) =>
  details.map((item, index) => ({
    key: item?.key || `detail-${index}`,
    displayValue: renderDetailValue(item?.value),
    copyableText: getCopyableText(item?.value),
  }));

function DetailSummaryCard({ card, logKey, handleCopy }) {
  const valueText = getCopyableText(card.value);

  return (
    <div key={`${logKey}-${card.label}`}>
      <div className='mb-2 text-[10px] font-bold uppercase text-gray-400'>
        {card.label}
      </div>
      <div
        className={`flex items-center justify-between rounded border border-gray-100 bg-gray-50 p-2 text-xs ${card.tone || ''}`}
      >
        <span className='min-w-0 break-all pr-2'>{renderDetailValue(card.value)}</span>
        {valueText ? (
          <button
            type='button'
            className='inline-flex shrink-0 text-gray-500 transition-colors hover:text-primary'
            onClick={() => handleCopy(valueText)}
            aria-label={`copy ${card.label.toLowerCase()}`}
          >
            <IconCopy size='small' />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function UsageLogExpandedDetails({
  log,
  details,
  latencyClass,
  latencySeconds,
  statusMeta,
  handleCopy,
  detailColSpan,
}) {
  const other = getLogOther(log?.other);
  const requestId =
    log?.request_id ||
    other?.request_id ||
    other?.task_id ||
    getDetailRecordValue(details, ['request id', '任务id']) ||
    '-';
  const channelInfo =
    `${log?.channel_name || ''}${
      log?.channel && log?.channel_name ? ` (${log.channel})` : log?.channel || ''
    }` || getDetailRecordValue(details, ['渠道']) || '-';
  const ipInfo = log?.ip || getDetailRecordValue(details, ['ip', '地址']) || '-';
  const detailPreviewLines = buildDetailPreviewLines(details, requestId);
  const requestPath =
    getDetailRecordValue(details, ['请求路径', 'request path']) || '-';
  const summaryCards = buildSummaryCards(
    log,
    requestId,
    channelInfo,
    ipInfo,
    requestPath,
  );
  const detailRows = buildDetailRows(details);

  return (
    <tr className='border-b border-outline-variant bg-surface-container-lowest'>
      <td className='px-16 py-6' colSpan={detailColSpan}>
        <div className='space-y-5'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {summaryCards.map((card) => (
              <DetailSummaryCard
                key={`${log.key}-${card.label}`}
                card={card}
                logKey={log.key}
                handleCopy={handleCopy}
              />
            ))}

            <div>
              <div className='mb-2 text-[10px] font-bold uppercase text-gray-400'>
                Token Breakdown
              </div>
              <div className='flex items-center gap-4 rounded border border-gray-100 bg-gray-50 p-2 text-xs'>
                <div>
                  <span className='text-gray-400'>Prompt:</span>{' '}
                  {renderNumber(log?.prompt_tokens || 0)}
                </div>
                <div>
                  <span className='text-gray-400'>Completion:</span>{' '}
                  {renderNumber(log?.completion_tokens || 0)}
                </div>
              </div>
            </div>

            <div>
              <div className='mb-2 text-[10px] font-bold uppercase text-gray-400'>
                Preview
              </div>
              <div className='rounded border border-gray-100 bg-gray-50 p-2 text-xs text-on-surface-variant'>
                {detailPreviewLines.length > 0 ? detailPreviewLines.join('\n') : '-'}
              </div>
            </div>

            <div>
              <div className='mb-2 text-[10px] font-bold uppercase text-gray-400'>
                Runtime
              </div>
              <div className='rounded border border-gray-100 bg-gray-50 p-2 text-xs'>
                <div className={`flex items-center gap-1 font-medium ${latencyClass}`}>
                  <span className='h-1.5 w-1.5 rounded-full bg-current'></span>
                  {Number.isFinite(latencySeconds)
                    ? `${latencySeconds.toFixed(1)}s`
                    : '-'}
                </div>
                <div className='mt-2'>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${statusMeta.className}`}
                  >
                    {statusMeta.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {details.length > 0 && (
            <div className='usage-log-detail-panel rounded-lg border border-outline-variant bg-surface-container-low p-4'>
              <div className='mb-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant'>
                Full Details
              </div>
              <div className='usage-log-detail-list'>
                {detailRows.map((item) => (
                  <div
                    key={`${log.key}-${item.key}`}
                    className='usage-log-detail-row'
                  >
                    <div className='usage-log-detail-key'>{item.key}</div>
                    <div className='usage-log-detail-value'>{item.displayValue}</div>
                    {item.copyableText ? (
                      <button
                        type='button'
                        className='usage-log-detail-copy'
                        aria-label={`copy ${item.key}`}
                        onClick={() => handleCopy(item.copyableText)}
                      >
                        <IconCopy size='small' />
                      </button>
                    ) : (
                      <span className='usage-log-detail-copy-placeholder' />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
