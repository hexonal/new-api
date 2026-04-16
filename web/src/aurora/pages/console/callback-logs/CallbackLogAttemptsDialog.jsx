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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../primitives/dialog';
import { Table, Tbody, Td, Th, Thead, Tr } from '../../../primitives/table';
import {
  formatCallbackTimestamp,
  formatDuration,
  formatJSONBlock,
  formatRetryProgress,
  getCallbackSourceMeta,
  getCallbackStatusMeta,
} from './callback-log-utils';

function BlockTitle({ children }) {
  return (
    <div className='mb-2 text-sm font-semibold text-on-surface'>{children}</div>
  );
}

function CodeBlock({ value }) {
  return (
    <pre className='max-h-56 overflow-auto rounded-lg bg-[#f5f7fb] p-3 text-xs leading-5 text-on-surface whitespace-pre-wrap break-words'>
      {value}
    </pre>
  );
}

function MetaLine({ label, value }) {
  return (
    <div className='text-sm text-on-surface-variant'>
      <span className='font-medium text-on-surface'>{label}: </span>
      {value || '-'}
    </div>
  );
}

function MetaCard({ label, value, tone = 'default' }) {
  const toneClassName =
    tone === 'strong'
      ? 'border-primary/20 bg-primary/5 text-primary'
      : 'border-[#e5eaf1] bg-white text-on-surface shadow-sm';

  return (
    <div className={`rounded-xl border p-3 ${toneClassName}`}>
      <div className='text-[11px] uppercase tracking-wide text-on-surface-variant'>
        {label}
      </div>
      <div className='mt-1 break-all text-sm font-semibold'>{value || '-'}</div>
    </div>
  );
}

