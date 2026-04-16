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
import { Copy, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../primitives/dialog';
import { Button } from '../../../primitives/button';
import {
  buildTaskDetailItems,
  getTaskDetailPanelValue,
  formatTaskJson,
  getTaskModelName,
  getTaskPlatformMeta,
  getTaskPreviewActionMeta,
  getTaskResultUrl,
  getTaskStatusMeta,
  getTaskTypeMeta,
  resolveTaskPreview,
} from './task-log-utils';

function MetaChip({ className, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className='grid gap-1 border-b border-outline-variant/70 py-3 sm:grid-cols-[148px_minmax(0,1fr)]'>
      <div className='text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant'>
        {label}
      </div>
      <div className='whitespace-pre-wrap break-all text-sm text-on-surface'>
        {value || '-'}
      </div>
    </div>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <section className='rounded-xl border border-outline-variant bg-white p-4 shadow-sm'>
      <div className='mb-3'>
        <div className='text-sm font-semibold text-on-surface'>{title}</div>
        {description ? (
          <div className='mt-1 text-xs text-on-surface-variant'>
            {description}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function AudioPreviewCard({ clip, t }) {
  const title = clip?.title || t('未命名');
  const audioUrl = clip?.audio_url;
  const imageUrl = clip?.image_url || clip?.image_large_url;

  return (
    <div className='flex gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4'>
      {imageUrl ? (
        <img
          alt={title}
          className='h-20 w-20 rounded-lg object-cover'
          src={imageUrl}
        />
      ) : null}
      <div className='min-w-0 flex-1'>
        <div className='mb-1 text-sm font-semibold text-on-surface'>
          {title}
        </div>
        <div className='mb-3 text-xs text-on-surface-variant'>
          {clip?.tags || clip?.metadata?.tags || '-'}
        </div>
        {audioUrl ? (
          <audio className='w-full' controls preload='none' src={audioUrl} />
        ) : null}
      </div>
    </div>
  );
}

function PreviewActions({ preview, previewUrl, onCopy, t }) {
  if (!previewUrl || preview.kind === 'audio' || preview.kind === 'none') {
    return null;
  }

  return (
    <div className='flex flex-wrap gap-2'>
      <Button
        variant='outline'
        className='border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'
        onClick={() => onCopy(previewUrl)}
      >
        <Copy className='mr-2 h-4 w-4' />
        {t('复制链接')}
      </Button>
      <a
        className='inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dim'
        href={previewUrl}
        rel='noreferrer'
        target='_blank'
      >
        <ExternalLink className='mr-2 h-4 w-4' />
        {t('新窗口打开')}
      </a>
    </div>
  );
}

function PreviewBody({ log, preview, t }) {
  if (preview.kind === 'image') {
    return (
      <img
        alt={log?.task_id || 'task-preview'}
        className='max-h-[420px] w-full rounded-xl border border-outline-variant bg-surface-container-low object-contain'
        src={preview.value}
      />
    );
  }

  if (preview.kind === 'video') {
    return (
      <video
        className='max-h-[420px] w-full rounded-xl border border-outline-variant bg-black object-contain'
        controls
        src={preview.value}
      />
    );
  }

  if (preview.kind === 'audio') {
    return (
      <div className='space-y-3'>
        {preview.value.map((clip, index) => (
          <AudioPreviewCard
            key={clip?.clip_id || clip?.id || index}
            clip={clip}
            t={t}
          />
        ))}
      </div>
    );
  }

  if (log?.fail_reason) {
    return (
      <div className='rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm leading-6 text-on-surface-variant'>
        {log.fail_reason}
      </div>
    );
  }

  return (
    <div className='flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-sm text-on-surface-variant'>
      {t('当前记录暂无可预览的媒体结果')}
    </div>
  );
}

function JsonBlock({ value }) {
  return (
    <pre className='max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-outline-variant bg-surface-container-low p-4 text-xs leading-5 text-on-surface-variant'>
      {value}
    </pre>
  );
}

export default function TaskLogDetailDialog({
  open,
  onOpenChange,
  log,
  isAdminUser,
  onCopy,
  t,
}) {
  const preview = React.useMemo(() => resolveTaskPreview(log || {}), [log]);
  const detailItems = React.useMemo(
    () => buildTaskDetailItems(log || {}, isAdminUser, t),
    [isAdminUser, log, t],
  );
  const modelName = getTaskModelName(log || {});
  const statusMeta = getTaskStatusMeta(log?.status);
  const platformMeta = getTaskPlatformMeta(log?.platform);
  const typeMeta = getTaskTypeMeta(log || {}, t);
  const previewMeta = getTaskPreviewActionMeta(log || {}, t);
  const previewUrl = getTaskResultUrl(log || {});
  const rawRecord = React.useMemo(() => formatTaskJson(log || {}), [log]);
  const detailPanel = React.useMemo(
    () => formatTaskJson(getTaskDetailPanelValue(log || {})),
    [log],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[92vh] w-[96vw] max-w-[1180px] overflow-hidden rounded-2xl border-outline-variant bg-surface-container-lowest p-0'>
        <DialogHeader className='border-b border-outline-variant bg-white px-6 py-5'>
          <DialogTitle className='space-y-3'>
            <div className='flex flex-wrap items-center gap-3 text-xl font-bold text-on-surface'>
              <span>{t('Task Details')}</span>
              <MetaChip className={statusMeta.badgeClassName}>
                {t(statusMeta.labelKey)}
              </MetaChip>
              <MetaChip className={platformMeta.className}>
                {platformMeta.label}
              </MetaChip>
              <MetaChip className={typeMeta.className}>
                {typeMeta.label}
              </MetaChip>
            </div>
            <div className='flex flex-wrap items-center gap-3 text-xs text-on-surface-variant'>
              <span>{modelName}</span>
              <span>{log?.task_id || '-'}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-5 overflow-y-auto px-6 py-5'>
          <SectionCard
            title={t('基础信息')}
            description={t('字段集合与旧版任务日志列表语义保持一致。')}
          >
            <div>
              {detailItems.map((item) => (
                <DetailItem
                  key={item.label}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title={t('详情面板')}
            description={t('详情与预览分离，详细响应在 JSON 面板中展示。')}
          >
            <JsonBlock value={detailPanel} />
          </SectionCard>

          <SectionCard title={t('结果预览')} description={previewMeta.label}>
            <div className='space-y-4'>
              <PreviewBody log={log} preview={preview} t={t} />
              <PreviewActions
                preview={preview}
                previewUrl={previewUrl}
                onCopy={onCopy}
                t={t}
              />
            </div>
          </SectionCard>

          <SectionCard
            title={t('完整记录')}
            description={t('对应旧版点击任务ID后展示的完整原始记录内容。')}
          >
            <JsonBlock value={rawRecord} />
          </SectionCard>
        </div>
      </DialogContent>
    </Dialog>
  );
}
