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

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import { Button } from '../../primitives/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../primitives/select';
import { API, showError, showSuccess } from '../../../helpers';

const actionRequest = async ({
  channelId,
  action,
  keyIndex,
  page,
  pageSize,
  status,
}) =>
  API.post('/api/channel/multi_key/manage', {
    channel_id: channelId,
    action,
    key_index: keyIndex,
    page,
    page_size: pageSize,
    status_filter: status,
  });

export default function MultiKeyManageModal({
  open = false,
  onClose = () => {},
  channel,
  onSuccess,
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('all');

  const channelId = channel?.id;

  const load = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    try {
      const res = await actionRequest({
        channelId,
        action: 'list',
        page,
        pageSize,
        status: status === 'all' ? null : Number(status),
      });
      if (res.data?.success) {
        const data = res.data.data || {};
        setRows(Array.isArray(data.list) ? data.list : []);
        setTotalPages(Number(data.total_pages || 1));
      } else {
        showError(res.data?.message || t('加载多密钥失败'));
      }
    } catch (error) {
      showError(error?.message || t('加载多密钥失败'));
    } finally {
      setLoading(false);
    }
  }, [channelId, page, pageSize, status, t]);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  const runAction = async (action, keyIndex) => {
    if (!channelId) return;
    setLoading(true);
    try {
      const res = await actionRequest({
        channelId,
        action,
        keyIndex,
        page,
        pageSize,
      });
      if (res.data?.success) {
        showSuccess(t('操作成功'));
        await load();
        onSuccess?.();
      } else {
        showError(res.data?.message || t('操作失败'));
      }
    } catch (error) {
      showError(error?.message || t('操作失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle>{t('多密钥管理')}</DialogTitle>
          <DialogDescription>
            {t('对渠道多密钥进行启用、禁用、删除等批量操作')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <div className='flex items-center gap-2'>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className='w-44'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('全部状态')}</SelectItem>
                <SelectItem value='1'>{t('已启用')}</SelectItem>
                <SelectItem value='2'>{t('手动禁用')}</SelectItem>
                <SelectItem value='3'>{t('自动禁用')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant='outline' onClick={load} disabled={loading}>
              {t('刷新')}
            </Button>
            <Button
              variant='outline'
              onClick={() => runAction('enable_all')}
              disabled={loading}
            >
              {t('全部启用')}
            </Button>
            <Button
              variant='outline'
              onClick={() => runAction('disable_all')}
              disabled={loading}
            >
              {t('全部禁用')}
            </Button>
            <Button
              variant='destructive'
              onClick={() => runAction('delete_disabled')}
              disabled={loading}
            >
              {t('删除禁用密钥')}
            </Button>
          </div>

          <div className='max-h-80 overflow-auto rounded-lg border border-border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/40'>
                <tr>
                  <th className='px-3 py-2 text-left'>#</th>
                  <th className='px-3 py-2 text-left'>{t('状态')}</th>
                  <th className='px-3 py-2 text-left'>{t('错误')}</th>
                  <th className='px-3 py-2 text-right'>{t('操作')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.index ?? index}
                    className='border-t border-border'
                  >
                    <td className='px-3 py-2'>{row.index}</td>
                    <td className='px-3 py-2'>
                      {row.status_text || row.status}
                    </td>
                    <td className='px-3 py-2 text-muted-foreground'>
                      {row.last_error || '-'}
                    </td>
                    <td className='px-3 py-2 text-right'>
                      <div className='inline-flex gap-1'>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => runAction('enable', row.index)}
                          disabled={loading}
                        >
                          {t('启用')}
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => runAction('disable', row.index)}
                          disabled={loading}
                        >
                          {t('禁用')}
                        </Button>
                        <Button
                          size='sm'
                          variant='destructive'
                          onClick={() => runAction('delete', row.index)}
                          disabled={loading}
                        >
                          {t('删除')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      className='px-3 py-6 text-center text-muted-foreground'
                      colSpan={4}
                    >
                      {loading ? t('加载中...') : t('暂无密钥数据')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className='flex items-center justify-between text-sm'>
            <span>
              {t('第')} {page} / {totalPages} {t('页')}
            </span>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                {t('上一页')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={page >= totalPages || loading}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                {t('下一页')}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            {t('关闭')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