function Badge({ label, className }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

export default function CallbackLogAttemptsDialog({
  open,
  onOpenChange,
  event,
  attempts,
  attemptsLoading,
  t,
}) {
  const statusMeta = getCallbackStatusMeta(event?.status);
  const sourceMeta = getCallbackSourceMeta(event?.source);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[92vh] w-[96vw] max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-[#d9e0ea] bg-[#f7f9fc] p-0 shadow-[0_30px_90px_rgba(15,23,42,0.16)]'>
        <DialogHeader className='border-b border-outline-variant bg-white px-6 py-5'>
          <DialogTitle className='text-xl font-bold text-on-surface'>
            {t('重试明细')}
          </DialogTitle>
          <DialogDescription className='mt-1 text-sm text-on-surface-variant'>
            {t('查看回调请求头、请求体与每次重试结果。')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 space-y-5 overflow-y-auto bg-[#f7f9fc] px-6 py-5'>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
            <MetaCard
              label={t('事件 ID')}
              value={event?.event_id || event?.id}
            />
            <MetaCard label={t('Request ID')} value={event?.request_id} />
            <MetaCard
              label={t('重试进度')}
              value={formatRetryProgress(event)}
              tone='strong'
            />
            <MetaCard
              label={t('最近 HTTP 状态')}
              value={event?.last_http_status}
              tone='strong'
            />
          </div>

          <div className='space-y-2 rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-sm'>
            <MetaLine
              label={t('状态')}
              value={
                <Badge
                  label={t(statusMeta.labelKey)}
                  className={statusMeta.badgeClassName}
                />
              }
            />
            <MetaLine
              label={t('来源')}
              value={
                <Badge
                  label={t(sourceMeta.labelKey)}
                  className={sourceMeta.className}
                />
              }
            />
            <MetaLine label={t('事件类型')} value={event?.event_type} />
            <MetaLine
              label={t('创建时间')}
              value={formatCallbackTimestamp(event?.created_at)}
            />
            <MetaLine label={t('用户名')} value={event?.username} />
            <MetaLine label={t('用户 ID')} value={event?.user_id} />
            <MetaLine
              label={t('目标 SK')}
              value={event?.token_sk || event?.token_sk_masked}
            />
            <MetaLine label={t('回调地址')} value={event?.callback_url} />
            <MetaLine
              label={t('请求方式')}
              value={event?.request_method || 'POST'}
            />
            <MetaLine
              label={t('内容类型')}
              value={event?.content_type || 'application/json'}
            />
            <MetaLine label={t('最近错误')} value={event?.last_error} />
          </div>

          <div className='grid grid-cols-1 gap-5 xl:grid-cols-2'>
            <div className='rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-sm'>
              <BlockTitle>{t('发送请求头')}</BlockTitle>
              <CodeBlock value={formatJSONBlock(event?.request_headers)} />
            </div>
            <div className='rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-sm'>
              <BlockTitle>{t('发送内容')}</BlockTitle>
              <CodeBlock value={formatJSONBlock(event?.request_body)} />
            </div>
          </div>

          <div>
            <BlockTitle>{t('重试记录')}</BlockTitle>
            <div className='overflow-hidden rounded-xl border border-[#e5eaf1] bg-white shadow-sm'>
              <Table className='bg-white'>
                <Thead className='bg-[#f5f7fb]'>
                  <Tr className='border-outline-variant hover:bg-surface-container-low'>
                    <Th className='px-4 py-3 text-xs font-bold uppercase tracking-wider'>
                      {t('尝试次数')}
                    </Th>
                    <Th className='px-4 py-3 text-xs font-bold uppercase tracking-wider'>
                      {t('开始时间')}
                    </Th>
                    <Th className='px-4 py-3 text-xs font-bold uppercase tracking-wider'>
                      {t('结束时间')}
                    </Th>
                    <Th className='px-4 py-3 text-xs font-bold uppercase tracking-wider'>
                      {t('耗时')}
                    </Th>
                    <Th className='px-4 py-3 text-xs font-bold uppercase tracking-wider'>
                      {t('HTTP 状态')}
                    </Th>
                    <Th className='px-4 py-3 text-xs font-bold uppercase tracking-wider'>
                      {t('结果')}
                    </Th>
                    <Th className='px-4 py-3 text-xs font-bold uppercase tracking-wider'>
                      {t('错误信息')}
                    </Th>
                    <Th className='px-4 py-3 text-xs font-bold uppercase tracking-wider'>
                      {t('响应片段')}
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {attemptsLoading ? (
                    <Tr className='border-outline-variant hover:bg-surface-container-lowest'>
                      <Td
                        colSpan={8}
                        className='px-4 py-8 text-center text-sm text-on-surface-variant'
                      >
                        {t('加载中...')}
                      </Td>
                    </Tr>
                  ) : null}

                  {!attemptsLoading && attempts.length === 0 ? (
                    <Tr className='border-outline-variant hover:bg-surface-container-lowest'>
                      <Td
                        colSpan={8}
                        className='px-4 py-8 text-center text-sm text-on-surface-variant'
                      >
                        {t('暂无重试记录')}
                      </Td>
                    </Tr>
                  ) : null}

                  {!attemptsLoading
                    ? attempts.map((attempt) => (
                        <Tr
                          key={attempt.key}
                          className='border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                        >
                          <Td className='px-4 py-3 text-xs'>
                            {attempt.attempt_no || '-'}
                          </Td>
                          <Td className='px-4 py-3 text-xs'>
                            {formatCallbackTimestamp(attempt.started_at)}
                          </Td>
                          <Td className='px-4 py-3 text-xs'>
                            {formatCallbackTimestamp(attempt.finished_at)}
                          </Td>
                          <Td className='px-4 py-3 text-xs'>
                            {formatDuration(
                              attempt.started_at,
                              attempt.finished_at,
                            )}
                          </Td>
                          <Td className='px-4 py-3 text-xs'>
                            {attempt.http_status || '-'}
                          </Td>
                          <Td className='px-4 py-3 text-xs'>
                            {attempt.success ? t('成功') : t('失败')}
                          </Td>
                          <Td className='max-w-[220px] px-4 py-3 text-xs text-on-surface-variant'>
                            {attempt.error || '-'}
                          </Td>
                          <Td className='max-w-[260px] px-4 py-3 text-xs text-on-surface-variant'>
                            {attempt.response_snippet || '-'}
                          </Td>
                        </Tr>
                      ))
                    : null}
                </Tbody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
