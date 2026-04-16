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
import { IconChevronDown } from '@douyinfe/semi-icons';
import { MoreHorizontal } from 'lucide-react';
import {
  getDetailRecordValue,
  getLatencyToneClass,
  resolveLatencySeconds,
  resolveStatusMeta,
  toPlainText,
} from './page-utils';
import UsageLogExpandedDetails from './UsageLogExpandedDetails';

const DETAIL_TOOLTIP_KEYS = ['计费过程', '日志详情', '订阅结算', '订阅说明'];
const DETAIL_EXCLUDE_KEYS = [
  'request id',
  '任务id',
  '渠道信息',
  '渠道',
  'ip',
  '输入 tokens',
  '输出 tokens',
  '计费过程',
  '日志详情',
  '订阅结算',
  '订阅说明',
];

const buildBillingHint = (details) => {
  const billingProcess = getDetailRecordValue(details, DETAIL_TOOLTIP_KEYS);
  const extraDetails = details.filter((item) => {
    const key = String(item?.key || '').toLowerCase();
    return !DETAIL_EXCLUDE_KEYS.some((exclude) => key.includes(exclude));
  });

  return [
    toPlainText(billingProcess),
    ...extraDetails
      .slice(0, 8)
      .map((item) => `${item?.key || ''}: ${toPlainText(item?.value)}`),
  ]
    .filter(Boolean)
    .join('\n');
};

export default function UsageLogRow({
  log,
  rowIndex,
  expanded,
  visibleColumns,
  detailColSpan,
  data,
  t,
  onToggle,
  handleCopy,
}) {
  const details = data.expandData?.[log.key] || [];
  const latencySeconds = resolveLatencySeconds(log);
  const latencyClass = getLatencyToneClass(latencySeconds || NaN);
  const statusMeta = resolveStatusMeta(log);
  const billingHint = buildBillingHint(details);

  return (
    <React.Fragment>
      <tr
        className={`cursor-pointer border-b border-outline-variant transition-colors hover:bg-surface-container ${
          expanded ? 'bg-primary/5' : ''
        }`}
        onClick={onToggle}
      >
        <td
          className={`px-6 py-3 ${expanded ? 'text-primary' : 'text-gray-400'}`}
        >
          <button
            type='button'
            className={`inline-flex transition-colors ${
              expanded ? 'text-primary' : 'text-gray-400 hover:text-primary'
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            <IconChevronDown
              className={`transition-transform ${expanded ? '' : '-rotate-90'}`}
              size='small'
            />
          </button>
        </td>

        {visibleColumns.map((column) => (
          <td
            key={`${log.key}-${column.key}`}
            className={`px-4 py-3 align-top ${
              column.key === data.COLUMN_KEYS.DETAILS ? 'max-w-[320px]' : ''
            }`}
            title={
              column.key === data.COLUMN_KEYS.COST
                ? billingHint || undefined
                : undefined
            }
          >
            {column.render(log, rowIndex)}
          </td>
        ))}

        <td className='px-4 py-3 text-right'>
          <button
            type='button'
            className='inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary'
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            aria-label={expanded ? t('收起详情') : t('查看详情')}
          >
            <MoreHorizontal className='h-4 w-4' />
          </button>
        </td>
      </tr>

      {expanded ? (
        <UsageLogExpandedDetails
          log={log}
          details={details}
          latencyClass={latencyClass}
          latencySeconds={latencySeconds}
          statusMeta={statusMeta}
          handleCopy={handleCopy}
          detailColSpan={detailColSpan}
        />
      ) : null}
    </React.Fragment>
  );
}
