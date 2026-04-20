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
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import { Card, CardHeader, CardTitle, CardDescription } from '../../primitives/card';
import { Button } from '../../primitives/button';
import ModelBasicInfo from './components/ModelBasicInfo';
import ModelPricing from './components/ModelPricing';
import ModelCapabilities from './components/ModelCapabilities';
import ModelChannelBinding from './components/ModelChannelBinding';
import ModelAdvanced from './components/ModelAdvanced';
import ModelDangerZone from './components/ModelDangerZone';

const EMPTY_FORM = {
  model_name: '',
  provider: '',
  max_tokens: '',
  support: '',
  prompt_price: '',
  completion_price: '',
  ratio: '',
  status: 1,
  tags: [],
  channels: [],
  settings: {
    streaming: true,
    thinking: false,
  },
  vendor_id: undefined,
  description: '',
};

const splitList = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export default function ModelFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const modelId = params.id;
  const isEdit = Boolean(modelId);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [channelNames, setChannelNames] = useState([]);

  const pageTitle = isEdit ? t('编辑模型') : t('新增模型');

  useEffect(() => {
    const loadChannels = async () => {
      try {
        const res = await API.get('/api/channel/?p=1&page_size=200');
        if (res?.data?.success) {
          const items = res.data.data?.items || [];
          setChannelNames(
            items
              .filter((item) => item?.name)
              .map((item) => item.name),
          );
        }
      } catch (_) {
        // ignore optional data source failures
      }
    };
    loadChannels();
  }, []);

  useEffect(() => {
    if (!isEdit) {
      return;
    }

    const loadModel = async () => {
      setLoading(true);
      try {
        const res = await API.get(`/api/models/${modelId}`);
        const { success, message, data } = res.data || {};
        if (!success) {
          showError(message || t('加载模型失败'));
          return;
        }

        const parsedTags = splitList(data.tags);
        const parsedChannels = Array.isArray(data.bound_channels)
          ? data.bound_channels.map((item) => item?.name).filter(Boolean)
          : [];

        setForm((prev) => ({
          ...prev,
          ...data,
          model_name: data.model_name || '',
          provider: data.vendor || '',
          max_tokens: data.max_tokens || '',
          support: parsedTags.join(','),
          prompt_price: data.model_ratio || '',
          completion_price: data.model_price || '',
          ratio: data.completion_ratio || '',
          tags: parsedTags,
          channels: parsedChannels,
          settings: {
            streaming: data?.streaming !== 0,
            thinking: data?.thinking === 1,
          },
        }));
      } catch (error) {
        showError(error?.response?.data?.message || error?.message || t('加载模型失败'));
      } finally {
        setLoading(false);
      }
    };

    loadModel();
  }, [isEdit, modelId]);

  const capabilities = useMemo(() => splitList(form.support), [form.support]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleChannel = (channelName, checked) => {
    setForm((prev) => {
      const set = new Set(splitList(prev.channels));
      if (checked) {
        set.add(channelName);
      } else {
        set.delete(channelName);
      }
      return {
        ...prev,
        channels: Array.from(set),
      };
    });
  };

  const submit = async () => {
    if (!form.model_name?.trim()) {
      showError(t('模型名称不能为空'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        model_name: form.model_name.trim(),
        description: form.description || '',
        tags: splitList(form.support || form.tags).join(','),
        vendor_id: form.vendor_id,
        vendor: form.provider || '',
        max_tokens: form.max_tokens ? Number(form.max_tokens) : undefined,
        status: Number(form.status) === 1 ? 1 : 0,
        model_ratio: form.prompt_price,
        model_price: form.completion_price,
        completion_ratio: form.ratio,
        endpoints: form.endpoints || '',
        sync_official: form.sync_official ?? 1,
      };

      if (isEdit) {
        const res = await API.put('/api/models/', {
          ...payload,
          id: Number(modelId),
        });
        if (res?.data?.success) {
          showSuccess(t('模型更新成功'));
          navigate('/console/models');
        } else {
          showError(res?.data?.message || t('模型更新失败'));
        }
      } else {
        const res = await API.post('/api/models/', payload);
        if (res?.data?.success) {
          showSuccess(t('模型创建成功'));
          navigate('/console/models');
        } else {
          showError(res?.data?.message || t('模型创建失败'));
        }
      }
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || t('保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const disableModel = async () => {
    if (!isEdit) {
      return;
    }
    await API.put('/api/models/?status_only=true', { id: Number(modelId), status: 0 });
    showSuccess(t('模型已禁用'));
    navigate('/console/models');
  };

  const deleteModel = async () => {
    if (!isEdit) {
      return;
    }
    await API.delete(`/api/models/${modelId}`);
    showSuccess(t('模型已删除'));
    navigate('/console/models');
  };

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-4'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base'>{pageTitle}</CardTitle>
              <CardDescription>{t('双栏表单覆盖基础信息、定价、能力与通道绑定。')}</CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <Button variant='outline' onClick={() => navigate('/console/models')}>
                <ArrowLeft className='mr-1 h-3.5 w-3.5' />
                {t('返回列表')}
              </Button>
              <Button onClick={submit} loading={submitting} disabled={loading}>
                <Save className='mr-1 h-3.5 w-3.5' />
                {isEdit ? t('保存修改') : t('创建模型')}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className='grid grid-cols-1 gap-4 xl:grid-cols-2'>
        <div className='space-y-4'>
          <ModelBasicInfo
            values={{
              name: form.model_name,
              provider: form.provider,
              max_tokens: String(form.max_tokens ?? ''),
              support: form.support,
            }}
            onChange={(key, value) => {
              if (key === 'name') {
                updateField('model_name', value);
                return;
              }
              updateField(key, value);
            }}
          />

          <ModelPricing
            prices={{
              prompt: String(form.prompt_price ?? ''),
              completion: String(form.completion_price ?? ''),
              multiplier: String(form.ratio ?? ''),
            }}
            onChange={(key, value) => {
              if (key === 'prompt') {
                updateField('prompt_price', value);
                return;
              }
              if (key === 'completion') {
                updateField('completion_price', value);
                return;
              }
              if (key === 'multiplier') {
                updateField('ratio', value);
              }
            }}
          />

          <ModelCapabilities capabilities={capabilities} />
        </div>

        <div className='space-y-4'>
          <ModelChannelBinding
            channels={channelNames}
            selected={splitList(form.channels)}
            onChange={toggleChannel}
          />

          <ModelAdvanced
            settings={form.settings}
            onChange={(key, value) =>
              updateField('settings', {
                ...form.settings,
                [key]: value,
              })
            }
          />

          {isEdit ? (
            <ModelDangerZone
              onDisable={disableModel}
              onDelete={deleteModel}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
