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
import {
  ArrowLeft,
  Bot,
  Cable,
  CheckCircle2,
  CloudUpload,
  Layers3,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';

import {
  API,
  getChannelModels,
  loadChannelModels,
  showError,
  showSuccess,
} from '../../../helpers';
import {
  CHANNEL_OPTIONS,
  MODEL_FETCHABLE_CHANNEL_TYPES,
} from '../../../constants';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../primitives/card';
import { Checkbox } from '../../primitives/checkbox';
import { Input } from '../../primitives/input';
import { Switch } from '../../primitives/switch';
import {
  BREAKER_ERROR_TYPE_OPTIONS,
  DEFAULT_DOUBAO_BASE_URL,
  buildChannelSubmitRequest,
  createChannelFormDefaults,
  deserializeChannelForm,
} from './channel-form-page/channel-form-utils';

const SELECT_CLASS_NAME =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const TEXTAREA_CLASS_NAME =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

const toInputValue = (value) => value ?? '';

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <Card className='border-slate-200/80 bg-white/92 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.45)]'>
      <CardHeader className='pb-4'>
        <div className='flex items-start gap-3'>
          <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600'>
            <Icon className='h-5 w-5' />
          </div>
          <div className='space-y-1'>
            <CardTitle className='text-lg font-bold text-slate-950'>
              {title}
            </CardTitle>
            <CardDescription className='text-sm leading-6 text-slate-500'>
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-5'>{children}</CardContent>
    </Card>
  );
}

