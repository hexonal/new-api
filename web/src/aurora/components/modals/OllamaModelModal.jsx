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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Checkbox } from '../../primitives/checkbox';
import { Progress } from '../../primitives/progress';
import { API, showError, showSuccess } from '../../../helpers';

const parseProgress = (line) => {
  try {
    const data = JSON.parse(line);
    if (typeof data.total === 'number' && data.total > 0) {
      return {
        text: data.status || '',
        value: Math.min(
          100,
          Math.max(0, Math.round((data.completed / data.total) * 100)),
        ),
      };
    }
    return { text: data.status || line, value: data.done ? 100 : 0 };
  } catch {
    return { text: line, value: 0 };
  }
};

export default function OllamaModelModal({
  open = false,
  onClose = () => {},
  channel,
  onApply,
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [pullModel, setPullModel] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullText, setPullText] = useState('');
  const [pullValue, setPullValue] = useState(0);

  const channelId = channel?.id;

  const fetchModels = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/channel/fetch_models/${channelId}`, {
        params: { id: channelId },
      });
      if (res.data?.success) {
        const data = res.data.data;
        const list = Array.isArray(data) ? data : data?.models || [];
        setModels(
          list.map((item) =>
            typeof item === 'string' ? { id: item, name: item } : item,
          ),
        );
      } else {
        showError(res.data?.message || t('获取模型失败'));
      }
    } catch (error) {
      showError(error?.message || t('获取模型失败'));
    } finally {
      setLoading(false);
    }
  }, [channelId, t]);

  useEffect(() => {
    if (open) {
      fetchModels();
    } else {
      setSelected([]);
      setSearch('');
      setPullModel('');
      setPullText('');
      setPullValue(0);
    }
  }, [open, fetchModels]);

  const filteredModels = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return models;
    return models.filter((item) =>
      String(item.name || item.id)
        .toLowerCase()
        .includes(keyword),
    );
  }, [models, search]);

  const toggle = (id) => {
    setSelected((prev) => {
      const set = new Set(prev);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return Array.from(set);
    });
  };

  const applyAll = () => {
    onApply?.(selected);
    showSuccess(t('模型选择已应用'));
  };

  const deleteModel = async (model) => {
    if (!channelId) return;
    setLoading(true);
    try {
      const res = await API.delete('/api/channel/ollama/delete', {
        data: { channel_id: channelId, model },
      });
      if (res.data?.success) {
        showSuccess(t('模型已删除'));
        await fetchModels();
      } else {
        showError(res.data?.message || t('删除失败'));
      }
    } catch (error) {
      showError(error?.message || t('删除失败'));
    } finally {
      setLoading(false);
    }
  };

  const pull = async () => {
    if (!pullModel.trim() || !channelId) {
      showError(t('请输入模型名称'));
      return;
    }

    setPulling(true);
    setPullValue(0);
    setPullText(t('开始拉取...'));

    try {
      const response = await fetch('/api/channel/ollama/pull/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'New-API-User': localStorage.getItem('user') || '',
        },
        body: JSON.stringify({
          channel_id: channelId,
          model: pullModel.trim(),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(t('拉取请求失败'));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const result = await reader.read();
        done = result.done;
        buffer += decoder.decode(result.value || new Uint8Array(), {
          stream: !done,
        });
        const chunks = buffer.split('\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const text = chunk.trim();
          if (!text) continue;
          const progress = parseProgress(text.replace(/^data:\s*/, ''));
          setPullText(progress.text || text);
          setPullValue(progress.value);
        }
      }

      setPullValue(100);
      showSuccess(t('模型拉取完成'));
      await fetchModels();
    } catch (error) {
      showError(error?.message || t('拉取失败'));
    } finally {
      setPulling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle>{t('Ollama 模型管理')}</DialogTitle>
          <DialogDescription>{t('拉取模型并查看拉取进度')}</DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <div className='grid grid-cols-[1fr_auto] gap-2'>
            <Input
              placeholder={t('输入要拉取的模型，例如 llama3.1:8b')}
              value={pullModel}
              onChange={(e) => setPullModel(e.target.value)}
            />
            <Button onClick={pull} loading={pulling}>
              {t('拉取')}
            </Button>
          </div>

          {(pulling || pullText) && (
            <div className='rounded-lg border border-border p-3'>
              <div className='mb-2 text-sm'>{pullText || t('准备中...')}</div>
              <Progress value={pullValue} />
            </div>
          )}

          <div className='flex items-center gap-2'>
            <Input
              placeholder={t('搜索模型')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant='outline' onClick={fetchModels} disabled={loading}>
              {t('刷新')}
            </Button>
            <Button
              variant='outline'
              onClick={applyAll}
              disabled={selected.length === 0}
            >
              {t('应用已选')} ({selected.length})
            </Button>
          </div>

          <div className='max-h-80 overflow-auto rounded-lg border border-border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/40'>
                <tr>
                  <th className='w-12 px-3 py-2'></th>
                  <th className='px-3 py-2 text-left'>{t('模型')}</th>
                  <th className='px-3 py-2 text-right'>{t('操作')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.map((model) => {
                  const id = model.id || model.name;
                  return (
                    <tr key={id} className='border-t border-border'>
                      <td className='px-3 py-2'>
                        <Checkbox
                          checked={selected.includes(id)}
                          onCheckedChange={() => toggle(id)}
                        />
                      </td>
                      <td className='px-3 py-2'>{model.name || model.id}</td>
                      <td className='px-3 py-2 text-right'>
                        <Button
                          size='sm'
                          variant='destructive'
                          onClick={() => deleteModel(model.name || model.id)}
                          disabled={loading}
                        >
                          {t('删除')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filteredModels.length === 0 ? (
                  <tr>
                    <td
                      className='px-3 py-6 text-center text-muted-foreground'
                      colSpan={3}
                    >
                      {loading ? t('加载中...') : t('暂无模型')}
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
