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
import { Button } from '../../../primitives/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../primitives/dialog';
import { formatTaskJson } from './task-log-utils';

function JsonPanel({ value }) {
  return (
    <pre className='h-[min(70vh,960px)] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-outline-variant bg-slate-50 p-4 text-xs leading-5 text-on-surface-variant'>
      {formatTaskJson(value)}
    </pre>
  );
}

function AudioCard({ clip, onCopy, t }) {
  const audioUrl = clip?.audio_url || '';
  const imageUrl = clip?.image_url || clip?.image_large_url || '';
  const title = clip?.title || t('未命名');
  const tags = clip?.tags || clip?.metadata?.tags || '-';

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
        <div className='mb-3 text-xs text-on-surface-variant'>{tags}</div>
        {audioUrl ? (
          <>
            <audio className='w-full' controls preload='none' src={audioUrl} />
            <div className='mt-3 flex flex-wrap gap-2'>
              <Button
                variant='outline'
                className='border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'
                onClick={() => onCopy(audioUrl)}
              >
                <Copy className='mr-2 h-4 w-4' />
                {t('复制链接')}
              </Button>
              <a
                className='inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dim'
                href={audioUrl}
                rel='noreferrer'
                target='_blank'
              >
                <ExternalLink className='mr-2 h-4 w-4' />
                {t('新窗口打开')}
              </a>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function VideoPanel({ url, onCopy, t }) {
  return (
    <div className='space-y-4'>
      <video
        className='h-[min(62vh,720px)] w-full rounded-xl border border-outline-variant bg-black object-contain'
        controls
        src={url}
      />
      <div className='flex flex-wrap gap-2'>
        <Button
          variant='outline'
          className='border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'
          onClick={() => onCopy(url)}
        >
          <Copy className='mr-2 h-4 w-4' />
          {t('复制链接')}
        </Button>
        <a
          className='inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dim'
          href={url}
          rel='noreferrer'
          target='_blank'
        >
          <ExternalLink className='mr-2 h-4 w-4' />
          {t('新窗口打开')}
        </a>
      </div>
    </div>
  );
}

function renderQuickLookBody(quickLook, onCopy, t) {
  if (!quickLook) {
    return null;
  }

  if (quickLook.kind === 'audio') {
    const clips = Array.isArray(quickLook.value) ? quickLook.value : [];
    if (clips.length === 0) {
      return <div className='text-sm text-on-surface-variant'>{t('无')}</div>;
    }
    return (
      <div className='space-y-3'>
        {clips.map((clip, index) => (
          <AudioCard
            key={clip?.clip_id || clip?.id || index}
            clip={clip}
            onCopy={onCopy}
            t={t}
          />
        ))}
      </div>
    );
  }

  if (quickLook.kind === 'video') {
    return <VideoPanel url={quickLook.value} onCopy={onCopy} t={t} />;
  }

  return <JsonPanel value={quickLook.value} />;
}

export default function TaskLogQuickLookDialog({
  open,
  onOpenChange,
  quickLook,
  onCopy,
  t,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[92vh] w-[96vw] max-w-[960px] flex-col overflow-hidden rounded-2xl border-outline-variant bg-white p-0 shadow-2xl'>
        <DialogHeader className='border-b border-outline-variant bg-white px-6 py-5'>
          <DialogTitle className='text-xl font-bold text-on-surface'>
            {quickLook?.title || t('快速预览')}
          </DialogTitle>
        </DialogHeader>
        <div className='min-h-0 flex-1 overflow-auto bg-white px-6 py-5'>
          {renderQuickLookBody(quickLook, onCopy, t)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
