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

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import { Button } from '../../primitives/button';
import { API, getRelativeTime, showError } from '../../../helpers';
import { StatusContext } from '../../../context/Status';

export default function NoticeModal({
  open = false,
  onClose = () => {},
  defaultTab = 'inApp',
  unreadKeys = [],
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(defaultTab);
  const [noticeHtml, setNoticeHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusState] = useContext(StatusContext);

  const unreadSet = useMemo(() => new Set(unreadKeys), [unreadKeys]);
  const announcements = statusState?.status?.announcements || [];

  useEffect(() => {
    if (!open) return;
    setTab(defaultTab);
    setLoading(true);
    API.get('/api/notice')
      .then((res) => {
        if (res.data?.success) {
          setNoticeHtml(res.data.data ? marked.parse(res.data.data) : '');
        } else {
          showError(res.data?.message || t('获取公告失败'));
        }
      })
      .catch((error) => showError(error?.message || t('获取公告失败')))
      .finally(() => setLoading(false));
  }, [open, defaultTab, t]);

  const processedAnnouncements = useMemo(
    () =>
      announcements.slice(0, 30).map((item) => {
        const key = `${item?.publishDate || ''}-${(item?.content || '').slice(0, 30)}`;
        return {
          key,
          relative: getRelativeTime(item.publishDate),
          time: item.publishDate,
          isUnread: unreadSet.has(key),
          content: item.content || '',
          extra: item.extra || '',
        };
      }),
    [announcements, unreadSet],
  );

  const closeToday = () => {
    localStorage.setItem('notice_close_date', new Date().toDateString());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle>{t('系统公告')}</DialogTitle>
          <DialogDescription>{t('查看通知和系统公告')}</DialogDescription>
        </DialogHeader>

        <div className='mb-3 flex gap-2'>
          <Button
            size='sm'
            variant={tab === 'inApp' ? 'default' : 'outline'}
            onClick={() => setTab('inApp')}
          >
            {t('通知')}
          </Button>
          <Button
            size='sm'
            variant={tab === 'system' ? 'default' : 'outline'}
            onClick={() => setTab('system')}
          >
            {t('系统公告')}
          </Button>
        </div>

        {tab === 'inApp' ? (
          <div className='max-h-[55vh] overflow-y-auto rounded-lg border border-border p-3'>
            {loading ? (
              <div className='py-10 text-center text-sm text-muted-foreground'>
                {t('加载中...')}
              </div>
            ) : noticeHtml ? (
              <div dangerouslySetInnerHTML={{ __html: noticeHtml }} />
            ) : (
              <div className='py-10 text-center text-sm text-muted-foreground'>
                {t('暂无公告')}
              </div>
            )}
          </div>
        ) : (
          <div className='max-h-[55vh] space-y-3 overflow-y-auto rounded-lg border border-border p-3'>
            {processedAnnouncements.length === 0 ? (
              <div className='py-10 text-center text-sm text-muted-foreground'>
                {t('暂无系统公告')}
              </div>
            ) : (
              processedAnnouncements.map((item) => (
                <div
                  key={item.key}
                  className='rounded-lg border border-border p-3'
                >
                  <div className='mb-2 text-xs text-muted-foreground'>
                    {item.relative || '-'} {item.time ? `(${item.time})` : ''}
                    {item.isUnread ? (
                      <span className='ml-2 text-primary'>{t('未读')}</span>
                    ) : null}
                  </div>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(item.content || ''),
                    }}
                  />
                  {item.extra ? (
                    <div
                      className='mt-2 text-xs text-muted-foreground'
                      dangerouslySetInnerHTML={{
                        __html: marked.parse(item.extra),
                      }}
                    />
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={closeToday}>
            {t('今日关闭')}
          </Button>
          <Button onClick={onClose}>{t('关闭公告')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