function FieldBlock({ label, hint, children }) {
  return (
    <div className='space-y-2'>
      <div className='space-y-1'>
        <p className='text-xs font-semibold uppercase tracking-[0.22em] text-slate-500'>
          {label}
        </p>
        {hint ? (
          <p className='text-xs leading-5 text-slate-400'>{hint}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ToggleField({ label, description, checked, onChange }) {
  return (
    <div className='flex items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3'>
      <div className='space-y-1'>
        <p className='text-sm font-semibold text-slate-900'>{label}</p>
        <p className='text-xs leading-5 text-slate-500'>{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />
    </div>
  );
}

function Token({ text, onRemove, tone = 'slate' }) {
  const toneClass =
    tone === 'indigo'
      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
      : 'border-slate-200 bg-slate-100 text-slate-700';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}
    >
      {text}
      {onRemove ? (
        <button
          className='transition hover:text-slate-950'
          onClick={onRemove}
          type='button'
        >
          <X className='h-3 w-3' />
        </button>
      ) : null}
    </span>
  );
}

function LoadingState({ title }) {
  return (
    <div className='rounded-[28px] border border-slate-200 bg-white/92 px-8 py-16 text-center shadow-[0_24px_80px_-56px_rgba(15,23,42,0.45)]'>
      <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600'>
        <RefreshCcw className='h-6 w-6 animate-spin' />
      </div>
      <h2 className='mt-5 text-lg font-bold text-slate-950'>{title}</h2>
    </div>
  );
}

export default function ChannelFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(() => createChannelFormDefaults());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [fetchedModels, setFetchedModels] = useState([]);
  const [catalogModels, setCatalogModels] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [customModel, setCustomModel] = useState('');
  const [batch, setBatch] = useState(false);
  const [multiToSingle, setMultiToSingle] = useState(false);
  const [multiKeyMode, setMultiKeyMode] = useState('random');
  const [keyMode, setKeyMode] = useState('append');
  const [isMultiKeyChannel, setIsMultiKeyChannel] = useState(false);
  const [hasManualModelOverride, setHasManualModelOverride] = useState(false);
  const [modelLibraryVersion, setModelLibraryVersion] = useState(0);

  const providerMeta = useMemo(
    () =>
      CHANNEL_OPTIONS.find(
        (option) => Number(option.value) === Number(form.type),
      ),
    [form.type],
  );
  const recommendedModels = useMemo(
    () => getChannelModels(Number(form.type)) || [],
    [form.type, modelLibraryVersion],
  );
  const suggestedModels = useMemo(() => {
    const pool = [...recommendedModels, ...catalogModels];
    return pool
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item, index, array) => array.indexOf(item) === index)
      .filter((item) => !form.models.includes(item))
      .slice(0, 18);
  }, [catalogModels, form.models, recommendedModels]);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      try {
        await loadChannelModels();
        if (alive) {
          setModelLibraryVersion((value) => value + 1);
        }
      } catch (error) {
        showError(error.message || '模型列表初始化失败');
      }

      const [groupResult, modelResult] = await Promise.allSettled([
        API.get('/api/group/'),
        API.get('/api/channel/models'),
      ]);

      if (!alive) {
        return;
      }

      if (groupResult.status === 'fulfilled') {
        setGroupOptions(groupResult.value?.data?.data || []);
      }
      if (modelResult.status === 'fulfilled') {
        const items = modelResult.value?.data?.data || [];
        setCatalogModels(items.map((item) => item.id).filter(Boolean));
      }
    }

    bootstrap().then();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (isEdit) {
      return;
    }
    if (form.models.length > 0 || recommendedModels.length === 0) {
      return;
    }
    setForm((current) => ({ ...current, models: recommendedModels }));
  }, [form.models.length, isEdit, recommendedModels]);

  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }

    let alive = true;

    async function loadChannel() {
      setLoading(true);
      const response = await API.get(`/api/channel/${id}`);
      if (!alive || response === undefined) {
        return;
      }

      const { success, data, message } = response.data || {};
      if (!success) {
        showError(message || '渠道加载失败');
        setLoading(false);
        return;
      }

      const normalized = deserializeChannelForm(data);
      setForm(normalized.form);
      setBatch(Boolean(normalized.meta.batch));
      setMultiToSingle(Boolean(normalized.meta.multiToSingle));
      setMultiKeyMode(normalized.meta.multiKeyMode || 'random');
      setIsMultiKeyChannel(Boolean(normalized.meta.isMultiKeyChannel));
      setKeyMode(normalized.meta.keyMode || 'append');
      setLoading(false);
    }

    loadChannel().then();
    return () => {
      alive = false;
    };
  }, [id, isEdit]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleInputChange = (field) => (event) => {
    updateField(field, event.target.value);
  };

  const handleTypeChange = (event) => {
    const nextType = Number(event.target.value) || 1;
    const nextRecommendedModels = getChannelModels(nextType) || [];

    setForm((current) => ({
      ...current,
      type: nextType,
      base_url:
        nextType === 45 && String(current.base_url || '').trim() === ''
          ? DEFAULT_DOUBAO_BASE_URL
          : current.base_url,
      models:
        !isEdit && !hasManualModelOverride
          ? nextRecommendedModels
          : current.models,
    }));
    setFetchedModels([]);
  };

  const appendModel = (modelName) => {
    const normalizedModel = String(modelName || '').trim();
    if (!normalizedModel) {
      return;
    }

    setHasManualModelOverride(true);
    setForm((current) => {
      if (current.models.includes(normalizedModel)) {
        return current;
      }
      return { ...current, models: [...current.models, normalizedModel] };
    });
    setCustomModel('');
  };

  const removeModel = (modelName) => {
    setHasManualModelOverride(true);
    setForm((current) => ({
      ...current,
      models: current.models.filter((item) => item !== modelName),
    }));
  };

  const toggleGroup = (groupName) => {
    const normalizedGroup = String(groupName || '').trim();
    if (!normalizedGroup) {
      return;
    }

    setForm((current) => {
      const set = new Set(current.groups);
      if (set.has(normalizedGroup)) {
        set.delete(normalizedGroup);
      } else {
        set.add(normalizedGroup);
      }
      const groups = Array.from(set);
      return { ...current, groups: groups.length > 0 ? groups : ['default'] };
    });
  };

  const toggleBreakerErrorType = (value) => {
    setForm((current) => {
      const set = new Set(current.breaker_error_types);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      return { ...current, breaker_error_types: Array.from(set) };
    });
  };

  const handleResetRecommendedModels = () => {
    setHasManualModelOverride(false);
    setForm((current) => ({ ...current, models: recommendedModels }));
  };

  const handleFetchUpstreamModels = async () => {
    if (!MODEL_FETCHABLE_CHANNEL_TYPES.has(Number(form.type))) {
      showError(t('当前渠道类型暂不支持拉取上游模型'));
      return;
    }

    setSaving(true);
    try {
      const response = isEdit
        ? await API.get(`/api/channel/fetch_models/${id}`, {
            skipErrorHandler: true,
          })
        : await API.post(
            '/api/channel/fetch_models',
            {
              base_url: form.base_url,
              type: form.type,
              key: form.key,
            },
            { skipErrorHandler: true },
          );

      const models = response?.data?.success ? response.data.data || [] : null;
      if (!Array.isArray(models)) {
        throw new Error(response?.data?.message || t('获取模型列表失败'));
      }

      setFetchedModels(
        Array.from(
          new Set(
            models.map((item) => String(item || '').trim()).filter(Boolean),
          ),
        ),
      );
    } catch (error) {
      showError(error.message || t('获取模型列表失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const request = buildChannelSubmitRequest({
        form,
        isEdit,
        channelId: id,
        batch,
        multiToSingle,
        multiKeyMode,
        isMultiKeyChannel,
        keyMode,
      });

      const response =
        request.method === 'put'
          ? await API.put('/api/channel/', request.payload)
          : await API.post('/api/channel/', request.payload);

      const { success, message } = response.data || {};
      if (!success) {
        throw new Error(message || t('保存失败'));
      }

      showSuccess(isEdit ? t('渠道更新成功！') : t('渠道创建成功！'));
      navigate('/console/channel');
    } catch (error) {
      showError(error.message || t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const title = isEdit ? t('编辑渠道') : t('新建渠道');
  const subtitle = isEdit
    ? t('Aurora 原生编辑页已经接管旧表单逻辑，当前编辑会继续沿用旧版提交规则。')
    : t(
        '按 Stitch 的双栏创建结构重建渠道页面，UI 为 Aurora 原生，提交 payload 与旧版保持一致。',
      );
  const modeLabel = !batch
    ? t('单渠道')
    : multiToSingle
      ? t('多 Key 聚合')
      : t('批量创建');

  if (loading) {
    return (
      <LoadingState
        title={isEdit ? t('正在加载渠道配置...') : t('正在准备创建页...')}
      />
    );
  }

  return (
    <div className='relative overflow-hidden pb-10'>
      <div className='pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.18),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.16),_transparent_36%),linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(248,250,252,0.76))]' />

      <div className='relative space-y-6 px-1'>
        <div className='rounded-[28px] border border-slate-200/80 bg-white/92 px-6 py-6 shadow-[0_32px_120px_-60px_rgba(15,23,42,0.45)] backdrop-blur md:px-8'>
          <div className='flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
            <div className='space-y-4'>
              <div className='flex flex-wrap items-center gap-2 text-sm text-slate-500'>
                <button
                  className='transition hover:text-indigo-600'
                  onClick={() => navigate('/console/channel')}
                  type='button'
                >
                  {t('渠道管理')}
                </button>
                <span>/</span>
                <span className='font-medium text-slate-900'>{title}</span>
              </div>
              <div className='space-y-3'>
                <div className='inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700'>
                  <Sparkles className='h-3.5 w-3.5' />
                  {isEdit
                    ? t('Aurora Channel Editor')
                    : t('Aurora Channel Creator')}
                </div>
                <div className='space-y-2'>
                  <h1 className='font-headline text-3xl font-black tracking-[-0.03em] text-slate-950'>
                    {title}
                  </h1>
                  <p className='max-w-3xl text-sm leading-6 text-slate-600'>
                    {subtitle}
                  </p>
                </div>
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <Button
                className='rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                variant='outline'
                onClick={() => navigate('/console/channel')}
              >
                <ArrowLeft className='mr-2 h-4 w-4' />
                {t('返回列表')}
              </Button>
              <Button
                className='rounded-xl px-5'
                loading={saving}
                onClick={handleSubmit}
              >
                <CheckCircle2 className='mr-2 h-4 w-4' />
                {isEdit ? t('保存修改') : t('创建渠道')}
              </Button>
            </div>
          </div>
        </div>

        <div className='grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]'>
          <div className='space-y-6'>
            <SectionCard
              icon={Sparkles}
              title={t('基本信息')}
              description={t(
                '高频录入信息集中在首屏，直接对应 Stitch 创建稿的主内容列。',
              )}
            >
              <div className='grid gap-5 md:grid-cols-2'>
                <FieldBlock label={t('Provider')}>
                  <select
                    className={SELECT_CLASS_NAME}
                    value={String(form.type)}
                    onChange={handleTypeChange}
                  >
                    {CHANNEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FieldBlock>

                <FieldBlock label={t('渠道名称')}>
                  <Input
                    value={toInputValue(form.name)}
                    onChange={handleInputChange('name')}
                    placeholder={t('例如：MiniMax Production')}
                  />
                </FieldBlock>
              </div>

              <FieldBlock
                label={t('密钥')}
                hint={
                  batch
                    ? t('批量模式下支持按行粘贴多条密钥。')
                    : t('保持旧版字段行为，提交时直接走原有创建接口。')
                }
              >
                <textarea
                  className={TEXTAREA_CLASS_NAME}
                  rows={batch ? 5 : 4}
                  value={toInputValue(form.key)}
                  onChange={handleInputChange('key')}
                  placeholder={batch ? t('每行一条密钥') : 'sk-xxxxxxxx'}
                />
              </FieldBlock>

              <ToggleField
                label={t('批量创建')}
                description={t(
                  '开启后可以一次录入多条密钥，并沿用旧版 batch / multi_to_single 模式。',
                )}
                checked={batch}
                onChange={(value) => {
                  setBatch(value);
                  if (!value) {
                    setMultiToSingle(false);
                  }
                }}
              />

              {batch ? (
                <div className='grid gap-5 md:grid-cols-2'>
                  <FieldBlock label={t('批量策略')}>
                    <select
                      className={SELECT_CLASS_NAME}
                      value={multiToSingle ? 'multi_to_single' : 'batch'}
                      onChange={(event) =>
                        setMultiToSingle(
                          event.target.value === 'multi_to_single',
                        )
                      }
                    >
                      <option value='batch'>{t('批量创建多个渠道')}</option>
                      <option value='multi_to_single'>
                        {t('将多密钥聚合到一个渠道')}
                      </option>
                    </select>
                  </FieldBlock>

                  {multiToSingle ? (
                    <FieldBlock label={t('多 Key 分配策略')}>
                      <select
                        className={SELECT_CLASS_NAME}
                        value={multiKeyMode}
                        onChange={(event) =>
                          setMultiKeyMode(event.target.value)
                        }
                      >
                        <option value='random'>{t('随机')}</option>
                        <option value='polling'>{t('轮询')}</option>
                      </select>
                    </FieldBlock>
                  ) : null}
                </div>
              ) : null}

              <div className='grid gap-5 md:grid-cols-2'>
                <FieldBlock label={t('Organization')}>
                  <Input
                    value={toInputValue(form.openai_organization)}
                    onChange={handleInputChange('openai_organization')}
                    placeholder='org-xxxx'
                  />
                </FieldBlock>
                <FieldBlock label={t('标签')}>
                  <Input
                    value={toInputValue(form.tag)}
                    onChange={handleInputChange('tag')}
                    placeholder={t('可选，用于聚合渠道')}
                  />
                </FieldBlock>
              </div>

              <FieldBlock
                label={t('分组')}
                hint={t('创建页仍然沿用旧版 group 逗号串逻辑。')}
              >
                <div className='flex flex-wrap gap-2'>
                  {(groupOptions.length > 0 ? groupOptions : ['default']).map(
                    (groupName) => (
                      <button
                        key={groupName}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          form.groups.includes(groupName)
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                        onClick={() => toggleGroup(groupName)}
                        type='button'
                      >
                        {groupName}
                      </button>
                    ),
                  )}
                </div>
              </FieldBlock>
            </SectionCard>

            <SectionCard
              icon={Cable}
              title={t('API 配置')}
              description={t(
                '基础地址、代理、中转限制和调度优先级放在同一组，避免首屏来回跳。',
              )}
            >
              <div className='grid gap-5 md:grid-cols-2'>
                <FieldBlock label={t('Base URL')}>
                  <Input
                    value={toInputValue(form.base_url)}
                    onChange={handleInputChange('base_url')}
                    placeholder={
                      providerMeta?.value === 45
                        ? DEFAULT_DOUBAO_BASE_URL
                        : 'https://api.example.com'
                    }
                  />
                </FieldBlock>
                <FieldBlock label={t('Proxy')}>
                  <Input
                    value={toInputValue(form.proxy)}
                    onChange={handleInputChange('proxy')}
                    placeholder='http://127.0.0.1:7890'
                  />
                </FieldBlock>
                <FieldBlock label={t('最大输入 Token')}>
                  <Input
                    type='number'
                    value={toInputValue(form.max_input_tokens)}
                    onChange={handleInputChange('max_input_tokens')}
                  />
                </FieldBlock>
                <FieldBlock label={t('其他参数')}>
                  <Input
                    value={toInputValue(form.other)}
                    onChange={handleInputChange('other')}
                    placeholder={t('部分渠道用于版本号或附加配置')}
                  />
                </FieldBlock>
                <FieldBlock label={t('优先级')}>
                  <Input
                    type='number'
                    value={toInputValue(form.priority)}
                    onChange={handleInputChange('priority')}
                  />
                </FieldBlock>
                <FieldBlock label={t('权重')}>
                  <Input
                    type='number'
                    value={toInputValue(form.weight)}
                    onChange={handleInputChange('weight')}
                  />
                </FieldBlock>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <ToggleField
                  label={t('自动封禁')}
                  description={t(
                    '对应旧版 auto_ban 字段，提交时继续按 1/0 发送。',
                  )}
                  checked={Boolean(form.auto_ban)}
                  onChange={(value) => updateField('auto_ban', value)}
                />
                <ToggleField
                  label={t('透传请求体')}
                  description={t(
                    '将 pass_through_body_enabled 写入 setting JSON。',
                  )}
                  checked={Boolean(form.pass_through_body_enabled)}
                  onChange={(value) =>
                    updateField('pass_through_body_enabled', value)
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={Bot}
              title={t('模型配置')}
              description={t(
                '原生 Aurora 标签式模型选择，保留推荐模型、上游拉取和模型映射能力。',
              )}
            >
              <FieldBlock label={t('已选模型')}>
                <div className='flex min-h-14 flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3'>
                  {form.models.length > 0 ? (
                    form.models.map((modelName) => (
                      <Token
                        key={modelName}
                        text={modelName}
                        tone='indigo'
                        onRemove={() => removeModel(modelName)}
                      />
                    ))
                  ) : (
                    <span className='text-sm text-slate-400'>
                      {t('尚未选择模型')}
                    </span>
                  )}
                </div>
              </FieldBlock>

              <div className='grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]'>
                <Input
                  value={toInputValue(customModel)}
                  onChange={(event) => setCustomModel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      appendModel(customModel);
                    }
                  }}
                  placeholder={t('输入模型名称后按回车或点击添加')}
                />
                <Button
                  className='rounded-xl'
                  variant='outline'
                  onClick={() => appendModel(customModel)}
                >
                  <Wand2 className='mr-2 h-4 w-4' />
                  {t('添加模型')}
                </Button>
              </div>

              <FieldBlock label={t('推荐模型')}>
                <div className='flex flex-wrap gap-2'>
                  {recommendedModels.map((modelName) => (
                    <button
                      key={modelName}
                      className='rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700'
                      onClick={() => appendModel(modelName)}
                      type='button'
                    >
                      {modelName}
                    </button>
                  ))}
                  <Button
                    className='rounded-full px-3'
                    size='sm'
                    variant='outline'
                    onClick={handleResetRecommendedModels}
                  >
                    {t('恢复推荐')}
                  </Button>
                </div>
              </FieldBlock>

              <div className='flex flex-wrap items-center gap-3'>
                <Button
                  className='rounded-xl'
                  variant='outline'
                  onClick={handleFetchUpstreamModels}
                  disabled={saving}
                >
                  <CloudUpload className='mr-2 h-4 w-4' />
                  {t('拉取上游模型')}
                </Button>
                <ToggleField
                  label={t('上游模型检测')}
                  description={t(
                    '同步旧版 upstream_model_update_check_enabled / auto_sync_enabled。',
                  )}
                  checked={Boolean(form.upstream_model_update_check_enabled)}
                  onChange={(value) =>
                    updateField('upstream_model_update_check_enabled', value)
                  }
                />
              </div>

              {fetchedModels.length > 0 ? (
                <FieldBlock label={t('上游返回模型')}>
                  <div className='flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3'>
                    {fetchedModels.map((modelName) => (
                      <button
                        key={modelName}
                        className='rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 transition hover:border-cyan-300'
                        onClick={() => appendModel(modelName)}
                        type='button'
                      >
                        {modelName}
                      </button>
                    ))}
                  </div>
                </FieldBlock>
              ) : null}

              {suggestedModels.length > 0 ? (
                <FieldBlock label={t('模型库建议')}>
                  <div className='flex flex-wrap gap-2'>
                    {suggestedModels.map((modelName) => (
                      <button
                        key={modelName}
                        className='rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700'
                        onClick={() => appendModel(modelName)}
                        type='button'
                      >
                        {modelName}
                      </button>
                    ))}
                  </div>
                </FieldBlock>
              ) : null}

              <div className='grid gap-5 md:grid-cols-2'>
                <FieldBlock label={t('测试模型')}>
                  <Input
                    value={toInputValue(form.test_model)}
                    onChange={handleInputChange('test_model')}
                    placeholder='gpt-4.1-mini'
                  />
                </FieldBlock>
                <FieldBlock label={t('忽略自动同步模型')}>
                  <Input
                    value={toInputValue(
                      form.upstream_model_update_ignored_models,
                    )}
                    onChange={handleInputChange(
                      'upstream_model_update_ignored_models',
                    )}
                    placeholder={t('多个模型用逗号分隔')}
                  />
                </FieldBlock>
              </div>

              <FieldBlock label={t('模型映射 JSON')}>
                <textarea
                  className={TEXTAREA_CLASS_NAME}
                  rows={6}
                  value={toInputValue(form.model_mapping)}
                  onChange={handleInputChange('model_mapping')}
                  placeholder={'{\n  "gpt-4.1": "gpt-4.1-2025-04-14"\n}'}
                />
              </FieldBlock>
            </SectionCard>

            <SectionCard
              icon={Layers3}
              title={t('请求改写与高级设置')}
              description={t(
                'JSON 改写和渠道附加 setting/settings 保持显式可见，避免旧弹窗里的深层隐藏项继续遮蔽。',
              )}
            >
              <div className='grid gap-5'>
                <FieldBlock label={t('参数覆写 JSON')}>
                  <textarea
                    className={TEXTAREA_CLASS_NAME}
                    rows={6}
                    value={toInputValue(form.param_override)}
                    onChange={handleInputChange('param_override')}
                    placeholder={'{\n  "temperature": 0.7\n}'}
                  />
                </FieldBlock>

                <FieldBlock label={t('状态码复写 JSON')}>
                  <textarea
                    className={TEXTAREA_CLASS_NAME}
                    rows={5}
                    value={toInputValue(form.status_code_mapping)}
                    onChange={handleInputChange('status_code_mapping')}
                    placeholder={'{\n  "400": "500"\n}'}
                  />
                </FieldBlock>

                <FieldBlock label={t('系统提示词')}>
                  <textarea
                    className={TEXTAREA_CLASS_NAME}
                    rows={5}
                    value={toInputValue(form.system_prompt)}
                    onChange={handleInputChange('system_prompt')}
                    placeholder={t('可选，用于写入 setting.system_prompt')}
                  />
                </FieldBlock>

                <FieldBlock label={t('更多设置 JSON')}>
                  <textarea
                    className={TEXTAREA_CLASS_NAME}
                    rows={7}
                    value={toInputValue(form.settings)}
                    onChange={handleInputChange('settings')}
                    placeholder={'{\n  "custom_key": "custom_value"\n}'}
                  />
                </FieldBlock>
              </div>
            </SectionCard>

            <SectionCard
              icon={ShieldCheck}
              title={t('告警与熔断')}
              description={t(
                '调用错误告警和 breaker 配置仍然写回旧版 settings 结构，避免功能回退。',
              )}
            >
              <div className='grid gap-4 md:grid-cols-2'>
                <ToggleField
                  label={t('调用错误告警')}
                  description={t('启用后会校验阈值和窗口时间。')}
                  checked={Boolean(form.call_error_alert_enabled)}
                  onChange={(value) =>
                    updateField('call_error_alert_enabled', value)
                  }
                />
                <ToggleField
                  label={t('Breaker 熔断')}
                  description={t('保持旧版 breaker_* 字段语义。')}
                  checked={Boolean(form.breaker_enabled)}
                  onChange={(value) => updateField('breaker_enabled', value)}
                />
              </div>

              <div className='grid gap-5 md:grid-cols-3'>
                <FieldBlock label={t('告警阈值次数')}>
                  <Input
                    type='number'
                    value={toInputValue(form.call_error_threshold_count)}
                    onChange={handleInputChange('call_error_threshold_count')}
                  />
                </FieldBlock>
                <FieldBlock label={t('告警窗口分钟')}>
                  <Input
                    type='number'
                    value={toInputValue(
                      form.call_error_threshold_window_minutes,
                    )}
                    onChange={handleInputChange(
                      'call_error_threshold_window_minutes',
                    )}
                  />
                </FieldBlock>
                <FieldBlock label={t('冷却分钟')}>
                  <Input
                    type='number'
                    value={toInputValue(form.call_error_cooldown_minutes)}
                    onChange={handleInputChange('call_error_cooldown_minutes')}
                  />
                </FieldBlock>
              </div>

              <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
                <FieldBlock label={t('Breaker 阈值次数')}>
                  <Input
                    type='number'
                    value={toInputValue(form.breaker_threshold_count)}
                    onChange={handleInputChange('breaker_threshold_count')}
                  />
                </FieldBlock>
                <FieldBlock label={t('Breaker 窗口秒数')}>
                  <Input
                    type='number'
                    value={toInputValue(form.breaker_window_seconds)}
                    onChange={handleInputChange('breaker_window_seconds')}
                  />
                </FieldBlock>
                <FieldBlock label={t('Breaker 冷却秒数')}>
                  <Input
                    type='number'
                    value={toInputValue(form.breaker_cooldown_seconds)}
                    onChange={handleInputChange('breaker_cooldown_seconds')}
                  />
                </FieldBlock>
                <FieldBlock label={t('半开探针数')}>
                  <Input
                    type='number'
                    value={toInputValue(form.breaker_half_open_probe_count)}
                    onChange={handleInputChange(
                      'breaker_half_open_probe_count',
                    )}
                  />
                </FieldBlock>
                <FieldBlock label={t('恢复成功次数')}>
                  <Input
                    type='number'
                    value={toInputValue(form.breaker_recovery_success_count)}
                    onChange={handleInputChange(
                      'breaker_recovery_success_count',
                    )}
                  />
                </FieldBlock>
              </div>

              <FieldBlock label={t('Breaker 错误类型')}>
                <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                  {BREAKER_ERROR_TYPE_OPTIONS.map((item) => (
                    <label
                      key={item}
                      className='flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700'
                    >
                      <Checkbox
                        checked={form.breaker_error_types.includes(item)}
                        onCheckedChange={() => toggleBreakerErrorType(item)}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </FieldBlock>
            </SectionCard>
          </div>

          <div className='space-y-6'>
            <Card className='sticky top-6 border-slate-200/80 bg-white/94 shadow-[0_24px_90px_-54px_rgba(79,70,229,0.42)]'>
              <CardHeader className='space-y-4'>
                <div className='flex items-center justify-between gap-3'>
                  <div>
                    <CardTitle className='text-lg font-bold text-slate-950'>
                      {t('提交侧栏')}
                    </CardTitle>
                    <CardDescription className='text-sm leading-6 text-slate-500'>
                      {t(
                        '右侧摘要区对应 Stitch 的窄侧栏，用于二次确认和提交。',
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant='outline'>{modeLabel}</Badge>
                </div>
                <div className='rounded-3xl border border-slate-200 bg-slate-50/80 p-4'>
                  <p className='text-xs font-semibold uppercase tracking-[0.22em] text-slate-500'>
                    {t('当前 Provider')}
                  </p>
                  <p className='mt-2 text-lg font-semibold text-slate-950'>
                    {providerMeta?.label || t('未选择')}
                  </p>
                  <div className='mt-3 flex flex-wrap gap-2'>
                    <Token text={`${t('模型')} ${form.models.length}`} />
                    <Token text={`${t('分组')} ${form.groups.length}`} />
                    {isEdit ? <Token text={`ID #${id}`} tone='indigo' /> : null}
                  </div>
                </div>
              </CardHeader>

              <CardContent className='space-y-4'>
                <ToggleField
                  label={t('自动同步上游模型')}
                  description={t(
                    '当启用了上游检测时，此开关会写入 auto_sync。',
                  )}
                  checked={Boolean(
                    form.upstream_model_update_auto_sync_enabled,
                  )}
                  onChange={(value) =>
                    updateField(
                      'upstream_model_update_auto_sync_enabled',
                      value,
                    )
                  }
                />
                <ToggleField
                  label={t('系统提示词覆写')}
                  description={t('保持旧版 system_prompt_override 行为。')}
                  checked={Boolean(form.system_prompt_override)}
                  onChange={(value) =>
                    updateField('system_prompt_override', value)
                  }
                />
                <ToggleField
                  label={t('强制格式化')}
                  description={t('写入渠道额外 setting.force_format。')}
                  checked={Boolean(form.force_format)}
                  onChange={(value) => updateField('force_format', value)}
                />
                <ToggleField
                  label={t('思考链转正文')}
                  description={t('同步旧版 thinking_to_content。')}
                  checked={Boolean(form.thinking_to_content)}
                  onChange={(value) =>
                    updateField('thinking_to_content', value)
                  }
                />
                <ToggleField
                  label={t('图片 URL 自动转 Base64')}
                  description={t(
                    '与 image_url_supported / unsupported 互斥归一化。',
                  )}
                  checked={Boolean(form.image_url_auto_base64)}
                  onChange={(value) =>
                    updateField('image_url_auto_base64', value)
                  }
                />

                {Number(form.type) === 20 ? (
                  <ToggleField
                    label={t('企业账户')}
                    description={t('对应 settings.openrouter_enterprise。')}
                    checked={Boolean(form.is_enterprise_account)}
                    onChange={(value) =>
                      updateField('is_enterprise_account', value)
                    }
                  />
                ) : null}

                {Number(form.type) === 33 ? (
                  <FieldBlock label={t('AWS 密钥类型')}>
                    <select
                      className={SELECT_CLASS_NAME}
                      value={toInputValue(form.aws_key_type)}
                      onChange={handleInputChange('aws_key_type')}
                    >
                      <option value='ak_sk'>AK/SK</option>
                      <option value='sts'>STS</option>
                    </select>
                  </FieldBlock>
                ) : null}

                {Number(form.type) === 41 ? (
                  <FieldBlock label={t('Vertex 密钥类型')}>
                    <select
                      className={SELECT_CLASS_NAME}
                      value={toInputValue(form.vertex_key_type)}
                      onChange={handleInputChange('vertex_key_type')}
                    >
                      <option value='json'>JSON</option>
                      <option value='api_key'>API Key</option>
                    </select>
                  </FieldBlock>
                ) : null}

                {isEdit && isMultiKeyChannel ? (
                  <FieldBlock label={t('多 Key 更新方式')}>
                    <select
                      className={SELECT_CLASS_NAME}
                      value={keyMode}
                      onChange={(event) => setKeyMode(event.target.value)}
                    >
                      <option value='append'>{t('追加')}</option>
                      <option value='replace'>{t('覆盖')}</option>
                    </select>
                  </FieldBlock>
                ) : null}

                <div className='rounded-3xl border border-indigo-200 bg-indigo-50/80 p-4 text-sm text-indigo-800'>
                  <div className='flex items-center gap-2 font-semibold'>
                    <Sparkles className='h-4 w-4' />
                    {t('提交前确认')}
                  </div>
                  <ul className='mt-3 space-y-2 text-xs leading-5'>
                    <li>{t('当前页面已不再渲染旧 EditChannelModal 主体。')}</li>
                    <li>{t('创建与编辑都通过 Aurora 原生组件渲染。')}</li>
                    <li>
                      {t(
                        '提交 payload 会继续走旧版字段装配和 settings 兼容逻辑。',
                      )}
                    </li>
                  </ul>
                </div>

                <div className='flex flex-col gap-3 pt-2'>
                  <Button
                    className='rounded-xl'
                    loading={saving}
                    onClick={handleSubmit}
                  >
                    <CheckCircle2 className='mr-2 h-4 w-4' />
                    {isEdit ? t('保存并返回列表') : t('创建并返回列表')}
                  </Button>
                  <Button
                    className='rounded-xl'
                    variant='outline'
                    onClick={() => navigate('/console/channel')}
                  >
                    <ArrowLeft className='mr-2 h-4 w-4' />
                    {t('取消')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
