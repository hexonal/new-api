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

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
import { Input } from '../../primitives/input';
import { Button } from '../../primitives/button';
import { API, showError } from '../../../helpers';

export default function MissingModelsModal({
  open = false,
  onClose = () => {},
  onConfigureModel,
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    API.get('/api/models/missing')
      .then((res) => {
        if (res.data?.success) {
          setModels(Array.isArray(res.data.data) ? res.data.data : []);
        } else {
          showError(res.data?.message || t('获取缺失模型失败'));
        }
      })
      .catch((error) => showError(error?.message || t('获取缺失模型失败')))
      .finally(() => setLoading(false));
  }, [open, t]);

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return models;
    return models.filter((item) =>
      String(item.model || item)
        .toLowerCase()
        .includes(text),
    );
  }, [models, keyword]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('缺失模型')}</DialogTitle>
          <DialogDescription>{t('查看并跳转配置缺失模型')}</DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <Input
            placeholder={t('搜索模型')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <div className='max-h-80 overflow-auto rounded-lg border border-border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/40'>
                <tr>
                  <th className='px-3 py-2 text-left'>{t('模型')}</th>
                  <th className='px-3 py-2 text-right'>{t('操作')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record, index) => {
                  const model = record.model || record;
                  return (
                    <tr
                      key={`${model}-${index}`}
                      className='border-t border-border'
                    >
                      <td className='px-3 py-2'>{model}</td>
                      <td className='px-3 py-2 text-right'>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => onConfigureModel?.(model)}
                        >
                          {t('去配置')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      className='px-3 py-6 text-center text-muted-foreground'
                      colSpan={2}
                    >
                      {loading ? t('加载中...') : t('暂无缺失模型')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
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
