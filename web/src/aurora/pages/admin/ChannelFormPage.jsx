import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../primitives/card';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import {
  ChannelBasicInfo,
  ChannelApiConfig,
  ChannelModelConfig,
  ChannelOptions,
  ChannelPromptOverride,
  ChannelAccessControl,
  ChannelStatusToggle,
} from './components';

const EMPTY_FORM = {
  name: '',
  type: 1,
  base_url: '',
  key: '',
  group: 'default',
  models: [],
  default_model: '',
  timeout: '',
  retry: '',
  system_prompt: '',
  user_prompt: '',
  status: 1,
  options: {
    timeout: '',
    retry: '',
  },
};

const parseList = (value) => {
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

export default function ChannelFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const channelId = params.id;
  const isEdit = Boolean(channelId);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modelOptions, setModelOptions] = useState([]);

  const pageTitle = isEdit ? t('编辑渠道') : t('新建渠道');

  const selectableModels = useMemo(() => {
    const merged = new Set([...(modelOptions || []), ...parseList(form.models)]);
    return Array.from(merged);
  }, [modelOptions, form.models]);

  useEffect(() => {
    const loadBaseData = async () => {
      try {
        const modelRes = await API.get('/api/channel/models');
        if (modelRes?.data?.success) {
          const data = modelRes.data.data;
          const models = Array.isArray(data)
            ? data
            : Array.isArray(data?.models)
              ? data.models
              : [];
          setModelOptions(models.filter(Boolean));
        }
      } catch (_) {
        // ignore optional data source failures
      }
    };
    loadBaseData();
  }, []);

  useEffect(() => {
    if (!isEdit) {
      return;
    }

    const loadChannel = async () => {
      setLoading(true);
      try {
        const res = await API.get(`/api/channel/${channelId}`);
        const { success, message, data } = res.data || {};
        if (!success) {
          showError(message || t('加载渠道失败'));
          return;
        }

        let parsedSetting = {};
        try {
          const rawSettings = data.settings ?? data.setting;
          parsedSetting = typeof rawSettings === 'string' ? JSON.parse(rawSettings || '{}') : rawSettings || {};
        } catch (_) {
          parsedSetting = {};
        }

        setForm((prev) => ({
          ...prev,
          ...data,
          key: data.key || '',
          models: parseList(data.models),
          group: data.group || 'default',
          default_model: parseList(data.models)[0] || '',
          timeout: parsedSetting.timeout || '',
          retry: parsedSetting.retry || '',
          system_prompt: parsedSetting.system_prompt || '',
          user_prompt: parsedSetting.user_prompt || '',
          options: {
            timeout: parsedSetting.timeout || '',
            retry: parsedSetting.retry || '',
          },
        }));
      } catch (error) {
        showError(error?.response?.data?.message || error?.message || t('加载渠道失败'));
      } finally {
        setLoading(false);
      }
    };

    loadChannel();
  }, [channelId, isEdit]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAllowedModel = (model, checked) => {
    setForm((prev) => {
      const set = new Set(parseList(prev.models));
      if (checked) {
        set.add(model);
      } else {
        set.delete(model);
      }
      const nextModels = Array.from(set);
      return {
        ...prev,
        models: nextModels,
        default_model: nextModels.includes(prev.default_model) ? prev.default_model : nextModels[0] || '',
      };
    });
  };

  const submit = async () => {
    if (!form.name?.trim()) {
      showError(t('渠道名称不能为空'));
      return;
    }

    setSubmitting(true);
    try {
      const settings = {
        timeout: form.timeout || form.options?.timeout || undefined,
        retry: form.retry || form.options?.retry || undefined,
        system_prompt: form.system_prompt || undefined,
        user_prompt: form.user_prompt || undefined,
      };

      const normalizedType = Number(form.type);
      const channelPayload = {
        ...form,
        name: form.name.trim(),
        type: Number.isFinite(normalizedType) ? normalizedType : form.type,
        key: form.key || form.api_key || '',
        group: form.group || 'default',
        models: parseList(form.models).join(','),
        settings: JSON.stringify(settings),
      };

      if (isEdit) {
        const res = await API.put('/api/channel/', {
          ...channelPayload,
          id: Number(channelId),
        });
        if (res?.data?.success) {
          showSuccess(t('渠道更新成功'));
          navigate('/console/channel');
        } else {
          showError(res?.data?.message || t('渠道更新失败'));
        }
      } else {
        const res = await API.post('/api/channel/', {
          mode: 'single',
          channel: channelPayload,
        });
        if (res?.data?.success) {
          showSuccess(t('渠道创建成功'));
          navigate('/console/channel');
        } else {
          showError(res?.data?.message || t('渠道创建失败'));
        }
      }
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || t('保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-4'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base'>{pageTitle}</CardTitle>
              <CardDescription>{t('双栏配置页，覆盖基础信息、模型与访问控制、API参数与提示词策略。')}</CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <Button variant='outline' onClick={() => navigate('/console/channel')}>
                <ArrowLeft className='mr-1 h-3.5 w-3.5' />
                {t('返回列表')}
              </Button>
              <Button onClick={submit} loading={submitting} disabled={loading}>
                <Save className='mr-1 h-3.5 w-3.5' />
                {isEdit ? t('保存修改') : t('创建渠道')}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className='grid grid-cols-1 gap-4 xl:grid-cols-2'>
        <div className='space-y-4'>
          <ChannelBasicInfo
            values={{
              name: form.name,
              type: String(form.type ?? ''),
              base_url: form.base_url,
              api_key: form.key,
            }}
            onChange={(key, value) => {
              if (key === 'api_key') {
                updateField('key', value);
                return;
              }
              updateField(key, value);
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>{t('基础路由配置')}</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3'>
              <Input
                label={t('分组')}
                value={form.group || ''}
                placeholder={t('default,vip')}
                onChange={(event) => updateField('group', event.target.value)}
              />
              <Input
                label={t('可用模型（逗号分隔）')}
                value={parseList(form.models).join(',')}
                placeholder={t('gpt-4.1,claude-3-5-sonnet')}
                onChange={(event) => updateField('models', parseList(event.target.value))}
              />
            </CardContent>
          </Card>

          <ChannelApiConfig
            values={{
              base_url: form.base_url,
              api_key: form.key,
              timeout: form.timeout,
              retry: form.retry,
            }}
            onChange={(key, value) => {
              if (key === 'api_key') {
                updateField('key', value);
                return;
              }
              if (key === 'timeout' || key === 'retry') {
                updateField(key, value);
                updateField('options', { ...form.options, [key]: value });
                return;
              }
              updateField(key, value);
            }}
          />

          <ChannelPromptOverride
            systemPrompt={form.system_prompt || ''}
            userPrompt={form.user_prompt || ''}
            onChange={(key, value) => {
              updateField(key, value);
            }}
          />
        </div>

        <div className='space-y-4'>
          <ChannelModelConfig
            model={form.default_model || ''}
            models={selectableModels}
            onChange={(value) => updateField('default_model', value)}
          />

          <ChannelAccessControl
            items={selectableModels}
            allowed={parseList(form.models)}
            onChange={toggleAllowedModel}
            title={t('模型访问白名单')}
            description={t('仅勾选模型可经由该渠道路由')}
          />

          <ChannelOptions
            options={form.options || {}}
            onChange={(key, value) => {
              updateField('options', { ...(form.options || {}), [key]: value });
              if (key === 'timeout' || key === 'retry') {
                updateField(key, value);
              }
            }}
          />

          <ChannelStatusToggle
            checked={Number(form.status) === 1}
            onChange={(checked) => updateField('status', checked ? 1 : 2)}
            description={t('关闭后该渠道不会参与分发')}
          />
        </div>
      </div>
    </div>
  );
}
