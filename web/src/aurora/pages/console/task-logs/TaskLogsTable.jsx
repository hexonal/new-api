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
import { Table, Tbody, Td, Th, Thead, Tr } from '../../../primitives/table';
import {
  formatTaskDuration,
  formatTaskTimestamp,
  getTaskConsumedModelName,
  getTaskListDetailAction,
  getTaskModelName,
  getTaskPlatformMeta,
  getTaskProgressInfo,
  getTaskStatusMeta,
  getTaskTypeMeta,
} from './task-log-utils';

const TASK_COLUMN_WIDTHS = {
  submit_time: 'w-[160px]',
  finish_time: 'w-[160px]',
  duration: 'w-[110px]',
  channel: 'w-[150px]',
  username: 'w-[140px]',
  platform: 'w-[130px]',
  type: 'w-[130px]',
  model: 'w-[180px]',
  task_id: 'w-[250px]',
  task_status: 'w-[120px]',
  progress: 'w-[140px]',
  fail_reason: 'w-[160px]',
};

function getAvatarColor(name) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360} 70% 45%)`;
}

function StatusBadge({ status, t }) {
  const meta = getTaskStatusMeta(status);
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${meta.badgeClassName}`}
    >
      {t(meta.labelKey)}
    </span>
  );
}

function PlatformBadge({ platform }) {
  const meta = getTaskPlatformMeta(platform);
  return (
    <span
      className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${meta.className}`}
    >
      <span className='h-2 w-2 rounded-full bg-current opacity-70' />
      {meta.label}
    </span>
  );
}

function TypeBadge({ log, t }) {
  const meta = getTaskTypeMeta(log, t);
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function ProgressCell({ progress, status }) {
  const progressInfo = getTaskProgressInfo(progress);
  const meta = getTaskStatusMeta(status);

  if (progressInfo.numericValue === null) {
    return (
      <span className='text-xs text-on-surface-variant'>
        {progressInfo.displayText}
      </span>
    );
  }

  return (
    <div className='min-w-[140px]'>
      <div className='h-1.5 overflow-hidden rounded-full bg-surface-container-high'>
        <div
          className={`h-full rounded-full ${meta.progressClassName}`}
          style={{ width: `${progressInfo.numericValue}%` }}
        />
      </div>
      <div className='mt-1 text-xs text-on-surface-variant'>
        {progressInfo.displayText}
      </div>
    </div>
  );
}

function ModelValue({ log, t }) {
  const modelName = getTaskModelName(log);
  const consumedModel = getTaskConsumedModelName(log);
  const showConsumedModel =
    consumedModel !== '-' && consumedModel !== modelName;

  return (
    <div className='space-y-1'>
      <span className='inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700'>
        {modelName}
      </span>
      {showConsumedModel ? (
        <span className='inline-flex rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700'>
          {t('消耗模型')}: {consumedModel}
        </span>
      ) : null}
    </div>
  );
}

function ResultAction({ label, onClick, title }) {
  return (
    <button
      type='button'
      className='max-w-full text-left text-xs font-semibold text-primary hover:underline'
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  );
}

function PreviewActionCell({ log, onDetailAction, t }) {
  const action = getTaskListDetailAction(log);

  if (action.type === 'none') {
    return <span className='text-xs text-on-surface-variant'>{t('无')}</span>;
  }

  if (action.type === 'audio') {
    return (
      <ResultAction
        label={t('点击预览音乐')}
        onClick={() => onDetailAction(log)}
      />
    );
  }

  if (action.type === 'image') {
    return (
      <ResultAction
        label={t('点击预览图片')}
        onClick={() => onDetailAction(log)}
      />
    );
  }

  if (action.type === 'video') {
    return (
      <ResultAction
        label={t('点击预览视频')}
        onClick={() => onDetailAction(log)}
      />
    );
  }

  return (
    <button
      type='button'
      className='block max-w-[180px] truncate text-left text-xs text-on-surface-variant hover:text-primary hover:underline'
      onClick={() => onDetailAction(log)}
      title={String(action.payload || '')}
    >
      {String(action.payload || '-')}
    </button>
  );
}

function DurationBadge({ submitTime, finishTime }) {
  const durationText = formatTaskDuration(submitTime, finishTime);
  if (durationText === '-') {
    return <span className='text-xs text-on-surface-variant'>-</span>;
  }

  const durationValue = Number(durationText.replace('s', ''));
  const className =
    durationValue > 60
      ? 'bg-rose-50 text-rose-600'
      : 'bg-emerald-50 text-emerald-700';

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      {durationText.replace('s', ' s')}
    </span>
  );
}

function ChannelCell({ log, onCopy, t }) {
  if (!log?.channel_name && !log?.channel_id) {
    return <span className='text-xs text-on-surface-variant'>-</span>;
  }

  return (
    <button
      type='button'
      className='inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200'
      onClick={() => onCopy(log.channel_id)}
      title={
        log.channel_id
          ? `${log.channel_name || t('未知渠道')} | ID: ${log.channel_id}`
          : t('未知渠道')
      }
    >
      {log.channel_name || log.channel_id}
    </button>
  );
}

function UsernameCell({ username }) {
  const displayName = String(username || '?');
  const avatarColor = getAvatarColor(displayName);

  return (
    <div className='flex items-center gap-2'>
      <span
        className='inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white'
        style={{ backgroundColor: avatarColor }}
      >
        {displayName.slice(0, 1).toUpperCase()}
      </span>
      <span className='text-sm text-on-surface'>{displayName}</span>
    </div>
  );
}

function renderCell(
  columnKey,
  log,
  isAdminUser,
  onTaskIdClick,
  onDetailAction,
  onCopy,
  t,
) {
  switch (columnKey) {
    case 'submit_time':
      return (
        <span className='text-xs text-on-surface-variant'>
          {formatTaskTimestamp(log.submit_time)}
        </span>
      );
    case 'finish_time':
      return (
        <span className='text-xs text-on-surface-variant'>
          {formatTaskTimestamp(log.finish_time)}
        </span>
      );
    case 'duration':
      return (
        <DurationBadge
          submitTime={log.submit_time}
          finishTime={log.finish_time}
        />
      );
    case 'channel':
      return isAdminUser ? (
        <ChannelCell log={log} onCopy={onCopy} t={t} />
      ) : (
        <span className='text-xs text-on-surface-variant'>-</span>
      );
    case 'username':
      return isAdminUser ? <UsernameCell username={log.username} /> : null;
    case 'platform':
      return <PlatformBadge platform={log.platform} />;
    case 'type':
      return <TypeBadge log={log} t={t} />;
    case 'model':
      return <ModelValue log={log} t={t} />;
    case 'task_id':
      return (
        <button
          type='button'
          className='block max-w-[220px] truncate font-mono text-left text-xs text-on-surface-variant hover:text-primary hover:underline'
          onClick={() => onTaskIdClick(log)}
          title={log.task_id || '-'}
        >
          {log.task_id || '-'}
        </button>
      );
    case 'task_status':
      return <StatusBadge status={log.status} t={t} />;
    case 'progress':
      return <ProgressCell progress={log.progress} status={log.status} />;
    case 'fail_reason':
      return (
        <PreviewActionCell log={log} onDetailAction={onDetailAction} t={t} />
      );
    default:
      return <span className='text-xs text-on-surface-variant'>-</span>;
  }
}

export default function TaskLogsTable({
  logs,
  loading,
  visibleColumns,
  isAdminUser,
  onTaskIdClick,
  onDetailAction,
  onCopy,
  t,
}) {
  const columns = React.useMemo(() => {
    const order = [
      'submit_time',
      'finish_time',
      'duration',
      'channel',
      'username',
      'platform',
      'type',
      'model',
      'task_id',
      'task_status',
      'progress',
      'fail_reason',
    ];

    return order.filter((key) => {
      if (!isAdminUser && ['channel', 'username'].includes(key)) {
        return false;
      }
      return visibleColumns[key] !== false;
    });
  }, [isAdminUser, visibleColumns]);

  return (
    <section className='overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm'>
      <div className='overflow-x-auto'>
        <Table className='min-w-full table-fixed'>
          <Thead className='bg-surface-container-low'>
            <Tr className='border-outline-variant hover:bg-surface-container-low'>
              {columns.map((column) => (
                <Th
                  key={column}
                  className={`${TASK_COLUMN_WIDTHS[column] || ''} whitespace-nowrap px-6 py-4 text-xs font-semibold text-on-surface-variant`}
                >
                  {t(
                    {
                      submit_time: 'Submitted Time',
                      finish_time: 'Completed Time',
                      duration: 'Duration',
                      channel: 'Channel',
                      username: 'User',
                      platform: 'Platform',
                      type: 'Type',
                      model: 'Model',
                      task_id: 'Task ID',
                      task_status: 'Status',
                      progress: 'Progress',
                      fail_reason: 'Details',
                    }[column],
                  )}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              <Tr className='border-outline-variant hover:bg-surface-container-lowest'>
                <Td
                  colSpan={columns.length}
                  className='px-6 py-10 text-center text-sm text-on-surface-variant'
                >
                  {t('加载中...')}
                </Td>
              </Tr>
            ) : null}

            {!loading && logs.length === 0 ? (
              <Tr className='border-outline-variant hover:bg-surface-container-lowest'>
                <Td
                  colSpan={columns.length}
                  className='px-6 py-10 text-center text-sm text-on-surface-variant'
                >
                  {t('暂无数据')}
                </Td>
              </Tr>
            ) : null}

            {!loading
              ? logs.map((log) => (
                  <Tr
                    key={log.key}
                    className='border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                  >
                    {columns.map((column) => (
                      <Td
                        key={`${log.key}-${column}`}
                        className='px-6 py-4 align-top'
                      >
                        {renderCell(
                          column,
                          log,
                          isAdminUser,
                          onTaskIdClick,
                          onDetailAction,
                          onCopy,
                          t,
                        )}
                      </Td>
                    ))}
                  </Tr>
                ))
              : null}
          </Tbody>
        </Table>
      </div>
    </section>
  );
}
